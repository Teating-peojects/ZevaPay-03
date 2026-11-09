import type { Metadata } from "next";
import { PlanCards } from "@/components/billing/plan-cards";
import { PublicLayout } from "@/components/marketing/public-layout";
import { PageHero } from "@/components/marketing/page-hero";
import { PUBLIC_PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "ZevaPay is free for 30 days. After that it is ৳100 a month, ৳70 a month for 6 months, or ৳50 a month for a year. Every plan has every feature.",
};

export default function PricingPage() {
  return (
    <PublicLayout>
      <PageHero title="Free for 30 days." lead="Then pay for the time you want. Every plan has everything." />

      <section className="zp-light-sheen">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
        <PlanCards
          plans={PUBLIC_PLANS}
          ctaFor={(plan) =>
            plan.months === 0
              ? { label: "Get started free", href: "/register" }
              : { label: `Choose ${plan.months === 1 ? "monthly" : plan.months === 12 ? "yearly" : `${plan.months}-month`} plan`, href: "/register" }
          }
        />
        <p className="mt-6 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
          Prices are in taka, paid in advance. Pay, contact support, and an
          administrator activates your plan. If a plan ends, new payments
          pause until you renew; SMS your phone receives are still recorded.
        </p>
      </div>
      </section>
    </PublicLayout>
  );
}
