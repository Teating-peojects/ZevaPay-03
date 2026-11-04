import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "brand";

const toneStyles: Record<BadgeTone, string> = {
  neutral: "bg-elevated text-ink-soft ring-line",
  success: "bg-success-tint text-success-text ring-success-line",
  warning: "bg-warning-tint text-warning-text ring-warning-line",
  danger: "bg-danger-tint text-danger-text ring-danger-line",
  info: "bg-info-tint text-info-text ring-info-line",
  brand: "bg-brand-tint text-brand-link ring-brand-line",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Adds a small solid dot before the label. */
  dot?: boolean;
}

export function Badge({
  className,
  tone = "neutral",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        toneStyles[tone],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span
          className="size-1.5 shrink-0 rounded-full bg-current opacity-80"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  );
}
