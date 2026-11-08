import * as React from "react";
import { Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ApiPlan } from "@/types/api";

/** Every plan has every feature. The plans differ only in how long they last. */
const INCLUDED = [
  "Hosted checkout page for your customers",
  "Automatic TrxID and amount matching",
  "Android SMS app for bKash and Nagad",
  "Dashboard, payments and review queue",
  "Webhooks and developer API",
  "Your support links on the checkout page",
];

const PAID_EXTRAS = [
  "Keep creating new payments after the trial",
  "Renew early: your remaining time is kept",
];

export interface PlanCta {
  label: string;
  href: string;
}

/**
 * The plan list: one card per plan, the longest plan marked "Best value".
 * `ctaFor` chooses each card's button, so the public page can send people to
 * sign up and the dashboard can point them to support.
 */
export function PlanCards({
  plans,
  ctaFor,
  currentCode,
}: {
  plans: ApiPlan[];
  ctaFor: (plan: ApiPlan) => PlanCta | null;
  /** Marks the merchant's own plan on the dashboard. */
  currentCode?: string | null;
}) {
  const paid = plans.filter((plan) => plan.months > 0);
  const base = paid.find((plan) => plan.months === 1)?.monthlyPriceMinor ?? 0;
  const best = paid.reduce<ApiPlan | null>(
    (top, plan) => (!top || plan.monthlyPriceMinor < top.monthlyPriceMinor ? plan : top),
    null,
  );
  const ordered = [...plans].sort((a, b) => a.months - b.months);

  return (
    <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
      {ordered.map((plan) => {
        const isTrial = plan.months === 0;
        const isBest = best?.code === plan.code && paid.length > 1;
        const save =
          !isTrial && base > 0 && plan.monthlyPriceMinor < base
            ? Math.round((1 - plan.monthlyPriceMinor / base) * 100)
            : 0;
        const cta = ctaFor(plan);
        const extras = isTrial ? [] : PAID_EXTRAS;

        return (
          <article
            key={plan.code}
            aria-label={plan.name}
            className={cn(
              "relative flex flex-col overflow-hidden rounded-xl border bg-surface",
              isBest ? "border-2 border-success-fg shadow-md lg:-my-3" : "border-line",
            )}
          >
            {/* The banner row: the same height on every card so prices line up. */}
            <div
              className={cn(
                "flex min-h-9 items-center gap-2 px-5 text-[12px] font-semibold",
                isBest ? "bg-success-fg text-canvas" : "text-success-fg",
              )}
            >
              {isBest ? `Best value · Save ${save}%` : save > 0 ? `Save ${save}%` : null}
              {currentCode === plan.code ? (
                <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[11px]", isBest ? "bg-canvas/20" : "bg-brand-tint text-brand-link")}>
                  Your plan
                </span>
              ) : null}
            </div>
            <div className="flex flex-1 flex-col px-5 pb-5 pt-2">

            <h3 className="text-[15px] font-semibold text-ink">
              {isTrial ? "Free trial" : plan.months === 1 ? "Monthly" : plan.months === 12 ? "Yearly" : `${plan.months} months`}
            </h3>

            <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
              {save > 0 ? (
                <span className="text-sm text-ink-muted line-through">
                  {formatBDT(base / 100)}
                </span>
              ) : null}
              <span className="text-4xl font-semibold tracking-tight text-ink">
                {isTrial ? "৳0" : formatBDT(plan.monthlyPriceMinor / 100)}
              </span>
              {isTrial ? null : <span className="text-sm text-ink-muted">/ month</span>}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
              {isTrial
                ? "Free for 30 days. No payment needed."
                : plan.months === 1
                  ? "Pay for one month at a time."
                  : `${formatBDT(plan.totalPriceMinor / 100)} paid once for ${plan.months} months.`}
            </p>

            <hr className="my-4 border-line" />

            <p className="text-[13px] font-semibold text-ink">
              {isTrial ? "What’s included" : "Everything in the free trial, plus"}
            </p>
            <ul className="mt-3 flex flex-1 flex-col gap-2">
              {[...(isTrial ? INCLUDED : []), ...extras].map((item) => (
                <li key={item} className="flex gap-2 text-[13px] leading-snug text-ink-soft">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-success-fg" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>

            {cta ? (
              <ButtonLink
                href={cta.href}
                variant={isBest ? "primary" : "outline"}
                className="mt-5 w-full"
              >
                {cta.label}
              </ButtonLink>
            ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
