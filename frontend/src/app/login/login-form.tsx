"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Input, Label } from "@/components/ui/form";
import { PasswordField } from "@/components/auth/password-field";
import { loginSchema, type LoginValues } from "@/lib/schemas";
import { ApiError, apiFetch } from "@/lib/api-client";
import { isPlatformRole } from "@/lib/roles";
import type { SessionResponse } from "@/types/api";

export function LoginForm() {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
  });

  async function onSubmit(values: LoginValues) {
    setFormError(null);

    try {
      const session = await apiFetch<SessionResponse>("/api/v1/auth/login", {
        method: "POST",
        body: {
          email: values.email,
          password: values.password,
          rememberMe: values.remember,
        },
      });

      // Platform administrators land in the admin console; everyone else in
      // the merchant dashboard.
      router.push(
        isPlatformRole(session.user.role) ? "/admin" : "/dashboard",
      );
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        const fields = error.fieldErrors;
        if (fields.email) setError("email", { message: fields.email });
        if (fields.password) setError("password", { message: fields.password });
        setFormError(error.message);
        return;
      }
      setFormError("We could not reach the server. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {formError ? (
        <Alert tone="danger" className="mb-5" title="Could not sign in">
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

        <div>
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password" required>
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="mb-1.5 text-[13px] font-medium text-brand-link transition-colors hover:text-brand-link-hover"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordField
            id="password"
            autoComplete="current-password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register("password")}
          />
        </div>

        <Checkbox
          id="remember"
          checked={undefined}
          error={errors.remember?.message}
          label="Keep me signed in"
          {...register("remember")}
        />

        <Button
          type="submit"
          size="lg"
          loading={isSubmitting}
          className="mt-1 w-full"
        >
          Sign in
        </Button>
      </div>
    </form>
  );
}
