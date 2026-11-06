import { config } from "../config.js";
import { prisma } from "../db.js";
import { recordAudit } from "./audit.js";
import { BadRequestError } from "./errors.js";
import { generateTransactionReference, randomToken, sha256 } from "./hash.js";
import { CHECKOUT_PROVIDERS, MAX_ATTEMPTS_PER_PAYMENT, type CheckoutProvider } from "./payment-matching.js";

/**
 * Hosted checkout.
 *
 * A merchant's server creates a payment with its API key and gets back a link.
 * The customer opens the link, sees the amount and where to send it, pays in
 * their provider's app and types the TrxID. The link is the only credential
 * the customer holds: a 256-bit secret, stored only as a hash.
 */

export const DEFAULT_CHECKOUT_TTL_MINUTES = 30;

// ---------------------------------------------------------------------------
// Link secret
// ---------------------------------------------------------------------------

export function hashCheckoutToken(token: string): string {
  return sha256(token);
}

/** 32 random bytes as base64url is always 43 characters. */
export function isCheckoutTokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function newCheckoutToken(): { token: string; hash: string } {
  const token = randomToken(32);
  return { token, hash: hashCheckoutToken(token) };
}

export function checkoutUrl(token: string): string {
  return `${config.publicAppUrl}/pay/${token}`;
}

// ---------------------------------------------------------------------------
// Return address
// ---------------------------------------------------------------------------

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Checks the address the customer is sent back to. It must be https (plain
 * http only for a local machine), must not carry a username or password, and
 * must not be a script or data URL. Returns the cleaned address.
 */
export function validateReturnUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new BadRequestError("returnUrl must be a full web address, such as https://shop.example/thanks.");
  }
  const local = LOCAL_HOSTS.has(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) {
    throw new BadRequestError("returnUrl must start with https://.");
  }
  if (parsed.username || parsed.password) {
    throw new BadRequestError("returnUrl must not contain a username or password.");
  }
  return parsed.toString();
}

// ---------------------------------------------------------------------------
// Creating a payment
// ---------------------------------------------------------------------------

export interface CreateCheckoutInput {
  merchantId: string;
  apiKeyId: string;
  amountMinor: number;
  description?: string;
  /** The merchant's own order number. Stored, never interpreted. */
  orderId?: string;
  returnUrl?: string;
  expiresInMinutes?: number;
  ipAddress?: string | null;
}

export async function createCheckoutPayment(input: CreateCheckoutInput) {
  const { token, hash } = newCheckoutToken();
  const returnUrl = input.returnUrl ? validateReturnUrl(input.returnUrl) : null;
  const minutes = input.expiresInMinutes ?? DEFAULT_CHECKOUT_TTL_MINUTES;

  const payment = await prisma.payment.create({
    data: {
      reference: generateTransactionReference(),
      merchantId: input.merchantId,
      amountMinor: input.amountMinor,
      currency: "BDT",
      description: input.description,
      status: "CREATED",
      expiresAt: new Date(Date.now() + minutes * 60_000),
      checkoutTokenHash: hash,
      metadata: {
        source: "checkout_api",
        apiKeyId: input.apiKeyId,
        ...(input.orderId ? { orderId: input.orderId } : {}),
        ...(returnUrl ? { returnUrl } : {}),
      },
    },
  });

  await recordAudit({
    action: "PAYMENT_CREATED",
    merchantId: input.merchantId,
    metadata: { paymentId: payment.id, source: "checkout_api", apiKeyId: input.apiKeyId },
    ipAddress: input.ipAddress ?? null,
  });

  return { payment, token, url: checkoutUrl(token) };
}

// ---------------------------------------------------------------------------
// What the customer sees
// ---------------------------------------------------------------------------

