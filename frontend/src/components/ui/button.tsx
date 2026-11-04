import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-solid text-white shadow-sm hover:bg-brand-solid-hover active:bg-brand-solid-hover disabled:hover:bg-brand-solid",
  secondary:
    "bg-brand-tint text-brand-ink hover:bg-brand-tint active:bg-brand-tint disabled:hover:bg-brand-tint",
  outline:
    "border border-line-strong bg-surface text-ink shadow-sm hover:bg-elevated active:bg-elevated disabled:hover:bg-surface",
  ghost: "text-ink-soft hover:bg-elevated active:bg-elevated disabled:hover:bg-transparent",
  danger:
    "bg-danger-600 text-white shadow-sm hover:bg-danger-700 active:bg-danger-700 disabled:hover:bg-danger-600",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px]",
  md: "h-9 gap-2 px-3.5 text-sm",
  lg: "h-11 gap-2 px-5 text-[15px]",
  icon: "h-9 w-9 justify-center",
};

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
          "inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors",
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
