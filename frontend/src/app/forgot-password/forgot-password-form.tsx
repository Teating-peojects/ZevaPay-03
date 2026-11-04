"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input, Label } from "@/components/ui/form";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from "@/lib/schemas";
import { ApiError, apiFetch } from "@/lib/api-client";

/**
 * Password reset request.
 *
 * The API always reports success so the endpoint cannot be used to discover
 * which email addresses have accounts.
 */
export function ForgotPasswordForm() {
  const [sentEmail, setSentEmail] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordValues) {
    setFormError(null);

    try {
      await apiFetch<{ ok: boolean; message: string }>(
        "/api/v1/auth/forgot-password",
        { method: "POST", body: { email: values.email.trim() } },
      );
      setSentEmail(values.email.trim());
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "We could not reach the server. Please try again.",
      );
    }
  }

  if (sentEmail) {
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
            Check your email
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            If an account exists for{" "}
            <span className="font-medium text-ink-soft">{sentEmail}</span>, a
            reset link is on its way.
          </p>
        </div>

        <Alert tone="info" title="Email transport not configured">
          This deployment has no outbound email provider connected, so the
          reset link is not delivered. The request itself was recorded
          successfully.
        </Alert>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setSentEmail(null);
              reset();
            }}
          >
            Use a different email
          </Button>
          <Link href="/login" className="flex-1">
            <Button className="w-full">Back to login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {formError ? (
        <Alert tone="danger" className="mb-5" title="Could not send reset link">
          {formError}
        </Alert>
      ) : null}

      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="email" required>
            Email address
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            error={errors.email?.message}
            {...register("email")}
          />
        </div>

        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          Send reset link
        </Button>
      </div>
    </form>
  );
}
