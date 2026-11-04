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
