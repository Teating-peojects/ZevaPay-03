import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma as fakePrisma, store } from "./helpers/fake-prisma.js";

vi.mock("../src/db.js", async () => ({
  prisma: (await import("./helpers/fake-prisma.js")).prisma,
}));
vi.mock("../src/lib/audit.js", () => ({ recordAudit: async () => undefined }));

import { resolvePaymentAfterReview, settleFromTransaction } from "../src/lib/payment-matching.js";
import {
  enqueueWebhookEvent,
  isPrivateAddress,
  runDueDeliveries,
  signWebhook,
  validateWebhookUrl,
  type Sender,
} from "../src/lib/webhooks.js";

const SMS =
  "You have received Tk 3,000.00 from 01608576689. Ref ajaj. Fee Tk 0.00. Balance Tk 3,052.58. TrxID DK3508MJ4R at 03/11/2026 18:09";
const SMS_TIME = new Date("2026-11-03T12:09:00.000Z");

function seed(opts: { endpoints?: object[]; amountMinor?: number } = {}) {
  store.transactions = [
    {
      id: "t1", merchantId: "m1", provider: "BKASH", providerRef: "DK3508MJ4R", amountMinor: 300000,
      status: "PENDING", paymentId: null, rawNotification: SMS, occurredAt: SMS_TIME,
      createdAt: new Date(SMS_TIME.getTime() + 1000),
    },
  ];
  store.payments = [
    {
      id: "p1", reference: "TXN-1", merchantId: "m1", status: "PENDING", amountMinor: opts.amountMinor ?? 300000,
      currency: "BDT", expiresAt: null, confirmedAt: null, deletedAt: null,
      metadata: { orderId: "1182" }, createdAt: new Date(SMS_TIME.getTime() - 5 * 60_000),
    },
  ];
  store.attempts = [
    {
      id: "a1", paymentId: "p1", provider: "BKASH", providerReference: "DK3508MJ4R",
      status: "PENDING", createdAt: new Date(SMS_TIME.getTime() - 60_000),
    },
  ];
  store.webhookDeliveries = [];
  store.webhookEndpoints = ((opts.endpoints ?? [
    { id: "e1", merchantId: "m1", url: "https://shop.example/hook", secret: "whsec_test", events: ["payment.confirmed", "payment.review"] },
  ]) as { isActive?: boolean }[]).map((e) => ({ isActive: true, ...e })) as never;
}

beforeEach(() => seed());

describe("signWebhook", () => {
  it("is an HMAC-SHA256 of 'timestamp.body'", () => {
    const expected = createHmac("sha256", "whsec_test").update('1700000000.{"a":1}').digest("hex");
    expect(signWebhook("whsec_test", '{"a":1}', 1700000000)).toBe(`t=1700000000,v1=${expected}`);
  });

  it("changes when the body or the secret changes", () => {
    const base = signWebhook("s", "body", 1);
    expect(signWebhook("s", "body2", 1)).not.toBe(base);
    expect(signWebhook("s2", "body", 1)).not.toBe(base);
  });
});

