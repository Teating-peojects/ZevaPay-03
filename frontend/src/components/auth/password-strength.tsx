"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Password strength indicator.
 *
 * The score is computed from a small set of rules rather than from entropy,
 * so the bars always line up with the validation rules the forms actually
 * enforce. It is a hint, not a security guarantee — the server remains the
 * authority.
 */

export interface PasswordRule {
  label: string;
  test: (value: string) => boolean;
}

/**
 * The rules ZevaPay enforces on a new password. Kept in one place so the
 * register form, the reset form and the strength meter always agree.
 */
export const PASSWORD_RULES: PasswordRule[] = [
  { label: "At least 10 characters", test: (value) => value.length >= 10 },
  { label: "One uppercase letter", test: (value) => /[A-Z]/.test(value) },
  { label: "One lowercase letter", test: (value) => /[a-z]/.test(value) },
  { label: "One number", test: (value) => /\d/.test(value) },
];

export type StrengthLevel = "empty" | "weak" | "fair" | "good" | "strong";

/** Maps a password to a level and a human label. */
export function scorePassword(value: string): {
  level: StrengthLevel;
  label: string;
  /** 0..4, used for the bar count. */
  score: number;
} {
  if (!value) return { level: "empty", label: "", score: 0 };

  const passed = PASSWORD_RULES.filter((rule) => rule.test(value)).length;
  const bonus = value.length >= 16 ? 1 : 0;
  const score = Math.min(passed + bonus, 4);

  if (score <= 1) return { level: "weak", label: "Weak", score };
  if (score === 2) return { level: "fair", label: "Fair", score };
  if (score === 3) return { level: "good", label: "Good", score };
  return { level: "strong", label: "Strong", score };
}

const barTones: Record<Exclude<StrengthLevel, "empty">, string> = {
  weak: "bg-danger-500",
  fair: "bg-warning-500",
  good: "bg-accent-400",
  strong: "bg-accent-500",
};

const textTones: Record<Exclude<StrengthLevel, "empty">, string> = {
  weak: "text-danger-text",
  fair: "text-warning-text",
  good: "text-success-text",
  strong: "text-success-text",
};

/**
 * A four-segment strength meter plus the list of unmet rules.
 *
 * Renders nothing when the field is empty, so the form does not shout at a
 * visitor who has not typed anything yet.
 */
export function PasswordStrength({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const { level, label, score } = scorePassword(value);

  if (level === "empty") return null;

  const bar = barTones[level];
  const tone = textTones[level];

  return (
    <div className={cn("mt-2.5", className)}>
      <div className="flex items-center gap-2">
        <div
          className="flex flex-1 gap-1"
          role="img"
          aria-label={`Password strength: ${label}`}
        >
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                index < score ? bar : "bg-line-strong",
              )}
            />
          ))}
        </div>
        <span className={cn("text-[12px] font-semibold", tone)}>{label}</span>
      </div>

      <ul className="mt-2.5 grid gap-1 sm:grid-cols-2">
        {PASSWORD_RULES.map((rule) => {
          const passed = rule.test(value);
          return (
            <li
              key={rule.label}
              className={cn(
                "flex items-center gap-1.5 text-[12px]",
                passed ? "text-success-text" : "text-ink-muted",
              )}
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  passed ? "bg-accent-500" : "bg-line-strong",
                )}
                aria-hidden="true"
              />
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
