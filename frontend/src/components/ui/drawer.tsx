"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Which edge the drawer slides in from. */
  side?: "right" | "left";
  size?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-xl",
};

/**
 * Slide-over panel used for record details.
 *
 * Shares the modal's accessibility behaviour: focus is trapped, Escape
 * closes it, and focus returns to the trigger on close.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  side = "right",
  size = "md",
}: DrawerProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    const timer = window.setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLElement>(
          'input:not([type="hidden"]), select, textarea, button',
        )
        ?.focus();
    }, 0);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      window.clearTimeout(timer);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-overlay"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        aria-describedby={description ? "drawer-description" : undefined}
        className={cn(
          "relative z-10 flex h-full w-full flex-col bg-surface shadow-modal",
          side === "right"
            ? "ml-auto border-l border-line"
            : "mr-auto border-r border-line",
          sizeStyles[size],
          "animate-drawer-in",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id="drawer-title" className="text-base font-semibold text-ink">
              {title}
            </h2>
            {description ? (
              <p id="drawer-description" className="mt-1 text-[13px] text-ink-muted">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="-mt-1 -mr-1 rounded-md p-1.5 text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {children ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
            {children}
          </div>
        ) : null}

        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-sunken px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
