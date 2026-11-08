import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * ZevaPay logo: the app icon followed by the name set in live text, so the name
 * stays readable in both light and dark themes.
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
      {/* eslint-disable-next-line @next/next/no-img-element -- a small fixed brand image */}
      <img
        src="/brand/zevapay-icon.png"
        alt=""
        width={36}
        height={36}
        className="size-9 shrink-0"
      />

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
