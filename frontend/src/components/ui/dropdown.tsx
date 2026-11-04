"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropdownItem {
  label: string;
  onSelect?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: "default" | "danger";
  disabled?: boolean;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
  className?: string;
  triggerClassName?: string;
}

/** Simple click-outside dropdown menu. */
export function Dropdown({
  trigger,
  items,
  align = "right",
  className,
  triggerClassName,
}: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg transition-colors",
          triggerClassName,
        )}
      >
        {trigger}
        <ChevronDown
          className={cn(
            "size-3.5 text-ink-muted transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-40 mt-1.5 min-w-44 overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-overlay",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  item.variant === "danger"
                    ? "text-danger-fg hover:bg-danger-tint"
                    : "text-ink-soft hover:bg-elevated",
                )}
              >
                {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
