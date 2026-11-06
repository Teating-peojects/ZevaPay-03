import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma as fakePrisma, store } from "./helpers/fake-prisma.js";

vi.mock("../src/db.js", async () => ({
  prisma: (await import("./helpers/fake-prisma.js")).prisma,
}));
vi.mock("../src/lib/audit.js", () => ({
  recordAudit: async (entry: Record<string, unknown>) => {
    (await import("./helpers/fake-prisma.js")).store.audits.push(entry);
  },
}));

import {
  evaluateMatch,
  isIncomingPayment,
  normalizeTrxId,
  resolvePaymentAfterReview,
  settleFromAttempt,
  settleFromTransaction,
} from "../src/lib/payment-matching.js";
import { canSettlePayment, canTransitionPaymentStatus } from "../src/lib/payment-state.js";

const REAL_SMS =
  "You have received Tk 3,000.00 from 01608576689. Ref ajaj. Fee Tk 0.00. Balance Tk 3,052.58. TrxID DK3508MJ4R at 03/11/2026 18:09";
const SMS_TIME = new Date("2026-11-03T12:09:00.000Z");

function seed(overrides: { payment?: object; transaction?: object; attempt?: object } = {}) {
    store.transactions = [
    {
      id: "t1",
      merchantId: "m1",
      provider: "BKASH",
      providerRef: "DK3508MJ4R",
      amountMinor: 300000,
      status: "PENDING",
      paymentId: null,
      rawNotification: REAL_SMS,
      occurredAt: SMS_TIME,
      createdAt: new Date(SMS_TIME.getTime() + 1000),
      ...overrides.transaction,
    },
  ];
  store.payments = [
    {
      id: "p1",
      merchantId: "m1",
      status: "PENDING",
      amountMinor: 300000,
      currency: "BDT",
      expiresAt: null,
      confirmedAt: null,
      deletedAt: null,
      createdAt: new Date(SMS_TIME.getTime() - 5 * 60_000),
      ...overrides.payment,
    },
  ];
  store.attempts = [
    {
      id: "a1",
      paymentId: "p1",
      provider: "BKASH",
      providerReference: "DK3508MJ4R",
      status: "PENDING",
      createdAt: new Date(SMS_TIME.getTime() - 60_000),
      ...overrides.attempt,
    },
  ];
  store.audits = [];
}

beforeEach(() => seed());

describe("normalizeTrxId", () => {
  it("upper-cases and removes spaces", () => {
    expect(normalizeTrxId(" dk3508 mj4r ")).toBe("DK3508MJ4R");
  });

  it("rejects values that cannot be a TrxID", () => {
    expect(normalizeTrxId("abc")).toBeNull();
    expect(normalizeTrxId("DK35 08;MJ4R")).toBeNull();
    expect(normalizeTrxId("")).toBeNull();
  });
});

describe("isIncomingPayment", () => {
  it("accepts a received-money notification", () => {
    expect(isIncomingPayment(REAL_SMS, "BKASH")).toBe(true);
  });

  it("refuses a debit or a failure that carries the same TrxID and amount", () => {
    expect(
      isIncomingPayment("You have sent Tk 3,000.00 to 01711111111. TrxID DK3508MJ4R", "BKASH"),
    ).toBe(false);
    expect(
      isIncomingPayment("Tk 3,000.00 transfer failed. TrxID DK3508MJ4R", "BKASH"),
    ).toBe(false);
  });

  it("refuses a message that never says money arrived", () => {
    expect(isIncomingPayment("Tk 3,000.00 TrxID DK3508MJ4R", "BKASH")).toBe(false);
  });
});

