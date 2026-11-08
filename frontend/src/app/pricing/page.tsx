import type { Metadata } from "next";
import { PlanCards } from "@/components/billing/plan-cards";
import { PublicLayout } from "@/components/marketing/public-layout";
import { Badge } from "@/components/ui/badge";
import { PUBLIC_PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "ZevaPay is free for 30 days. After that it is ৳100 a month, ৳70 a month for 6 months, or ৳50 a month for a year. Every plan has every feature.",
};

export default function PricingPage() {
  return (
    <PublicLayout>
      <section className="border-b border-line bg-elevated">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <Badge tone="brand">Pricing</Badge>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl sm:leading-[1.15]">
            Simple pricing. Pay for the time you want.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
            Start free for 30 days. Every plan has every feature, so the only
            choice is how long you pay for. The longer the plan, the less each
            month costs.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <PlanCards
          plans={PUBLIC_PLANS}
          ctaFor={(plan) =>
            plan.months === 0
              ? { label: "Get started free", href: "/register" }
              : { label: `Choose ${plan.months === 1 ? "monthly" : plan.months === 12 ? "yearly" : `${plan.months}-month`} plan`, href: "/register" }
          }
        />
        <p className="mt-6 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
          Prices are in Bangladeshi taka and paid in advance. To start a plan,
          pay for the period you want and contact ZevaPay support; an
          administrator activates it. When your plan ends, new payments pause
          until you renew. Payments you already created, and SMS your phone
          receives, are still recorded.
        </p>
      </section>
    </PublicLayout>
  );
}
