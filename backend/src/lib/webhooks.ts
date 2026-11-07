import { createHmac, randomBytes } from "node:crypto";
import { lookup as dnsLookup } from "node:dns";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db.js";

/**
 * Signed webhooks.
 *
 * An event is written to `WebhookDelivery` in the same database transaction
 * that changes the payment (an outbox), so a payment can never be settled
 * without its event being queued, and an event is never queued for a change
 * that rolled back. A background loop sends what is due and retries failures.
 *
 * Delivery is at least once: a merchant's handler must tolerate the same
 * event twice. Every body carries a stable `id` for that.
 */

export const WEBHOOK_EVENTS = ["payment.confirmed", "payment.review", "webhook.test"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
/** Events a merchant can subscribe to. `webhook.test` is sent on request. */
export const SUBSCRIBABLE_EVENTS = ["payment.confirmed", "payment.review"] as const;

export const MAX_DELIVERY_ATTEMPTS = 6;
export const MAX_ENDPOINTS_PER_MERCHANT = 3;
/** Wait before attempt 2, 3, … (milliseconds). */
export const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 6 * 3_600_000];
const CLAIM_LEASE_MS = 2 * 60_000;
const REQUEST_TIMEOUT_MS = 8_000;
const BATCH_SIZE = 20;

export function newWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

/** `t=<unix seconds>,v1=<hex hmac-sha256 of "<t>.<body>">`. */
export function signWebhook(secret: string, body: string, timestampSeconds: number): string {
  const digest = createHmac("sha256", secret).update(`${timestampSeconds}.${body}`).digest("hex");
  return `t=${timestampSeconds},v1=${digest}`;
}

// ---------------------------------------------------------------------------
// Where we are willing to send
// ---------------------------------------------------------------------------

/** True for addresses that must never be reached from the server. */
export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b] = address.split(".").map(Number) as [number, number];
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (family === 6) {
    const lower = address.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice(7));
    return /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) || lower.startsWith("ff");
  }
  return true; // not an address at all
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

/** Checks a URL a merchant typed in. The address is checked again when sending. */
export function validateWebhookUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Enter a full web address, such as https://example.com/hooks." };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "The address must start with https://." };
  if (url.username || url.password) {
    return { ok: false, reason: "The address must not contain a user name or password." };
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    (isIP(host.replace(/^\[|\]$/g, "")) !== 0 && isPrivateAddress(host.replace(/^\[|\]$/g, "")))
  ) {
    return { ok: false, reason: "That address points inside a private network and cannot be used." };
  }
  return { ok: true, url };
}

// ---------------------------------------------------------------------------
// Queueing (inside the payment's own transaction)
// ---------------------------------------------------------------------------

export interface WebhookPayload {
  id: string;
  type: WebhookEvent;
  createdAt: string;
  data: {
    paymentId: string;
    reference: string | null;
    orderId: string | null;
    status: string;
    amountMinor: number;
    currency: string;
    confirmedAt: string | null;
  };
}

function orderIdOf(metadata: unknown): string | null {
  if (metadata && typeof metadata === "object" && "orderId" in metadata) {
    const value = (metadata as Record<string, unknown>).orderId;
    return typeof value === "string" ? value : null;
  }
  return null;
}

/**
 * Queues `event` for every active endpoint of the merchant that subscribed to
 * it. Call this inside the transaction that changed the payment.
 */
export async function enqueueWebhookEvent(
  tx: Prisma.TransactionClient,
  merchantId: string,
  paymentId: string,
  event: "payment.confirmed" | "payment.review",
): Promise<number> {
  const endpoints = await tx.webhookEndpoint.findMany({
    where: { merchantId, isActive: true, events: { has: event }, secret: { not: null } },
    select: { id: true },
  });
  if (endpoints.length === 0) return 0;

  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true, reference: true, status: true, amountMinor: true,
      currency: true, confirmedAt: true, metadata: true,
    },
  });
  if (!payment) return 0;

  const now = new Date();
  for (const endpoint of endpoints) {
    const payload: WebhookPayload = {
      id: `evt_${randomBytes(16).toString("base64url")}`,
      type: event,
      createdAt: now.toISOString(),
      data: {
        paymentId: payment.id,
        reference: payment.reference ?? null,
        orderId: orderIdOf(payment.metadata),
        status: payment.status,
        amountMinor: Number(payment.amountMinor),
        currency: payment.currency,
        confirmedAt: payment.confirmedAt ? payment.confirmedAt.toISOString() : null,
      },
    };
    await tx.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        event,
        status: "PENDING",
        paymentId: payment.id,
        payload: payload as unknown as Prisma.InputJsonValue,
        nextAttemptAt: now,
      },
    });
  }
  return endpoints.length;
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export interface SendResult {
  statusCode: number | null;
  error: string | null;
}

