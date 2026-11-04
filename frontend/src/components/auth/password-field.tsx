"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";

/**
 * A password field with a show/hide toggle.
 *
 * The toggle is a real button with a label, so it is reachable by keyboard
 * and announced properly — it is not just a decorative icon sitting on top
 * of the input.
 */
export function PasswordField({
  id,
  autoComplete = "current-password",
  placeholder,
  error,
  hint,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  id: string;
  error?: string;
  hint?: string;
}) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        error={error}
        hint={hint}
        className="pr-10"
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? `Hide ${id}` : `Show ${id}`}
        aria-pressed={visible}
        className={cn(
          "absolute top-0 right-0 flex h-10 w-10 items-center justify-center rounded-r-lg text-ink-muted transition-colors hover:text-ink",
          "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-solid",
        )}
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
