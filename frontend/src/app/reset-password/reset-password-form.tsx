"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Label } from "@/components/ui/form";
import { ApiError, apiFetch } from "@/lib/api-client";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordStrength } from "@/components/auth/password-strength";
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from "@/lib/schemas";

/** Set a new password using the token from the reset link. */
export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const password = useWatch({ control, name: "password" });
  const confirmPassword = useWatch({ control, name: "confirmPassword" });

  if (done) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center rounded-lg border border-success-line bg-success-tint px-6 py-8 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-surface">
            <CircleCheck
              className="size-5 text-success-fg"
              aria-hidden="true"
            />
          </span>
          <p className="mt-4 text-[15px] font-semibold text-ink">
            Password updated
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            Sign in with your new password.
          </p>
        </div>

        <ButtonLink href="/login" className="w-full w-full">Back to login</ButtonLink>
      </div>
    );
  }

  async function onSubmit(values: ResetPasswordValues) {
    setFormError(null);
    try {
      await apiFetch("/api/v1/auth/reset-password", {
        method: "POST",
        body: { token, password: values.password },
      });
      setDone(true);
    } catch (caught) {
      setFormError(
        caught instanceof ApiError
          ? caught.message
          : "We could not reach the server. Try again.",
      );
    }
  }

  if (!token) {
    return (
      <Alert tone="warning" title="This link is incomplete">
        Open the reset link from your email again, or request a new one from the{" "}
        <Link href="/forgot-password" className="font-medium underline">
          forgot password
        </Link>{" "}
        page.
      </Alert>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5"
    >
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="password" required>
            New password
          </Label>
          <PasswordField
            id="password"
            autoComplete="new-password"
            placeholder="Create a new password"
            error={errors.password?.message}
            {...register("password")}
          />
          <PasswordStrength value={password ?? ""} />
        </div>

        <div>
          <Label htmlFor="confirmPassword" required>
            Confirm new password
          </Label>
          <PasswordField
            id="confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter your new password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
          {confirmPassword && !errors.confirmPassword ? (
            <p
              className={
                confirmPassword === password
                  ? "mt-1.5 text-[13px] text-success-text"
                  : "mt-1.5 text-[13px] text-ink-muted"
              }
            >
              {confirmPassword === password
                ? "The two passwords match."
                : "The two passwords do not match yet."}
            </p>
          ) : null}
        </div>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Save new password
        </Button>
      </div>
    </form>
  );
}