describe("evaluateMatch", () => {
  const payment = {
    status: "PENDING",
    amountMinor: 300000,
    currency: "BDT",
    expiresAt: null,
    createdAt: new Date("2026-11-03T12:00:00Z"),
  };

  it("approves when the amount agrees and the SMS is after the payment", () => {
    expect(evaluateMatch(payment, { amountMinor: 300000, occurredAt: SMS_TIME })).toEqual({
      outcome: "approve",
    });
  });

  it("sends a different amount to review and says why", () => {
    const decision = evaluateMatch(payment, { amountMinor: 250000, occurredAt: SMS_TIME });
    expect(decision.outcome).toBe("review");
    if (decision.outcome === "review") {
      expect(decision.reasons[0]).toContain("Tk 2,500.00");
      expect(decision.reasons[0]).toContain("Tk 3,000.00");
    }
  });

  it("sends an SMS dated before the payment to review", () => {
    const decision = evaluateMatch(payment, {
      amountMinor: 300000,
      occurredAt: new Date("2026-11-03T11:00:00Z"),
    });
    expect(decision.outcome).toBe("review");
  });

  it("tolerates a minute of clock difference", () => {
    const decision = evaluateMatch(payment, {
      amountMinor: 300000,
      occurredAt: new Date("2026-11-03T11:59:00Z"),
    });
    expect(decision.outcome).toBe("approve");
  });

  it("sends an SMS that arrived after expiry to review", () => {
    const decision = evaluateMatch(
      { ...payment, expiresAt: new Date("2026-11-03T12:05:00Z") },
      { amountMinor: 300000, occurredAt: SMS_TIME },
    );
    expect(decision.outcome).toBe("review");
  });

  it("skips a payment that is not open", () => {
    for (const status of ["CONFIRMED", "REVIEW", "CANCELLED", "EXPIRED", "FAILED"]) {
      expect(
        evaluateMatch({ ...payment, status }, { amountMinor: 300000, occurredAt: SMS_TIME })
          .outcome,
      ).toBe("skip");
    }
  });
});

describe("payment state", () => {
  it("lets the matcher settle but still refuses a manual confirm", () => {
    expect(canSettlePayment("CREATED")).toBe(true);
    expect(canSettlePayment("PENDING")).toBe(true);
    expect(canSettlePayment("REVIEW")).toBe(true);
    expect(canSettlePayment("CANCELLED")).toBe(false);
    expect(canSettlePayment("CONFIRMED")).toBe(false);
    expect(canTransitionPaymentStatus("PENDING", "CONFIRMED")).toBe(false);
  });
});

describe("settleFromTransaction", () => {
  it("confirms the payment when TrxID and amount both match", async () => {
    const result = await settleFromTransaction("t1");

    expect(result?.outcome).toBe("approved");
    expect(store.payments[0].status).toBe("CONFIRMED");
    expect(store.payments[0].confirmedAt).toBeInstanceOf(Date);
    expect(store.transactions[0]).toMatchObject({ status: "CONFIRMED", paymentId: "p1" });
    expect(store.attempts[0].status).toBe("CONFIRMED");
    expect(store.audits[0]).toMatchObject({ action: "PAYMENT_STATUS_CHANGED" });
  });

  it("puts a different amount in review, linked to the payment", async () => {
    seed({ transaction: { amountMinor: 250000 } });
    const result = await settleFromTransaction("t1");

    expect(result?.outcome).toBe("review");
    expect(store.payments[0].status).toBe("REVIEW");
    expect(store.transactions[0]).toMatchObject({ status: "REVIEW", paymentId: "p1" });
    expect(store.attempts[0].status).toBe("REVIEW");
  });

  it("does nothing when no customer has given that TrxID", async () => {
    seed({ attempt: { providerReference: "OTHER12345" } });
    expect(await settleFromTransaction("t1")).toBeNull();
    expect(store.payments[0].status).toBe("PENDING");
  });

  it("does not match another merchant's payment", async () => {
    seed({ payment: { merchantId: "m2" } });
    expect(await settleFromTransaction("t1")).toBeNull();
    expect(store.payments[0].status).toBe("PENDING");
  });

  it("does not match another provider", async () => {
    seed({ attempt: { provider: "NAGAD" } });
    expect(await settleFromTransaction("t1")).toBeNull();
  });

  it("never matches an outgoing debit", async () => {
    seed({
      transaction: {
        status: "REVIEW",
        rawNotification:
          "You have sent Tk 3,000.00 to 01711111111. TrxID DK3508MJ4R at 03/11/2026 18:09",
      },
    });
    expect(await settleFromTransaction("t1")).toBeNull();
    expect(store.payments[0].status).toBe("PENDING");
    expect(store.transactions[0].paymentId).toBeNull();
  });

  it("uses a notification for one payment only", async () => {
    await settleFromTransaction("t1");
    expect(await settleFromTransaction("t1")).toBeNull();
  });

  it("leaves everything unchanged when the payment was settled meanwhile", async () => {
    // The attempt still looks pending, but the payment has just been
    // cancelled. The claim on the payment fails and the claim on the
    // notification must be undone.
    seed({ payment: { status: "CANCELLED" } });
    store.attempts[0].status = "PENDING";
    // Bypass the lookup filter by calling through the attempt path.
    expect(await settleFromAttempt("a1")).toBeNull();
    expect(store.transactions[0]).toMatchObject({ status: "PENDING", paymentId: null });
    expect(store.payments[0].status).toBe("CANCELLED");
  });

  it("prefers the payment whose amount agrees when two customers typed the same TrxID", async () => {
    seed();
    store.payments.push({
      ...store.payments[0],
      id: "p2",
      amountMinor: 999900,
    });
    store.attempts.unshift({
      ...store.attempts[0],
      id: "a0",
      paymentId: "p2",
      createdAt: new Date(SMS_TIME.getTime() - 120_000),
    });

    const result = await settleFromTransaction("t1");
    expect(result).toMatchObject({ outcome: "approved", paymentId: "p1" });
    expect(store.payments.find((p) => p.id === "p2")?.status).toBe("PENDING");
  });
});

