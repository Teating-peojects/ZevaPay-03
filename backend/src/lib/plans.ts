/**
 * The plans on sale. This list is the source of truth for prices; a `Plan`
 * row is created from it the first time it is needed.
 *
 * Prices are per month, in paisa, and the whole period is paid up front:
 * 1 month is 100 Tk, 6 months is 6 x 70 = 420 Tk, 1 year is 12 x 50 = 600 Tk.
 */
export const TRIAL_DAYS = 30;

export interface PlanDefinition {
  code: "TRIAL" | "MONTHLY" | "SEMIANNUAL" | "ANNUAL";
  name: string;
  /** Length of a paid period. 0 for the free trial, which is counted in days. */
  months: number;
  monthlyPriceMinor: number;
}

export const PLAN_CATALOG: readonly PlanDefinition[] = [
  { code: "TRIAL", name: "Free trial", months: 0, monthlyPriceMinor: 0 },
  { code: "MONTHLY", name: "1 month", months: 1, monthlyPriceMinor: 10_000 },
  { code: "SEMIANNUAL", name: "6 months", months: 6, monthlyPriceMinor: 7_000 },
  { code: "ANNUAL", name: "1 year", months: 12, monthlyPriceMinor: 5_000 },
];

export function findPlan(code: string): PlanDefinition | undefined {
  return PLAN_CATALOG.find((plan) => plan.code === code);
}

/** What the customer pays for the whole period. */
export function totalPriceMinor(plan: PlanDefinition): number {
  return plan.months * plan.monthlyPriceMinor;
}

/** Adds calendar months, keeping to the last day when the day does not exist (31 Jan + 1 month = 28 Feb). */
export function addMonths(from: Date, months: number): Date {
  const result = new Date(from.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 86_400_000);
}
