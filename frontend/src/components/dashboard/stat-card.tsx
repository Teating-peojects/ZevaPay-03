import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Compact metric card used across overview pages. `hint` carries a short
 * supporting line, such as "Compared with last month".
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "success" | "warning" | "info";
  className?: string;
}) {
  const toneStyles = {
    neutral: "bg-elevated text-ink-soft",
    success: "bg-success-tint text-success-fg",
    warning: "bg-warning-tint text-warning-fg",
    info: "bg-info-tint text-info-fg",
  };

  return (
    <div
      className={cn(
        "surface flex flex-col justify-between rounded-xl p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-ink-muted">{label}</p>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            toneStyles[tone],
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>

      <p className="mt-3 text-2xl font-semibold tracking-tight text-ink">
        {value}
      </p>

      {hint ? <p className="mt-1.5 text-[13px] text-ink-muted">{hint}</p> : null}
    </div>
  );
}