describe("settleFromAttempt", () => {
  it("confirms when the SMS was recorded before the customer typed the TrxID", async () => {
    const result = await settleFromAttempt("a1");

    expect(result?.outcome).toBe("approved");
    expect(store.payments[0].status).toBe("CONFIRMED");
    expect(store.transactions[0].paymentId).toBe("p1");
  });

  it("waits when no SMS has arrived", async () => {
    store.transactions = [];
    expect(await settleFromAttempt("a1")).toBeNull();
    expect(store.payments[0].status).toBe("PENDING");
  });

  it("cancels the customer's other open attempts once one settles", async () => {
    store.attempts.push({
      id: "a2",
      paymentId: "p1",
      provider: "BKASH",
      providerReference: "WRONG00001",
      status: "PENDING",
      createdAt: new Date(SMS_TIME.getTime() - 30_000),
    });
    await settleFromAttempt("a1");
    expect(store.attempts.find((a) => a.id === "a2")?.status).toBe("CANCELLED");
  });
});

describe("resolvePaymentAfterReview", () => {
  async function reviewed() {
    seed({ transaction: { amountMinor: 250000 } });
    await settleFromTransaction("t1"); // payment, transaction and attempt -> REVIEW
    return { ...store.transactions[0] };
  }

  it("confirms the payment when the reviewer accepts", async () => {
    const transaction = await reviewed();
    const result = await resolvePaymentAfterReview(fakePrisma as never, transaction as never, "ACCEPT");

    expect(result).toEqual({ paymentId: "p1", status: "CONFIRMED" });
    expect(store.payments[0].status).toBe("CONFIRMED");
    expect(store.attempts[0].status).toBe("CONFIRMED");
  });

  it("reopens the payment when the reviewer rejects", async () => {
    const transaction = await reviewed();
    const result = await resolvePaymentAfterReview(fakePrisma as never, transaction as never, "REJECT");

    expect(result).toEqual({ paymentId: "p1", status: "PENDING" });
    expect(store.payments[0].status).toBe("PENDING");
    expect(store.attempts[0].status).toBe("FAILED");
  });

  it("does nothing for a notification that was never matched", async () => {
    seed();
    const result = await resolvePaymentAfterReview(
      fakePrisma as never,
      { paymentId: null, providerRef: "DK3508MJ4R", merchantId: "m1" },
      "ACCEPT",
    );
    expect(result).toBeNull();
  });

  it("does not touch a payment that is not waiting in review", async () => {
    seed({ payment: { status: "CANCELLED" } });
    const result = await resolvePaymentAfterReview(
      fakePrisma as never,
      { paymentId: "p1", providerRef: "DK3508MJ4R", merchantId: "m1" },
      "ACCEPT",
    );
    expect(result).toBeNull();
    expect(store.payments[0].status).toBe("CANCELLED");
  });
});
