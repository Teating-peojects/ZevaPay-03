export type PaymentState = "CREATED" | "PENDING" | "REVIEW" | "CONFIRMED" | "FAILED" | "EXPIRED" | "CANCELLED" | "REFUNDED";

const transitions: Record<PaymentState, readonly PaymentState[]> = {
  CREATED: ["PENDING", "REVIEW", "FAILED", "EXPIRED", "CANCELLED"],
  PENDING: ["REVIEW", "FAILED", "EXPIRED", "CANCELLED"],
  REVIEW: ["PENDING", "FAILED", "CANCELLED"],
  CONFIRMED: ["REFUNDED"],
  FAILED: [],
  EXPIRED: [],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransitionPaymentStatus(from: PaymentState, to: PaymentState): boolean {
  return transitions[from].includes(to);
}

/**
 * Whether the SMS matcher may settle a payment that is in `from`.
 *
 * This is deliberately separate from `canTransitionPaymentStatus`. A person
 * can never mark a payment CONFIRMED by hand (the status route refuses it);
 * only the matcher, which has checked a recorded notification against the
 * payment, or a reviewer accepting that notification, may do so.
 */
export function canSettlePayment(from: PaymentState): boolean {
  return from === "CREATED" || from === "PENDING" || from === "REVIEW";
}