export type Sender = (url: string, body: string, headers: Record<string, string>) => Promise<SendResult>;

/**
 * Sends one POST over https. Every address the host resolves to is checked, at
 * the moment of connecting, so a name that later points inside the network is
 * refused. Redirects are not followed.
 */
export const sendHttps: Sender = (rawUrl, body, headers) =>
  new Promise((resolve) => {
    const check = validateWebhookUrl(rawUrl);
    if (!check.ok) return resolve({ statusCode: null, error: check.reason });

    const request = httpsRequest(
      check.url,
      {
        method: "POST",
        headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
        timeout: REQUEST_TIMEOUT_MS,
        lookup: (hostname, options, callback) => {
          dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
            if (error) return (callback as any)(error);
            const list = addresses as unknown as { address: string; family: number }[];
            if (list.length === 0 || list.some((a) => isPrivateAddress(a.address))) {
              return (callback as any)(new Error("The address resolves inside a private network."));
            }
            if ((options as { all?: boolean }).all) return (callback as any)(null, list);
            return (callback as any)(null, list[0]!.address, list[0]!.family);
          });
        },
      },
      (response) => {
        response.resume();
        response.on("end", () => resolve({ statusCode: response.statusCode ?? null, error: null }));
        response.on("error", (error) => resolve({ statusCode: null, error: error.message }));
      },
    );
    request.on("timeout", () => request.destroy(new Error("Timed out waiting for a reply.")));
    request.on("error", (error) => resolve({ statusCode: null, error: error.message }));
    request.end(body);
  });

export function retryDelayMs(attemptsSoFar: number): number | null {
  return RETRY_DELAYS_MS[attemptsSoFar - 1] ?? null;
}

/**
 * Sends the deliveries that are due. Safe to run from several processes: a
 * delivery is claimed with a conditional update before it is sent.
 */
export async function runDueDeliveries(
  send: Sender = sendHttps,
  now: Date = new Date(),
): Promise<{ delivered: number; failed: number; retrying: number }> {
  const due = await prisma.webhookDelivery.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: now } },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
    include: { endpoint: { select: { url: true, secret: true, isActive: true } } },
  });

  const tally = { delivered: 0, failed: 0, retrying: 0 };
  for (const delivery of due) {
    const lease = new Date(now.getTime() + CLAIM_LEASE_MS);
    const claimed = await prisma.webhookDelivery.updateMany({
      where: { id: delivery.id, status: "PENDING", nextAttemptAt: { lte: now } },
      data: { nextAttemptAt: lease },
    });
    if (claimed.count !== 1) continue;

    const attempts = delivery.attempts + 1;
    let result: SendResult;
    if (!delivery.endpoint.isActive || !delivery.endpoint.secret || !delivery.payload) {
      result = { statusCode: null, error: "The endpoint is switched off or has no secret." };
    } else {
      const body = JSON.stringify(delivery.payload);
      const timestamp = Math.floor(now.getTime() / 1000);
      result = await send(delivery.endpoint.url, body, {
        "Content-Type": "application/json",
        "User-Agent": "ZevaPay-Webhooks/1",
        "ZevaPay-Event": delivery.event,
        "ZevaPay-Delivery": delivery.id,
        "ZevaPay-Signature": signWebhook(delivery.endpoint.secret, body, timestamp),
      });
    }

    const ok = result.statusCode !== null && result.statusCode >= 200 && result.statusCode < 300;
    if (ok) {
      tally.delivered++;
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: "DELIVERED", attempts, responseCode: result.statusCode, lastError: null, deliveredAt: new Date(), nextAttemptAt: null },
      });
      continue;
    }

    const delay = retryDelayMs(attempts);
    const giveUp = delay === null || attempts >= MAX_DELIVERY_ATTEMPTS;
    giveUp ? tally.failed++ : tally.retrying++;
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: giveUp ? "FAILED" : "PENDING",
        attempts,
        responseCode: result.statusCode,
        lastError: (result.error ?? `The endpoint answered ${result.statusCode}.`).slice(0, 300),
        nextAttemptAt: giveUp ? null : new Date(now.getTime() + delay),
      },
    });
  }
  return tally;
}
