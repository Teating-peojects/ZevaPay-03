import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db.js";
import { parseNotification } from "../parser/index.js";
import { recordAudit } from "./audit.js";
import { canSettlePayment, canTransitionPaymentStatus } from "./payment-state.js";

/**
 * Matching a recorded SMS to a payment someone is waiting on.
 *
 * A payment is settled when two things agree: the TrxID the customer gave
 * and the TrxID in a recorded SMS, and the amount in that SMS against the
 * amount the payment asked for. Anything that does not agree cleanly goes to
 * REVIEW for a person to decide; the matcher never rejects on its own.
 *
 * "Settled" means a notification matched. It is not a check with the
 * provider, and the dashboard says "Confirmed from SMS" for that reason.
 */

/** Providers a customer can currently pay through. */
export const CHECKOUT_PROVIDERS = ["BKASH", "NAGAD"] as const;
export type CheckoutProvider = (typeof CHECKOUT_PROVIDERS)[number];

/** TrxIDs a customer may try against one payment before it is locked. */
export const MAX_ATTEMPTS_PER_PAYMENT = 5;

/**
 * How much earlier than the payment an SMS may be stamped before it is
 * treated as old. A little slack covers the phone's clock and the minute
 * the provider rounds to.
 */
export const MATCH_CLOCK_SKEW_MS = 2 * 60 * 1000;

const TRX_ID_PATTERN = /^[A-Z0-9][A-Z0-9-]{3,29}$/;

/** Cleans a TrxID typed by a person. Returns null when it cannot be one. */
export function normalizeTrxId(raw: string): string | null {
  const cleaned = raw.trim().replace(/\s+/g, "").toUpperCase();
  return TRX_ID_PATTERN.test(cleaned) ? cleaned : null;
}

// ---------------------------------------------------------------------------
// The decision (pure, no database)
// ---------------------------------------------------------------------------

