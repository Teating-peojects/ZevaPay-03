import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetStore, store } from "./helpers/fake-prisma.js";

vi.mock("../src/db.js", async () => ({
  prisma: (await import("./helpers/fake-prisma.js")).prisma,
}));
vi.mock("../src/config.js", () => ({ config: { publicAppUrl: "https://pay.example.test" } }));
vi.mock("../src/lib/audit.js", () => ({
  recordAudit: async (entry: Record<string, unknown>) => {
    (await import("./helpers/fake-prisma.js")).store.audits.push(entry);
  },
}));

import { BadRequestError, ConflictError, NotFoundError } from "../src/lib/errors.js";
import {
  buildCheckoutView,
  createCheckoutPayment,
  hashCheckoutToken,
  isCheckoutTokenShape,
  loadCheckout,
  newCheckoutToken,
  validateReturnUrl,
  type CheckoutRecord,
} from "../src/lib/checkout.js";
import { submitTrxId } from "../src/lib/payment-attempts.js";
import { settleFromTransaction } from "../src/lib/payment-matching.js";

const REAL_SMS =
  "You have received Tk 3,000.00 from 01608576689. Ref ajaj. Fee Tk 0.00. Balance Tk 3,052.58. TrxID DK3508MJ4R at 03/11/2026 18:09";

function seedMerchant(accounts: object[] = [
  { id: "acc1", merchantId: "m1", provider: "BKASH", accountNumber: "01711111111", label: "Shop bKash", status: "ACTIVE", createdAt: new Date("2026-01-01") },
  { id: "acc2", merchantId: "m1", provider: "NAGAD", accountNumber: "01822222222", label: "Shop Nagad", status: "ACTIVE", createdAt: new Date("2026-01-02") },
]) {
  resetStore();
  store.merchants = [{ id: "m1", businessName: "Fahmida's Fashion", status: "ACTIVE", createdAt: new Date() }];
  store.accounts = accounts as never;
}

beforeEach(() => seedMerchant());

describe("validateReturnUrl", () => {
  it("accepts https and a local http address", () => {
    expect(validateReturnUrl("https://shop.example/thanks")).toBe("https://shop.example/thanks");
    expect(validateReturnUrl("http://localhost:3000/done")).toBe("http://localhost:3000/done");
  });

  it("refuses everything else", () => {
    for (const bad of [
      "http://shop.example/thanks",
      "javascript:alert(1)",
      "data:text/html,hi",
      "ftp://shop.example",
      "https://user:pass@shop.example/",
      "//shop.example/thanks",
      "not a url",
      "",
    ]) {
      expect(() => validateReturnUrl(bad), bad).toThrow(BadRequestError);
    }
  });
});

describe("checkout link secret", () => {
  it("is long, random and different from its hash", () => {
    const a = newCheckoutToken();
    const b = newCheckoutToken();
    expect(a.token).not.toBe(b.token);
    expect(isCheckoutTokenShape(a.token)).toBe(true);
    expect(a.hash).toBe(hashCheckoutToken(a.token));
    expect(a.hash).not.toContain(a.token);
  });

  it("rejects values that cannot be a link secret", () => {
    for (const bad of ["", "short", "x".repeat(42), "x".repeat(44), `${"a".repeat(42)}!`]) {
      expect(isCheckoutTokenShape(bad)).toBe(false);
    }
  });
});

