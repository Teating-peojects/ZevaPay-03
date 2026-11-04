import * as React from "react";
import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AlertTone = "info" | "success" | "warning" | "danger";

const toneStyles: Record<AlertTone, { wrap: string; icon: string }> = {
  info: {
    wrap: "border-info-line bg-info-tint text-info-text",
    icon: "text-info-fg",
  },
  success: {
    wrap: "border-success-line bg-success-tint text-success-text",
    icon: "text-success-fg",
  },
  warning: {
    wrap: "border-warning-line bg-warning-tint text-warning-text",
    icon: "text-warning-fg",
  },
  danger: {
    wrap: "border-danger-line bg-danger-tint text-danger-text",
    icon: "text-danger-fg",
  },
};

const toneIcons = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
};

/** Inline informational banner. */
export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const Icon = toneIcons[tone];
  const styles = toneStyles[tone];

  return (
    <div
      role="status"
      className={cn(
        "flex gap-3 rounded-lg border px-4 py-3",
        styles.wrap,
        className,
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", styles.icon)} aria-hidden="true" />
      <div className="min-w-0 text-[13px] leading-relaxed">
        {title ? (
          <p className="font-semibold text-ink">{title}</p>
        ) : null}
        {children ? <div className="text-current/90">{children}</div> : null}
      </div>
    </div>
  );
}
