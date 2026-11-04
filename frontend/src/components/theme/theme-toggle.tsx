"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme, type Theme } from "./theme-provider";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/**
 * Theme switch. Cycles light → dark → system.
 *
 * Rendered as a single button so it fits in the dense dashboard header, with
 * an accessible name that always states what the next click will do.
 */
export function ThemeToggle({
  className,
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const { theme, setTheme } = useTheme();

  const order: Theme[] = ["light", "dark", "system"];
  const currentIndex = order.indexOf(theme);
  const next = order[(currentIndex + 1) % order.length];

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  const label =
    theme === "system"
      ? "Theme: system. Switch to light."
      : theme === "dark"
        ? "Theme: dark. Switch to system."
        : "Theme: light. Switch to dark.";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg px-2 text-ink-muted transition-colors hover:bg-sunken hover:text-ink",
        className,
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {showLabel ? (
        <span className="text-[13px] font-medium capitalize">{theme}</span>
      ) : null}
    </button>
  );
}

/** Segmented control used on settings pages, where all options are visible. */
export function ThemeSegmentedControl({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        "inline-flex rounded-lg border border-line bg-sunken p-0.5",
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-surface text-ink shadow-sm"
                : "text-ink-muted hover:text-ink-soft",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
