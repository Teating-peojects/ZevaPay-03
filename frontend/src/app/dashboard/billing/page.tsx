"use client";

import * as React from "react";
import { PlanCards } from "@/components/billing/plan-cards";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { ApiBilling } from "@/types/api";

export default function BillingPage() {
  const [data, setData] = React.useState<ApiBilling | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await apiFetch<ApiBilling>("/api/v1/merchant/billing");
        if (!cancelled) setData(response);
      } catch {
        if (!cancelled) setError("We could not load your plan. Please try again.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = data?.subscription;
  const trial = data?.plans.find((plan) => plan.months === 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Plan"
        description="Your plan, and the plans you can switch to."
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {current ? (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>{current.planName}</CardTitle>
              <CardDescription>
                {current.state === "expired"
                  ? `Ended on ${formatDate(current.endsAt)}`
                  : `Runs until ${formatDate(current.endsAt)} · ${current.daysLeft} ${current.daysLeft === 1 ? "day" : "days"} left`}
              </CardDescription>
            </div>
            <Badge
              tone={current.state === "expired" ? "danger" : current.state === "trial" ? "info" : "success"}
              dot
            >
              {current.state === "expired" ? "Ended" : current.state === "trial" ? "Free trial" : "Active"}
            </Badge>
          </CardHeader>
          {current.state === "expired" ? (
            <CardContent>
              <Alert tone="warning" title="New payments are paused">
                You cannot create new payments until you renew. Payments you
                already created, and SMS your phone receives, are still
                recorded.
              </Alert>
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      {data ? (
        <section aria-label="Plans">
          <PlanCards
            plans={data.plans}
            currentCode={current?.planCode ?? null}
            ctaFor={(plan) =>
              plan.months === 0
                ? null
                : { label: "Contact support to start", href: "/dashboard/support" }
            }
          />
        </section>
      ) : null}

      {data ? (
        <Alert tone="info" title="How to start or renew">
          Every new account gets {trial ? "30 days free" : "a free trial"}. To
          start or renew a plan, pay the amount for the period you want and
          contact ZevaPay support. An administrator will then activate it. If
          time is left on your current plan, the new period starts after it, so
          nothing you paid for is lost.
        </Alert>
      ) : null}
    </div>
  );
}
