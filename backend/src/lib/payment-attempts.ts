import { prisma } from "../db.js";
import { recordAudit } from "./audit.js";
import { BadRequestError, ConflictError, NotFoundError } from "./errors.js";
import {
  CHECKOUT_PROVIDERS,
  MAX_ATTEMPTS_PER_PAYMENT,
  normalizeTrxId,
  settleFromAttempt,
  type CheckoutProvider,
} from "./payment-matching.js";

export interface SubmitTrxIdInput {
  paymentId: string;
  merchantId: string;
  provider: CheckoutProvider;
  /** As typed by a person. Cleaned here. */
  trxId: string;
  /** The signed-in user, or null when a customer submits from checkout. */
  actorId: string | null;
  ipAddress: string | null;
  /** Refuse a provider the merchant has no active account for. */
  requireActiveAccount?: boolean;
}

export interface SubmitTrxIdResult {
  attemptId: string;
  match: { outcome: "approved" | "review" | "waiting"; reasons: string[] };
}

/**
 * Records the TrxID someone gave for a payment, then looks for the SMS that
 * proves it. Used by the dashboard and by hosted checkout, so both enforce
 * the same rules.
 *
 * - approved: the SMS was already here and agrees on TrxID and amount.
 * - review: the TrxID matched but something else did not agree.
 * - waiting: no SMS yet. It settles the payment when it arrives.
 */
export async function submitTrxId(input: SubmitTrxIdInput): Promise<SubmitTrxIdResult> {
  if (!CHECKOUT_PROVIDERS.includes(input.provider)) {
    throw new BadRequestError("That payment provider is not supported.");
  }
  const trxId = normalizeTrxId(input.trxId);
  if (!trxId) {
    throw new BadRequestError(
      "Enter the TrxID exactly as it appears in the provider's confirmation message.",
    );
  }

  const payment = await prisma.payment.findFirst({
    where: { id: input.paymentId, merchantId: input.merchantId, deletedAt: null },
    include: { _count: { select: { attempts: true } } },
  });
  if (!payment) throw new NotFoundError("That payment could not be found.");
  if (payment.status !== "CREATED" && payment.status !== "PENDING") {
    throw new ConflictError("This payment is no longer waiting for a TrxID.");
  }
  if (payment.expiresAt && payment.expiresAt.getTime() < Date.now()) {
    throw new ConflictError("This payment has expired.");
  }
  if (payment._count.attempts >= MAX_ATTEMPTS_PER_PAYMENT) {
    throw new ConflictError("Too many TrxIDs have been tried for this payment.");
  }

  if (input.requireActiveAccount) {
    const account = await prisma.paymentAccount.findFirst({
      where: { merchantId: input.merchantId, provider: input.provider, status: "ACTIVE" },
      select: { id: true },
    });
    if (!account) {
      throw new BadRequestError("This merchant does not accept payments through that provider.");
    }
  }

  // One TrxID, one payment. It is spent as soon as it is submitted or as soon
  // as its SMS has been used, whichever happened first.
  const [alreadySubmitted, alreadyUsed] = await Promise.all([
    prisma.paymentAttempt.findFirst({
      where: {
        provider: input.provider,
        providerReference: trxId,
        status: { notIn: ["FAILED", "CANCELLED"] },
        payment: { merchantId: input.merchantId },
      },
      select: { id: true },
    }),
    prisma.transaction.findFirst({
      where: {
        merchantId: input.merchantId,
        provider: input.provider,
        providerRef: trxId,
        paymentId: { not: null },
      },
      select: { id: true },
    }),
  ]);
  if (alreadySubmitted || alreadyUsed) {
    throw new ConflictError("That TrxID has already been used for a payment.");
  }

  const attempt = await prisma.$transaction(async (tx) => {
    const created = await tx.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        provider: input.provider,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        providerReference: trxId,
        status: "PENDING",
      },
    });
    if (payment.status === "CREATED") {
      await tx.payment.updateMany({
        where: { id: payment.id, status: "CREATED" },
        data: { status: "PENDING" },
      });
    }
    return created;
  });

  await recordAudit({
    action: "PAYMENT_STATUS_CHANGED",
    actorId: input.actorId,
    merchantId: input.merchantId,
    metadata: {
      paymentId: payment.id,
      attemptId: attempt.id,
      event: "trxid_submitted",
      source: input.actorId ? "dashboard" : "checkout",
      provider: input.provider,
      trxId,
    },
    ipAddress: input.ipAddress,
  });

  const match = await settleFromAttempt(attempt.id);
  return {
    attemptId: attempt.id,
    match: match
      ? { outcome: match.outcome, reasons: match.reasons }
      : { outcome: "waiting", reasons: [] },
  };
}
