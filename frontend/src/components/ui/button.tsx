import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-solid text-white shadow-sm hover:bg-brand-solid-hover active:bg-brand-solid-hover disabled:hover:bg-brand-solid",
  secondary:
    "bg-brand-tint text-brand-ink hover:bg-brand-100 active:bg-brand-200 disabled:hover:bg-brand-tint",
  outline:
    "border border-line-strong bg-surface text-ink shadow-sm hover:bg-elevated active:bg-elevated disabled:hover:bg-surface",
  ghost: "text-ink-soft hover:bg-elevated active:bg-elevated disabled:hover:bg-transparent",
  danger:
    "bg-danger-600 text-white shadow-sm hover:bg-danger-700 active:bg-danger-700 disabled:hover:bg-danger-600",
};

/*
 * `md` matches the 40px height of Input/Select so a control and a button sit
 * flush in a toolbar. On touch devices (`pointer: coarse`) every size grows to
 * a 44px minimum hit area; desktop density is unchanged.
 */
const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px] [@media(pointer:coarse)]:min-h-11",
  md: "h-10 gap-2 px-4 text-sm [@media(pointer:coarse)]:min-h-11",
  lg: "h-11 gap-2 px-5 text-[15px]",
  icon: "h-10 w-10 justify-center [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11",
};

const baseStyles =
  "inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors";

export interface ButtonLinkProps
  extends Omit<React.ComponentProps<typeof Link>, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/**
 * A link that looks like a button.
 *
 * Use this instead of wrapping a `<Button>` in a `<Link>`: a button inside an
 * anchor is invalid HTML, gives keyboard users two tab stops for one action,
 * and confuses screen readers about whether it is a link or a button.
 */
export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      {...props}
    />
  );
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          baseStyles,
          "disabled:cursor-not-allowed disabled:opacity-55",
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <Loader2
            className="size-4 shrink-0 animate-spin"
            aria-hidden="true"
          />
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
