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
    neutral: "bg-gradient-to-br from-[#0a3cff] to-[#00a6e0] text-white",
    success: "bg-gradient-to-br from-emerald-500 to-teal-400 text-white",
    warning: "bg-gradient-to-br from-amber-500 to-orange-400 text-white",
    info: "bg-gradient-to-br from-[#0a3cff] to-[#00d4ff] text-white",
  };

  return (
    <div
      className={cn(
        "surface zp-card-lift relative flex flex-col justify-between overflow-hidden rounded-2xl p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-ink-muted">{label}</p>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm",
            toneStyles[tone],
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>

      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
        {value}
      </p>

      {hint ? <p className="mt-1 text-[12px] leading-snug text-ink-muted">{hint}</p> : null}
    </div>
  );
}