describe("destinations", () => {
  it.each([
    "http://shop.example/hook",
    "https://localhost/hook",
    "https://127.0.0.1/hook",
    "https://10.0.0.5/hook",
    "https://169.254.169.254/latest",
    "https://[::1]/hook",
    "https://user:pass@shop.example/hook",
    "https://db.internal/hook",
    "not a url",
  ])("refuses %s", (url) => {
    expect(validateWebhookUrl(url).ok).toBe(false);
  });

  it("accepts a public https address", () => {
    expect(validateWebhookUrl("https://shop.example/hooks/zevapay").ok).toBe(true);
  });

  it("knows private ranges", () => {
    for (const a of ["10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(a), a).toBe(true);
    }
    for (const a of ["8.8.8.8", "172.32.0.1", "1.1.1.1"]) expect(isPrivateAddress(a), a).toBe(false);
  });
});

describe("queueing", () => {
  it("queues payment.confirmed when a notification approves a payment", async () => {
    await settleFromTransaction("t1");
    expect(store.webhookDeliveries).toHaveLength(1);
    const delivery = store.webhookDeliveries[0]!;
    expect(delivery).toMatchObject({ endpointId: "e1", event: "payment.confirmed", status: "PENDING", paymentId: "p1" });
    expect(delivery.payload).toMatchObject({
      type: "payment.confirmed",
      data: { paymentId: "p1", reference: "TXN-1", orderId: "1182", status: "CONFIRMED", amountMinor: 300000, currency: "BDT" },
    });
    expect(delivery.payload.id).toMatch(/^evt_/);
  });

  it("queues payment.review when the match needs a person", async () => {
    seed({ amountMinor: 250000 });
    await settleFromTransaction("t1");
    expect(store.webhookDeliveries.map((d) => d.event)).toEqual(["payment.review"]);
    expect(store.webhookDeliveries[0]!.payload.data.status).toBe("REVIEW");
  });

  it("queues nothing when nothing settles", async () => {
    store.payments[0]!.status = "CANCELLED";
    await settleFromTransaction("t1");
    expect(store.webhookDeliveries).toHaveLength(0);
  });

  it("skips endpoints that are off, unsubscribed, secretless or someone else's", async () => {
    seed({
      endpoints: [
        { id: "off", merchantId: "m1", url: "https://a.example", secret: "s", events: ["payment.confirmed"], isActive: false },
        { id: "other-event", merchantId: "m1", url: "https://b.example", secret: "s", events: ["payment.review"] },
        { id: "no-secret", merchantId: "m1", url: "https://c.example", secret: null, events: ["payment.confirmed"] },
        { id: "theirs", merchantId: "m2", url: "https://d.example", secret: "s", events: ["payment.confirmed"] },
      ],
    });
    await settleFromTransaction("t1");
    expect(store.webhookDeliveries).toHaveLength(0);
  });

  it("queues one delivery per matching endpoint", async () => {
    seed({
      endpoints: [
        { id: "e1", merchantId: "m1", url: "https://a.example", secret: "s", events: ["payment.confirmed"] },
        { id: "e2", merchantId: "m1", url: "https://b.example", secret: "s", events: ["payment.confirmed"] },
      ],
    });
    await settleFromTransaction("t1");
    expect(store.webhookDeliveries.map((d) => d.endpointId).sort()).toEqual(["e1", "e2"]);
  });

  it("leaves no event behind when the transaction rolls back", async () => {
    await expect(
      fakePrisma.$transaction(async (tx: never) => {
        await enqueueWebhookEvent(tx, "m1", "p1", "payment.confirmed");
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(store.webhookDeliveries).toHaveLength(0);
  });

  it("queues payment.confirmed when a reviewer accepts, and nothing on reject", async () => {
    seed({ amountMinor: 250000 });
    await settleFromTransaction("t1");
    store.webhookDeliveries = [];
    const transaction = { ...store.transactions[0]! } as never;

    await resolvePaymentAfterReview(fakePrisma as never, transaction, "REJECT");
    expect(store.webhookDeliveries).toHaveLength(0);

    store.payments[0]!.status = "REVIEW";
    await resolvePaymentAfterReview(fakePrisma as never, transaction, "ACCEPT");
    expect(store.webhookDeliveries.map((d) => d.event)).toEqual(["payment.confirmed"]);
  });
});

describe("delivery", () => {
  const NOW = new Date("2026-11-07T10:00:00.000Z");

  async function queued() {
    await settleFromTransaction("t1");
    store.webhookDeliveries[0]!.nextAttemptAt = NOW;
  }

  it("sends a signed body and marks the delivery done", async () => {
    await queued();
    const calls: { url: string; body: string; headers: Record<string, string> }[] = [];
    const send: Sender = async (url, body, headers) => {
      calls.push({ url, body, headers });
      return { statusCode: 200, error: null };
    };
    expect(await runDueDeliveries(send, NOW)).toEqual({ delivered: 1, failed: 0, retrying: 0 });

    const [call] = calls;
    expect(call!.url).toBe("https://shop.example/hook");
    const timestamp = Math.floor(NOW.getTime() / 1000);
    expect(call!.headers["ZevaPay-Signature"]).toBe(signWebhook("whsec_test", call!.body, timestamp));
    expect(call!.headers["ZevaPay-Event"]).toBe("payment.confirmed");
    expect(JSON.parse(call!.body).data.paymentId).toBe("p1");
    expect(store.webhookDeliveries[0]).toMatchObject({ status: "DELIVERED", attempts: 1, responseCode: 200, nextAttemptAt: null });
  });

  it("keeps the same event id across retries", async () => {
    await queued();
    const id = store.webhookDeliveries[0]!.payload.id;
    const bodies: string[] = [];
    const send: Sender = async (_u, body) => {
      bodies.push(body);
      return { statusCode: 500, error: null };
    };
    await runDueDeliveries(send, NOW);
    await runDueDeliveries(send, new Date(NOW.getTime() + 61_000));
    expect(bodies.map((b) => JSON.parse(b).id)).toEqual([id, id]);
  });

  it("schedules a retry after a failure, then gives up after the last attempt", async () => {
    await queued();
    const send: Sender = async () => ({ statusCode: 503, error: null });

    let clock = NOW;
    expect(await runDueDeliveries(send, clock)).toEqual({ delivered: 0, failed: 0, retrying: 1 });
    const first = store.webhookDeliveries[0]!;
    expect(first).toMatchObject({ status: "PENDING", attempts: 1, responseCode: 503 });
    expect(first.nextAttemptAt.getTime()).toBe(NOW.getTime() + 60_000);
    expect(first.lastError).toContain("503");

    // Not due yet: nothing is sent.
    expect(await runDueDeliveries(send, new Date(NOW.getTime() + 30_000))).toEqual({ delivered: 0, failed: 0, retrying: 0 });

    for (let attempt = 2; attempt <= 5; attempt++) {
      clock = new Date(store.webhookDeliveries[0]!.nextAttemptAt.getTime());
      await runDueDeliveries(send, clock);
      expect(store.webhookDeliveries[0]!.status).toBe("PENDING");
    }
    clock = new Date(store.webhookDeliveries[0]!.nextAttemptAt.getTime());
    expect(await runDueDeliveries(send, clock)).toEqual({ delivered: 0, failed: 1, retrying: 0 });
    expect(store.webhookDeliveries[0]).toMatchObject({ status: "FAILED", attempts: 6, nextAttemptAt: null });
  });

  it("records a network error", async () => {
    await queued();
    await runDueDeliveries(async () => ({ statusCode: null, error: "connect ECONNREFUSED" }), NOW);
    expect(store.webhookDeliveries[0]).toMatchObject({ status: "PENDING", lastError: "connect ECONNREFUSED" });
  });

  it("does not send twice when two runs overlap", async () => {
    await queued();
    let sent = 0;
    const slow: Sender = async () => {
      sent++;
      // A second run starts while the first is still waiting on the network.
      await runDueDeliveries(async () => { sent++; return { statusCode: 200, error: null }; }, NOW);
      return { statusCode: 200, error: null };
    };
    await runDueDeliveries(slow, NOW);
    expect(sent).toBe(1);
  });

  it("does not send to an endpoint that was switched off meanwhile", async () => {
    await queued();
    store.webhookEndpoints[0]!.isActive = false;
    const send = vi.fn(async () => ({ statusCode: 200, error: null }));
    await runDueDeliveries(send, NOW);
    expect(send).not.toHaveBeenCalled();
    expect(store.webhookDeliveries[0]!.status).toBe("PENDING");
    expect(store.webhookDeliveries[0]!.lastError).toMatch(/switched off/);
  });
});