describe("createCheckoutPayment", () => {
  it("stores only the hash of the secret, never the secret", async () => {
    const { payment, token, url } = await createCheckoutPayment({
      merchantId: "m1",
      apiKeyId: "k1",
      amountMinor: 300000,
      orderId: "ORD-1182",
      returnUrl: "https://shop.example/thanks",
    });

    expect(url).toMatch(/^https:\/\/pay\.example\.test\/pay\/[A-Za-z0-9_-]{43}$/);
    expect(url.endsWith(token)).toBe(true);
    expect(payment.checkoutTokenHash).toBe(hashCheckoutToken(token));
    expect(JSON.stringify(store)).not.toContain(token);
    expect(payment.status).toBe("CREATED");
    expect(payment.currency).toBe("BDT");
    expect(payment.metadata).toMatchObject({ orderId: "ORD-1182", returnUrl: "https://shop.example/thanks" });
  });

  it("expires after 30 minutes unless told otherwise", async () => {
    const before = Date.now();
    const { payment } = await createCheckoutPayment({ merchantId: "m1", apiKeyId: "k1", amountMinor: 10000 });
    const minutes = (payment.expiresAt.getTime() - before) / 60_000;
    expect(minutes).toBeGreaterThan(29.9);
    expect(minutes).toBeLessThan(30.1);
  });

  it("refuses a bad return address before creating anything", async () => {
    await expect(
      createCheckoutPayment({
        merchantId: "m1",
        apiKeyId: "k1",
        amountMinor: 10000,
        returnUrl: "http://evil.example",
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(store.payments).toHaveLength(0);
  });
});

describe("loadCheckout and buildCheckoutView", () => {
  async function create() {
    return createCheckoutPayment({
      merchantId: "m1",
      apiKeyId: "k1",
      amountMinor: 300000,
      description: "Panjabi set",
      returnUrl: "https://shop.example/thanks?order=1182",
    });
  }

  it("finds a payment by its link and shows only what the customer needs", async () => {
    const { token } = await create();
    const record = await loadCheckout(token);
    expect(record).not.toBeNull();

    const view = buildCheckoutView(record!);
    expect(view.merchantName).toBe("Fahmida's Fashion");
    expect(view.amountMinor).toBe(300000);
    expect(view.providers).toEqual([
      { provider: "BKASH", accountNumber: "01711111111", label: "Shop bKash" },
      { provider: "NAGAD", accountNumber: "01822222222", label: "Shop Nagad" },
    ]);
    expect(view.canSubmit).toBe(true);
    expect(view.attemptsLeft).toBe(5);

    // Nothing internal leaks.
    const text = JSON.stringify(view);
    expect(text).not.toContain("m1");
    expect(Object.keys(view)).not.toContain("merchantId");
    expect(Object.keys(view)).not.toContain("id");
  });

  it("adds the payment id to the return address and keeps the rest", async () => {
    const { token, payment } = await create();
    const view = buildCheckoutView((await loadCheckout(token))!);
    const target = new URL(view.returnUrl!);
    expect(target.origin + target.pathname).toBe("https://shop.example/thanks");
    expect(target.searchParams.get("order")).toBe("1182");
    expect(target.searchParams.get("zp_payment")).toBe(payment.id);
  });

  it("returns nothing for a wrong, short or unknown link", async () => {
    await create();
    expect(await loadCheckout("x")).toBeNull();
    expect(await loadCheckout("a".repeat(43))).toBeNull();
  });

  it("returns nothing when the merchant is suspended", async () => {
    const { token } = await create();
    store.merchants[0].status = "SUSPENDED";
    expect(await loadCheckout(token)).toBeNull();
  });

  it("offers only accounts that are active", async () => {
    seedMerchant([
      { id: "acc1", merchantId: "m1", provider: "BKASH", accountNumber: "01711111111", label: "x", status: "SUSPENDED", createdAt: new Date() },
      { id: "acc2", merchantId: "m1", provider: "NAGAD", accountNumber: "01822222222", label: "y", status: "ACTIVE", createdAt: new Date() },
      { id: "acc3", merchantId: "m1", provider: "ROCKET", accountNumber: "01933333333", label: "z", status: "ACTIVE", createdAt: new Date() },
    ]);
    const { token } = await create();
    const view = buildCheckoutView((await loadCheckout(token))!);
    expect(view.providers.map((p) => p.provider)).toEqual(["NAGAD"]);
  });

  it("cannot be paid when the merchant has no account to receive it", async () => {
    seedMerchant([]);
    const { token } = await create();
    const view = buildCheckoutView((await loadCheckout(token))!);
    expect(view.providers).toEqual([]);
    expect(view.canSubmit).toBe(false);
  });

  it("marks an unpaid payment expired once its time has passed", async () => {
    const { token } = await create();
    const record = (await loadCheckout(token))! as CheckoutRecord;
    const later = new Date(record.expiresAt!.getTime() + 1000);
    const view = buildCheckoutView(record, later);
    expect(view.expired).toBe(true);
    expect(view.canSubmit).toBe(false);
  });

  it("does not call a settled payment expired", async () => {
    const { token } = await create();
    store.payments[0].status = "CONFIRMED";
    const record = (await loadCheckout(token))!;
    const view = buildCheckoutView(record, new Date(record.expiresAt!.getTime() + 1000));
    expect(view.expired).toBe(false);
    expect(view.status).toBe("CONFIRMED");
  });
});

describe("submitTrxId", () => {
  async function paymentFor(amountMinor = 300000) {
    const { payment } = await createCheckoutPayment({ merchantId: "m1", apiKeyId: "k1", amountMinor });
    return payment.id as string;
  }

  const base = {
    merchantId: "m1",
    provider: "BKASH" as const,
    actorId: null,
    ipAddress: "203.0.113.5",
    requireActiveAccount: true,
  };

  it("waits when the SMS has not arrived, and says so", async () => {
    const paymentId = await paymentFor();
    const result = await submitTrxId({ ...base, paymentId, trxId: "dk3508mj4r" });

    expect(result.match.outcome).toBe("waiting");
    expect(store.payments[0].status).toBe("PENDING");
    expect(store.attempts[0]).toMatchObject({ providerReference: "DK3508MJ4R", status: "PENDING" });
  });

  it("confirms at once when the SMS is already recorded", async () => {
    const paymentId = await paymentFor();
    store.transactions = [
      {
        id: "t1", merchantId: "m1", provider: "BKASH", providerRef: "DK3508MJ4R", amountMinor: 300000,
        status: "PENDING", paymentId: null, rawNotification: REAL_SMS,
        occurredAt: new Date(Date.now() + 1000), createdAt: new Date(),
      },
    ];
    const result = await submitTrxId({ ...base, paymentId, trxId: "DK3508MJ4R" });

    expect(result.match.outcome).toBe("approved");
    expect(store.payments[0].status).toBe("CONFIRMED");
  });

  it("completes the whole journey when the SMS arrives after the customer", async () => {
    const paymentId = await paymentFor();
    await submitTrxId({ ...base, paymentId, trxId: "DK3508MJ4R" });
    expect(store.payments[0].status).toBe("PENDING");

    store.transactions = [
      {
        id: "t1", merchantId: "m1", provider: "BKASH", providerRef: "DK3508MJ4R", amountMinor: 300000,
        status: "PENDING", paymentId: null, rawNotification: REAL_SMS,
        occurredAt: new Date(Date.now() + 1000), createdAt: new Date(),
      },
    ];
    const settled = await settleFromTransaction("t1");

    expect(settled?.outcome).toBe("approved");
    expect(store.payments[0].status).toBe("CONFIRMED");
    expect(store.transactions[0]).toMatchObject({ status: "CONFIRMED", paymentId });
  });

  it("refuses a TrxID that is not shaped like one", async () => {
    const paymentId = await paymentFor();
    for (const trxId of ["", "abc", "DK35 08;MJ4R", "<script>"]) {
      await expect(submitTrxId({ ...base, paymentId, trxId })).rejects.toBeInstanceOf(BadRequestError);
    }
    expect(store.attempts).toHaveLength(0);
  });

  it("refuses a TrxID that was already submitted, in any spelling", async () => {
    const first = await paymentFor();
    const second = await paymentFor();
    await submitTrxId({ ...base, paymentId: first, trxId: "DK3508MJ4R" });
    await expect(
      submitTrxId({ ...base, paymentId: second, trxId: " dk3508mj4r " }),
    ).rejects.toMatchObject({ code: "TRXID_ALREADY_USED" });
  });

  it("refuses a TrxID whose SMS already settled another payment", async () => {
    const paymentId = await paymentFor();
    store.transactions = [
      { id: "t0", merchantId: "m1", provider: "BKASH", providerRef: "DK3508MJ4R", paymentId: "someone-else", status: "CONFIRMED" },
    ];
    await expect(submitTrxId({ ...base, paymentId, trxId: "DK3508MJ4R" })).rejects.toMatchObject({ code: "TRXID_ALREADY_USED" });
  });

  it("stops after five attempts", async () => {
    const paymentId = await paymentFor();
    for (const trxId of ["AAAA0001", "AAAA0002", "AAAA0003", "AAAA0004", "AAAA0005"]) {
      await submitTrxId({ ...base, paymentId, trxId });
    }
    await expect(submitTrxId({ ...base, paymentId, trxId: "AAAA0006" })).rejects.toMatchObject({ code: "ATTEMPTS_EXHAUSTED" });
    expect(store.attempts).toHaveLength(5);
  });

  it("refuses an expired payment", async () => {
    const paymentId = await paymentFor();
    store.payments[0].expiresAt = new Date(Date.now() - 1000);
    await expect(submitTrxId({ ...base, paymentId, trxId: "DK3508MJ4R" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("refuses a payment that is already settled", async () => {
    const paymentId = await paymentFor();
    store.payments[0].status = "CONFIRMED";
    await expect(submitTrxId({ ...base, paymentId, trxId: "DK3508MJ4R" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("refuses a provider the merchant has not switched on", async () => {
    const paymentId = await paymentFor();
    await expect(
      submitTrxId({ ...base, paymentId, provider: "NAGAD", trxId: "DK3508MJ4R" }),
    ).resolves.toBeDefined();

    seedMerchant([
      { id: "acc1", merchantId: "m1", provider: "BKASH", accountNumber: "01711111111", label: "x", status: "ACTIVE", createdAt: new Date() },
    ]);
    const next = await paymentFor();
    await expect(
      submitTrxId({ ...base, paymentId: next, provider: "NAGAD", trxId: "ZZ9999AAAA" }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("cannot reach another merchant's payment", async () => {
    const paymentId = await paymentFor();
    await expect(
      submitTrxId({ ...base, merchantId: "m2", paymentId, trxId: "DK3508MJ4R" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(store.attempts).toHaveLength(0);
  });
});
