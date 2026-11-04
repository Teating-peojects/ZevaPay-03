import * as React from "react";
import { cn } from "@/lib/utils";

const sizeStyles = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-[11px]",
  md: "size-9 text-xs",
  lg: "size-11 text-sm",
} as const;

const toneStyles = {
  brand: "bg-brand-tint text-brand-link",
  neutral: "bg-elevated text-ink-soft",
  success: "bg-success-tint text-success-text",
  warning: "bg-warning-tint text-warning-text",
  danger: "bg-danger-tint text-danger-text",
  info: "bg-info-tint text-info-text",
} as const;

export type AvatarTone = keyof typeof toneStyles;
export type AvatarSize = keyof typeof sizeStyles;

/** Initials avatar with a deterministic tone derived from the name. */
export function Avatar({
  name,
  size = "md",
  tone,
  className,
}: {
  name: string;
  size?: AvatarSize;
  tone?: AvatarTone;
  className?: string;
}) {
  const initials = React.useMemo(() => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [name]);

  const resolvedTone: AvatarTone =
    tone ??
    (["brand", "success", "info", "warning", "neutral"] as AvatarTone[])[
      name.charCodeAt(0) % 5
    ];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        sizeStyles[size],
        toneStyles[resolvedTone],
        className,
      )}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
