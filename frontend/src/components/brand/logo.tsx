import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * ZevaPay wordmark. Original typography-based mark — the icon is a simple
 * geometric glyph, not a third-party logo.
 */
export function Logo({
  className,
  href,
  showTagline = false,
  variant = "default",
}: {
  className?: string;
  href?: string;
  showTagline?: boolean;
  variant?: "default" | "light";
}) {
  const mark = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          variant === "light" ? "bg-white/15" : "bg-brand-solid",
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-5"
          aria-hidden="true"
        >
          {/* Stylised payment/flow glyph: three ascending strokes. */}
          <path
            d="M5 16.5v-4M10 16.5v-8M15 16.5v-11M20 16.5V7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.95"
          />
        </svg>
      </span>

      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "text-[18px] font-semibold tracking-tight",
            variant === "light" ? "text-white" : "text-ink",
          )}
        >
          Zeva
          <span className={variant === "light" ? "text-brand-200" : "text-brand-link"}>
            Pay
          </span>
        </span>
        {showTagline ? (
          <span
            className={cn(
              "mt-1 text-[11px] font-medium tracking-wide",
              variant === "light" ? "text-brand-200" : "text-ink-muted",
            )}
          >
            Simple Payment Management
          </span>
        ) : null}
      </span>
    </span>
  );

  if (!href) return mark;

  return (
    <Link href={href} className="inline-flex rounded-md" aria-label="ZevaPay home">
      {mark}
    </Link>
  );
}
