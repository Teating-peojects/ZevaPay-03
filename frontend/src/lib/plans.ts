import type { ApiPlan } from "@/types/api";

/**
 * The plans as shown on the public pricing page, where there is no signed-in
 * merchant to ask the API. This mirrors `PLAN_CATALOG` in
 * backend/src/lib/plans.ts: change both together. Signed-in pages use the
 * plans the API returns instead.
 */
export const PUBLIC_PLANS: ApiPlan[] = [
  { code: "TRIAL", name: "Free trial", months: 0, monthlyPriceMinor: 0, totalPriceMinor: 0, currency: "BDT" },
  { code: "MONTHLY", name: "1 month", months: 1, monthlyPriceMinor: 10_000, totalPriceMinor: 10_000, currency: "BDT" },
  { code: "SEMIANNUAL", name: "6 months", months: 6, monthlyPriceMinor: 7_000, totalPriceMinor: 42_000, currency: "BDT" },
  { code: "ANNUAL", name: "1 year", months: 12, monthlyPriceMinor: 5_000, totalPriceMinor: 60_000, currency: "BDT" },
];
