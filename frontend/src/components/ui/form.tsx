import * as React from "react";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }
>(({ className, children, required, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "mb-1.5 block text-[13px] font-medium text-ink-soft",
      className,
    )}
    {...props}
  >
    {children}
    {required ? (
      <span className="ml-0.5 text-danger-fg" aria-hidden="true">
        *
      </span>
    ) : null}
  </label>
));
Label.displayName = "Label";

const fieldBase =
  "w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-faint " +
  "transition-colors focus:border-brand-link focus:outline-none focus:ring-2 focus:ring-brand-solid/15 " +
  "disabled:cursor-not-allowed disabled:bg-elevated disabled:text-ink-faint";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Validation message. Presence switches the field to the error style. */
  error?: string;
  /** Hint text rendered below the field. */
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, hint, id, ...props }, ref) => {
    const describedBy =
      error || hint ? `${id ?? props.name ?? "field"}-description` : undefined;

    return (
      <div>
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            fieldBase,
            "h-10",
            error && "border-danger-500 focus:border-danger-fg focus:ring-danger-fg/15",
            className,
          )}
          {...props}
        />
        {error ? (
          <p
            id={describedBy}
            className="mt-1.5 text-[13px] text-danger-fg"
            role="alert"
          >
            {error}
          </p>
        ) : hint ? (
          <p id={describedBy} className="mt-1.5 text-[13px] text-ink-muted">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  hint?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, hint, id, children, ...props }, ref) => {
    const describedBy =
      error || hint ? `${id ?? props.name ?? "field"}-description` : undefined;

    return (
      <div>
        <select
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            fieldBase,
            "h-10 cursor-pointer appearance-none bg-[length:16px] bg-[right_0.65rem_center] bg-no-repeat pr-9",
            error && "border-danger-500 focus:border-danger-fg focus:ring-danger-fg/15",
            className,
          )}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          }}
          {...props}
        >
          {children}
        </select>
        {error ? (
          <p
            id={describedBy}
            className="mt-1.5 text-[13px] text-danger-fg"
            role="alert"
          >
            {error}
          </p>
        ) : hint ? (
          <p id={describedBy} className="mt-1.5 text-[13px] text-ink-muted">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
Select.displayName = "Select";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, hint, id, ...props }, ref) => {
    const describedBy =
      error || hint ? `${id ?? props.name ?? "field"}-description` : undefined;

    return (
      <div>
        <textarea
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            fieldBase,
            "min-h-24 py-2.5 leading-relaxed",
            error && "border-danger-500 focus:border-danger-fg focus:ring-danger-fg/15",
            className,
          )}
          {...props}
        />
        {error ? (
          <p
            id={describedBy}
            className="mt-1.5 text-[13px] text-danger-fg"
            role="alert"
          >
            {error}
          </p>
        ) : hint ? (
          <p id={describedBy} className="mt-1.5 text-[13px] text-ink-muted">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

/** Checkbox with a label, used in forms and settings. */
export function Checkbox({
  className,
  id,
  label,
  description,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: React.ReactNode;
  description?: React.ReactNode;
  /** Validation message shown below the label. */
  error?: string;
}) {
  const inputId = id ?? props.name;

  return (
    <div className="flex items-start gap-2.5">
      <input
        id={inputId}
        type="checkbox"
        aria-invalid={error ? true : undefined}
        aria-describedby={error && inputId ? `${inputId}-error` : undefined}
        className={cn(
          "mt-0.5 size-4 shrink-0 cursor-pointer rounded border-line-strong text-brand-link accent-brand-solid",
          "focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-solid",
          className,
        )}
        {...props}
      />
      <div className="min-w-0">
        <label
          htmlFor={inputId}
          className="cursor-pointer text-sm font-medium text-ink-soft"
        >
          {label}
        </label>
        {description ? (
          <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>
        ) : null}
        {error ? (
          <p
            id={inputId ? `${inputId}-error` : undefined}
            className="mt-1 text-[13px] text-danger-fg"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Toggle switch for settings toggles. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  id,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  id?: string;
  disabled?: boolean;
}) {
  const switchId = id ?? `switch-${String(label)}`;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label
          htmlFor={switchId}
          className={cn(
            "text-sm font-medium text-ink-soft",
            disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          )}
        >
          {label}
        </label>
        {description ? (
          <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>
        ) : null}
      </div>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === "string" ? label : undefined}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-brand-solid" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "inline-block size-4 transform rounded-full bg-surface shadow-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

/** Two-column form row used across settings and modal forms. */
export function FormRow({
  label,
  htmlFor,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:gap-6">
      <div>
        <Label htmlFor={htmlFor}>{label}</Label>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