export interface MatchPayment {
  status: string;
  amountMinor: number;
  currency: string;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface MatchTransaction {
  amountMinor: number;
  occurredAt: Date;
}

export type MatchDecision =
  | { outcome: "approve" }
  | { outcome: "review"; reasons: string[] }
  | { outcome: "skip"; reason: string };

function taka(minor: number): string {
  return `Tk ${(minor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Decides what to do once a TrxID has already matched. The caller has
 * checked the merchant, the provider and the TrxID; this checks the rest.
 */
export function evaluateMatch(
  payment: MatchPayment,
  transaction: MatchTransaction,
): MatchDecision {
  // A payment already in REVIEW is waiting on a person, not on a notification.
  if (payment.status !== "CREATED" && payment.status !== "PENDING") {
    return { outcome: "skip", reason: "The payment is not waiting for a notification." };
  }

  const reasons: string[] = [];

  if (transaction.amountMinor !== payment.amountMinor) {
    reasons.push(
      `The notification says ${taka(transaction.amountMinor)} but the payment asked for ${taka(payment.amountMinor)}.`,
    );
  }

  if (payment.currency !== "BDT") {
    reasons.push(`The payment is in ${payment.currency}, but notifications are in BDT.`);
  }

  if (
    transaction.occurredAt.getTime() <
    payment.createdAt.getTime() - MATCH_CLOCK_SKEW_MS
  ) {
    reasons.push("The notification is dated before this payment was created.");
  }

  if (
    payment.expiresAt &&
    transaction.occurredAt.getTime() > payment.expiresAt.getTime()
  ) {
    reasons.push("The notification arrived after this payment expired.");
  }

  return reasons.length === 0 ? { outcome: "approve" } : { outcome: "review", reasons };
}

/**
 * Only a message that says money came in may settle a payment. A debit or a
 * failure notice also carries a TrxID and an amount, and must never match.
 */
export function isIncomingPayment(rawNotification: string, provider: string): boolean {
  const { result } = parseNotification(rawNotification, {
    expectedProvider: provider as never,
  });
  return (
    result.outcome === "payment_received" &&
    result.directionExplicit &&
    result.amount !== null &&
    result.amount > 0
  );
}

// ---------------------------------------------------------------------------
// Applying it (database)
// ---------------------------------------------------------------------------

export interface SettleResult {
  outcome: "approved" | "review";
  paymentId: string;
  transactionId: string;
  reasons: string[];
}

/** Thrown inside a database transaction when someone else got there first. */
class SettlementConflict extends Error {}

interface SettleTarget {
  attempt: { id: string };
  payment: MatchPayment & { id: string; merchantId: string };
  transaction: MatchTransaction & { id: string; providerRef: string | null };
}

async function decideAndApply(target: SettleTarget): Promise<SettleResult | null> {
  const { attempt, payment, transaction } = target;
  const decision = evaluateMatch(payment, transaction);
  if (decision.outcome === "skip") return null;

  const approve = decision.outcome === "approve";
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      // Each claim is conditional on the row still being free, so two
      // notifications or two requests cannot settle the same payment or use
      // the same notification twice.
      const claimedTransaction = await tx.transaction.updateMany({
        where: {
          id: transaction.id,
          paymentId: null,
          status: { in: ["PENDING", "REVIEW"] },
        },
        data: { paymentId: payment.id, status: approve ? "CONFIRMED" : "REVIEW" },
      });
      if (claimedTransaction.count !== 1) throw new SettlementConflict();

      const claimedPayment = await tx.payment.updateMany({
        where: { id: payment.id, status: { in: ["CREATED", "PENDING"] } },
        data: approve ? { status: "CONFIRMED", confirmedAt: now } : { status: "REVIEW" },
      });
      if (claimedPayment.count !== 1) throw new SettlementConflict();

      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: approve ? "CONFIRMED" : "REVIEW" },
      });

      if (approve) {
        await tx.paymentAttempt.updateMany({
          where: { paymentId: payment.id, id: { not: attempt.id }, status: "PENDING" },
          data: { status: "CANCELLED" },
        });
      }
    });
  } catch (error) {
    if (error instanceof SettlementConflict) return null;
    throw error;
  }

  const reasons = decision.outcome === "review" ? decision.reasons : [];
  await recordAudit({
    action: "PAYMENT_STATUS_CHANGED",
    merchantId: payment.merchantId,
    metadata: {
      paymentId: payment.id,
      status: approve ? "CONFIRMED" : "REVIEW",
      source: "sms_match",
      transactionId: transaction.id,
      trxId: transaction.providerRef,
      reasons,
    },
  });

  return {
    outcome: approve ? "approved" : "review",
    paymentId: payment.id,
    transactionId: transaction.id,
    reasons,
  };
}

/**
 * A new SMS was recorded: is a customer already waiting on it?
 * Returns null when nothing matched.
 */
export async function settleFromTransaction(
  transactionId: string,
): Promise<SettleResult | null> {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });
  if (
    !transaction ||
    transaction.paymentId ||
    !transaction.providerRef ||
    transaction.amountMinor <= 0 ||
    !["PENDING", "REVIEW"].includes(transaction.status) ||
    !isIncomingPayment(transaction.rawNotification, transaction.provider)
  ) {
    return null;
  }

  const attempts = await prisma.paymentAttempt.findMany({
    where: {
      providerReference: transaction.providerRef,
      provider: transaction.provider,
      status: "PENDING",
      payment: {
        merchantId: transaction.merchantId,
        deletedAt: null,
        status: { in: ["CREATED", "PENDING"] },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 10,
    include: { payment: true },
  });
  if (attempts.length === 0) return null;

  // If several customers typed the same TrxID, prefer the payment whose
  // amount agrees, so a typo on another payment cannot take the notification.
  const attempt =
    attempts.find((candidate) => candidate.payment.amountMinor === transaction.amountMinor) ??
    attempts[0];

  return decideAndApply({ attempt, payment: attempt.payment, transaction });
}

/**
 * A customer gave a TrxID: has its SMS already arrived?
 * Returns null when no recorded notification matched yet.
 */
export async function settleFromAttempt(attemptId: string): Promise<SettleResult | null> {
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { id: attemptId },
    include: { payment: true },
  });
  if (!attempt || attempt.status !== "PENDING" || !attempt.providerReference) return null;

  const candidates = await prisma.transaction.findMany({
    where: {
      merchantId: attempt.payment.merchantId,
      provider: attempt.provider,
      providerRef: attempt.providerReference,
      paymentId: null,
      status: { in: ["PENDING", "REVIEW"] },
      amountMinor: { gt: 0 },
    },
    orderBy: { createdAt: "asc" },
    take: 5,
  });

  for (const transaction of candidates) {
    if (!isIncomingPayment(transaction.rawNotification, transaction.provider)) continue;
    const result = await decideAndApply({ attempt, payment: attempt.payment, transaction });
    if (result) return result;
  }
  return null;
}

/**
 * A reviewer decided a notification that had been matched to a payment.
 * Runs inside the review's own database transaction so the notification and
 * the payment can never disagree. Returns what happened to the payment.
 */
export async function resolvePaymentAfterReview(
  tx: Prisma.TransactionClient,
  transaction: { paymentId: string | null; providerRef: string | null; merchantId: string },
  decision: "ACCEPT" | "REJECT",
): Promise<{ paymentId: string; status: "CONFIRMED" | "PENDING" } | null> {
  if (!transaction.paymentId) return null;

  const payment = await tx.payment.findFirst({
    where: { id: transaction.paymentId, merchantId: transaction.merchantId },
    select: { id: true, status: true },
  });
  if (!payment || payment.status !== "REVIEW") return null;

  const accept = decision === "ACCEPT";
  const next = accept ? "CONFIRMED" : "PENDING";
  if (accept ? !canSettlePayment(payment.status) : !canTransitionPaymentStatus(payment.status, next)) {
    return null;
  }

  const moved = await tx.payment.updateMany({
    where: { id: payment.id, status: "REVIEW" },
    data: accept ? { status: "CONFIRMED", confirmedAt: new Date() } : { status: "PENDING" },
  });
  if (moved.count !== 1) return null;

  await tx.paymentAttempt.updateMany({
    where: {
      paymentId: payment.id,
      status: "REVIEW",
      ...(transaction.providerRef ? { providerReference: transaction.providerRef } : {}),
    },
    data: { status: accept ? "CONFIRMED" : "FAILED" },
  });

  return { paymentId: payment.id, status: next };
}