export interface CheckoutRecord {
  id: string;
  /** Internal. Never copied into `CheckoutView`. */
  merchantId: string;
  reference: string;
  amountMinor: number;
  currency: string;
  description: string | null;
  status: string;
  expiresAt: Date | null;
  metadata: unknown;
  merchant: {
    businessName: string;
    status: string;
    paymentAccounts: { provider: string; accountNumber: string; label: string; status: string; createdAt: Date }[];
  };
  _count: { attempts: number };
}

export interface CheckoutView {
  merchantName: string;
  reference: string;
  amountMinor: number;
  currency: string;
  description: string | null;
  status: string;
  /** True once the time has passed without the payment being settled. */
  expired: boolean;
  expiresAt: string | null;
  /** Where "Back to the shop" goes. Null when the merchant gave none. */
  returnUrl: string | null;
  /** One receiving account per provider the merchant can accept. */
  providers: { provider: CheckoutProvider; accountNumber: string; label: string }[];
  /** A TrxID is in and the payment is waiting for its SMS. */
  awaitingSms: boolean;
  attemptsLeft: number;
  /** Whether the customer can still type a TrxID. */
  canSubmit: boolean;
}

function metadataField(metadata: unknown, key: string): string | null {
  if (metadata && typeof metadata === "object" && key in metadata) {
    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === "string" ? value : null;
  }
  return null;
}

/**
 * Builds what the customer's page may know. Nothing internal is included: no
 * merchant id, no other payment, no account the merchant has not switched on.
 * The receiving number is shown in full on purpose: the customer has to type
 * it into their app.
 */
export function buildCheckoutView(record: CheckoutRecord, now: Date = new Date()): CheckoutView {
  const open = record.status === "CREATED" || record.status === "PENDING";
  const expired = open && !!record.expiresAt && record.expiresAt.getTime() < now.getTime();

  const providers: CheckoutView["providers"] = [];
  for (const provider of CHECKOUT_PROVIDERS) {
    const account = [...record.merchant.paymentAccounts]
      .filter((candidate) => candidate.provider === provider && candidate.status === "ACTIVE")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    if (account) {
      providers.push({ provider, accountNumber: account.accountNumber, label: account.label });
    }
  }

  const attemptsLeft = Math.max(0, MAX_ATTEMPTS_PER_PAYMENT - record._count.attempts);

  let returnUrl: string | null = null;
  const stored = metadataField(record.metadata, "returnUrl");
  if (stored) {
    // The payment id lets the merchant's server look the payment up. It is a
    // pointer, not a result: the merchant must ask the API for the status.
    const target = new URL(stored);
    target.searchParams.set("zp_payment", record.id);
    returnUrl = target.toString();
  }

  return {
    merchantName: record.merchant.businessName,
    reference: record.reference,
    amountMinor: record.amountMinor,
    currency: record.currency,
    description: record.description,
    status: record.status,
    expired,
    expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
    returnUrl,
    providers,
    awaitingSms: record.status === "PENDING" && record._count.attempts > 0,
    attemptsLeft,
    canSubmit: open && !expired && providers.length > 0 && attemptsLeft > 0,
  };
}

/** Finds a payment by its link secret. Null for anything that is not a live link. */
export async function loadCheckout(token: string): Promise<CheckoutRecord | null> {
  if (!isCheckoutTokenShape(token)) return null;
  const record = await prisma.payment.findFirst({
    where: { checkoutTokenHash: hashCheckoutToken(token), deletedAt: null },
    select: {
      id: true,
      merchantId: true,
      reference: true,
      amountMinor: true,
      currency: true,
      description: true,
      status: true,
      expiresAt: true,
      metadata: true,
      merchant: {
        select: {
          businessName: true,
          status: true,
          paymentAccounts: {
            where: { status: "ACTIVE" },
            select: { provider: true, accountNumber: true, label: true, status: true, createdAt: true },
          },
        },
      },
      _count: { select: { attempts: true } },
    },
  });
  if (!record || record.merchant.status !== "ACTIVE") return null;
  return record;
}
