import { beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "./helpers/fake-prisma.js";

vi.mock("../src/db.js", async () => ({
  prisma: (await import("./helpers/fake-prisma.js")).prisma,
}));

import { PLAN_CATALOG, addMonths, findPlan, totalPriceMinor } from "../src/lib/plans.js";
import { activatePlan, assertCanCreatePayments, evaluateAccess, getAccess } from "../src/lib/subscriptions.js";

const T0 = new Date("2026-11-08T00:00:00.000Z");
const DAY = 86_400_000;

beforeEach(() => {
  store.merchants = [{ id: "m1", plan: "Starter" }];
  store.plans = [];
  store.subscriptions = [];
});

describe("prices", () => {
  it("match the plan list", () => {
    const price = (code: string) => totalPriceMinor(findPlan(code)!) / 100;
    expect(price("TRIAL")).toBe(0);
    expect(price("MONTHLY")).toBe(100);
    expect(price("SEMIANNUAL")).toBe(420); // 6 x 70
    expect(price("ANNUAL")).toBe(600); // 12 x 50
    expect(findPlan("SEMIANNUAL")!.monthlyPriceMinor).toBe(7000);
    expect(PLAN_CATALOG.map((p) => p.code)).toEqual(["TRIAL", "MONTHLY", "SEMIANNUAL", "ANNUAL"]);
  });
});

describe("addMonths", () => {
  it("keeps the day, and clamps to the end of a short month", () => {
    expect(addMonths(new Date("2026-11-08T10:00:00Z"), 1).toISOString()).toBe("2026-12-08T10:00:00.000Z");
    expect(addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(addMonths(new Date("2024-01-31T00:00:00Z"), 1).toISOString()).toBe("2024-02-29T00:00:00.000Z");
    expect(addMonths(new Date("2026-11-08T00:00:00Z"), 12).toISOString()).toBe("2027-11-08T00:00:00.000Z");
    expect(addMonths(new Date("2026-08-31T00:00:00Z"), 6).toISOString()).toBe("2027-02-28T00:00:00.000Z");
  });
});

describe("free trial", () => {
  it("starts for 30 days the first time a merchant is looked at", async () => {
    const access = await getAccess("m1", T0);
    expect(access).toMatchObject({ state: "trial", planCode: "TRIAL", daysLeft: 30 });
    expect(access.endsAt).toBe(new Date(T0.getTime() + 30 * DAY).toISOString());
    expect(store.merchants[0]!.plan).toBe("Free trial");
  });

  it("is not started twice", async () => {
    await getAccess("m1", T0);
    await getAccess("m1", new Date(T0.getTime() + 5 * DAY));
    expect(store.subscriptions).toHaveLength(1);
    expect((await getAccess("m1", new Date(T0.getTime() + 5 * DAY))).daysLeft).toBe(25);
  });

  it("ends after 30 days and then refuses new payments", async () => {
    await getAccess("m1", T0);
    await expect(assertCanCreatePayments("m1", new Date(T0.getTime() + 29 * DAY))).resolves.toBeUndefined();
    const after = new Date(T0.getTime() + 30 * DAY + 1000);
    expect((await getAccess("m1", after)).state).toBe("expired");
    await expect(assertCanCreatePayments("m1", after)).rejects.toThrow(/plan has ended/);
  });
});

describe("activating a plan", () => {
  it("starts a paid period and names it on the merchant", async () => {
    const access = await activatePlan("m1", "SEMIANNUAL", T0);
    expect(access).toMatchObject({ state: "active", planCode: "SEMIANNUAL" });
    expect(access.endsAt).toBe("2027-05-08T00:00:00.000Z");
    expect(store.merchants[0]!.plan).toBe("6 months");
  });

  it("lets an expired merchant create payments again", async () => {
    await getAccess("m1", T0);
    const late = new Date(T0.getTime() + 40 * DAY);
    await expect(assertCanCreatePayments("m1", late)).rejects.toThrow();
    await activatePlan("m1", "MONTHLY", late);
    await expect(assertCanCreatePayments("m1", late)).resolves.toBeUndefined();
  });

  it("adds to the time left instead of replacing it", async () => {
    await getAccess("m1", T0); // trial until T0 + 30 days
    const access = await activatePlan("m1", "MONTHLY", new Date(T0.getTime() + 10 * DAY));
    // 20 trial days remain, so the paid month starts on day 30
    expect(access.endsAt).toBe(addMonths(new Date(T0.getTime() + 30 * DAY), 1).toISOString());
    expect(store.subscriptions.filter((s) => s.status !== "CANCELLED")).toHaveLength(1);
  });

  it("renewing early stacks on the end of the current plan", async () => {
    await activatePlan("m1", "MONTHLY", T0);
    const access = await activatePlan("m1", "MONTHLY", new Date(T0.getTime() + 5 * DAY));
    expect(access.endsAt).toBe("2027-01-08T00:00:00.000Z");
  });

  it("refuses the trial and unknown plans", async () => {
    await expect(activatePlan("m1", "TRIAL", T0)).rejects.toThrow(/starts by itself/);
    await expect(activatePlan("m1", "GOLD", T0)).rejects.toThrow(/does not exist/);
    await expect(activatePlan("nope", "MONTHLY", T0)).rejects.toThrow(/could not be found/);
    expect(store.subscriptions).toHaveLength(0);
  });
});

describe("evaluateAccess", () => {
  it("counts days left upward and is expired exactly at the end", () => {
    const sub = { status: "ACTIVE", renewsAt: new Date(T0.getTime() + DAY / 2), plan: { code: "MONTHLY", name: "1 month" } };
    expect(evaluateAccess(sub, T0).daysLeft).toBe(1);
    expect(evaluateAccess(sub, new Date(T0.getTime() + DAY / 2)).state).toBe("expired");
  });
});
