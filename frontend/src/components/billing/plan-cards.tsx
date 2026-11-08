import * as React from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              "relative flex flex-col rounded-xl border bg-surface p-5",
              isBest ? "border-success-fg shadow-sm" : "border-line",
            )}
          >
            <div className="flex min-h-6 items-center gap-2">
              {isBest ? <Badge tone="success">{`Best value · Save ${save}%`}</Badge> : null}
              {!isBest && save > 0 ? <Badge tone="success">{`Save ${save}%`}</Badge> : null}
              {currentCode === plan.code ? <Badge tone="info" dot>Your plan</Badge> : null}
            </div>

            <h3 className="mt-2 text-[15px] font-semibold text-ink">
              {isTrial ? "Free trial" : plan.months === 1 ? "Monthly" : plan.months === 12 ? "Yearly" : `${plan.months} months`}
            </h3>

            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight text-ink">
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
          </article>
        );
      })}
    </div>
  );
}
