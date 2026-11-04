"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TooltipProps {
  /** The tooltip text. */
  content: React.ReactNode;
  /** The element the tooltip describes. */
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  /** Delay before the tooltip appears, in milliseconds. */
  delay?: number;
}

const sideStyles = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
  left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
  right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
};

/**
 * Lightweight tooltip.
 *
 * The tooltip is described by the trigger via `aria-describedby`, and shows
 * on both hover and keyboard focus. It is intentionally minimal — no
 * positioning engine, just an absolutely-placed bubble.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  className,
  delay = 120,
}: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<number | null>(null);
  const id = React.useId();

  function show() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), delay);
  }

  function hide() {
    if (timer.current) window.clearTimeout(timer.current);
    setOpen(false);
  }

  React.useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>

      {open ? (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 max-w-56 rounded-md bg-ink px-2 py-1 text-[12px] leading-snug font-medium text-white shadow-overlay",
            sideStyles[side],
            className,
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
