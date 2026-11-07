"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatBDT, formatDate } from "@/lib/format";
import type { ApiBilling, ApiSubscription } from "@/types/api";

/** An administrator's view of one merchant's plan, with a way to activate one after payment. */
export function MerchantPlan({ merchantId, onChanged }: { merchantId: string; onChanged?: () => void }) {
  const { toast } = useToast();
  const [data, setData] = React.useState<ApiBilling | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [planCode, setPlanCode] = React.useState("MONTHLY");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await apiFetch<ApiBilling>(`/api/v1/admin/merchants/${merchantId}/subscription`);
        if (!cancelled) setData(response);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [merchantId]);

  async function activate() {
    setSaving(true);
    try {
      const response = await apiFetch<{ subscription: ApiSubscription }>(
        `/api/v1/admin/merchants/${merchantId}/subscription`,
        { method: "POST", body: { planCode } },
      );
      setData((previous) => (previous ? { ...previous, subscription: response.subscription } : previous));
      toast({ title: "Plan activated", tone: "success" });
      onChanged?.();
    } catch (caught) {
      toast({
        title: "Could not activate the plan",
        description: caught instanceof ApiError ? caught.message : undefined,
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  if (failed) return <p className="text-[13px] text-ink-muted">Could not load the plan.</p>;
  if (!data) return <div className="h-16 animate-pulse rounded-lg bg-elevated" />;

  const { subscription } = data;
  const paid = data.plans.filter((plan) => plan.months > 0);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] text-ink-muted">Current plan</span>
        <span className="text-[13px] font-medium text-ink">
          {subscription.planName}
          {subscription.state === "expired"
            ? ` · ended ${formatDate(subscription.endsAt)}`
            : ` · until ${formatDate(subscription.endsAt)} (${subscription.daysLeft} days left)`}
        </span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="admin-plan" className="sr-only">
          Plan to activate
        </label>
        <Select id="admin-plan" value={planCode} onChange={(e) => setPlanCode(e.target.value)}>
          {paid.map((plan) => (
            <option key={plan.code} value={plan.code}>
              {plan.name} · {formatBDT(plan.totalPriceMinor / 100)}
            </option>
          ))}
        </Select>
        <Button type="button" size="sm" loading={saving} onClick={() => void activate()}>
          Activate after payment
        </Button>
      </div>
    </div>
  );
}
