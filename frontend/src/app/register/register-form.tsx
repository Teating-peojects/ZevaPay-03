"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Input, Label } from "@/components/ui/form";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordStrength } from "@/components/auth/password-strength";
import { registerSchema, type RegisterValues } from "@/lib/schemas";
import { ApiError, apiFetch } from "@/lib/api-client";
import type { SessionResponse } from "@/types/api";

export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      business: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      terms: false as unknown as true,
    },
  });

  const password = useWatch({ control, name: "password" });
  const confirmPassword = useWatch({ control, name: "confirmPassword" });

  async function onSubmit(values: RegisterValues) {
    setFormError(null);

    try {
      await apiFetch<SessionResponse>("/api/v1/auth/register", {
        method: "POST",
        body: {
          businessName: values.business,
          ownerName: values.name,
          email: values.email,
          phone: values.phone,
          password: values.password,
        },
      });

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        const fields = error.fieldErrors;
        if (fields.email) setError("email", { message: fields.email });
        if (fields.phone) setError("phone", { message: fields.phone });
        if (fields.password) setError("password", { message: fields.password });
        if (fields.businessName) {
          setError("business", { message: fields.businessName });
        }
        if (fields.ownerName) setError("name", { message: fields.ownerName });
        setFormError(error.message);
        return;
      }
      setFormError("We could not reach the server. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {formError ? (
        <Alert tone="danger" className="mb-5" title="Could not create account">
          {formError}
        </Alert>
      ) : null}

      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="name" required>
            Full name
          </Label>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Arif Hossain"
            error={errors.name?.message}
            {...register("name")}
          />
        </div>

        <div>
          <Label htmlFor="business" required>
            Business name
          </Label>
          <Input
            id="business"
            autoComplete="organization"
            placeholder="Sunrise Electronics"
            error={errors.business?.message}
            {...register("business")}
          />
        </div>

        <div>
          <Label htmlFor="email" required>
            Email
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
          <Label htmlFor="phone" required>
            Mobile number
          </Label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="01712345678"
            error={errors.phone?.message}
            {...register("phone")}
          />
        </div>

        <div>
          <Label htmlFor="password" required>
            Password
          </Label>
          <PasswordField
            id="password"
            autoComplete="new-password"
            placeholder="Create a password"
            error={errors.password?.message}
            {...register("password")}
          />
          <PasswordStrength value={password ?? ""} />
        </div>

        <div>
          <Label htmlFor="confirmPassword" required>
            Confirm password
          </Label>
          <PasswordField
            id="confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter your password"
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

        <div>
          <Checkbox
            id="terms"
            error={errors.terms?.message}
            label={
              <>
                I agree to the{" "}
                <Link
                  href="/terms"
                  className="font-medium text-brand-link underline underline-offset-2 hover:text-brand-link-hover"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="font-medium text-brand-link underline underline-offset-2 hover:text-brand-link-hover"
                >
                  Privacy Policy
                </Link>
              </>
            }
            {...register("terms")}
          />
        </div>

        <Button
          type="submit"
          size="lg"
          loading={isSubmitting}
          className="mt-1 w-full"
        >
          Create account
        </Button>
      </div>
    </form>
  );
}
