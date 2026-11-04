import { describe, expect, it } from "vitest";
import { canTransitionPaymentStatus } from "../src/lib/payment-state.js";

describe("payment status transitions", () => {
  it("allows only non-confirming workflow transitions", () => {
    expect(canTransitionPaymentStatus("CREATED", "PENDING")).toBe(true);
    expect(canTransitionPaymentStatus("PENDING", "REVIEW")).toBe(true);
    expect(canTransitionPaymentStatus("REVIEW", "CONFIRMED")).toBe(false);
    expect(canTransitionPaymentStatus("PENDING", "CONFIRMED")).toBe(false);
  });

  it("keeps final states terminal except an explicit refund after confirmation", () => {
    expect(canTransitionPaymentStatus("FAILED", "PENDING")).toBe(false);
    expect(canTransitionPaymentStatus("EXPIRED", "CONFIRMED")).toBe(false);
    expect(canTransitionPaymentStatus("CONFIRMED", "REFUNDED")).toBe(true);
    expect(canTransitionPaymentStatus("REFUNDED", "PENDING")).toBe(false);
  });
});
