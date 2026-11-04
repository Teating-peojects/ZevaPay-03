"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";
import {
  adminProfileSchema,
  type AdminProfileValues,
} from "@/lib/schemas";
import type { AdminSystemInfo, ApiUser } from "@/types/api";

export default function AdminSettingsPage() {
  const { toast } = useToast();

  const [user, setUser] = React.useState<ApiUser | null>(null);
  const [system, setSystem] = React.useState<AdminSystemInfo | null>(null);
  const [loading, setLoading] = React.useState(true);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AdminProfileValues>({
    resolver: zodResolver(adminProfileSchema),
    defaultValues: { fullName: "", email: "", phone: "" },
  });

  const load = React.useCallback(async () => {
    const [sessionResponse, settingsResponse] = await Promise.all([
      apiFetch<{ user: ApiUser }>("/api/v1/auth/me"),
      apiFetch<{ system: AdminSystemInfo }>("/api/v1/admin/settings"),
    ]);

    setUser(sessionResponse.user);
    setSystem(settingsResponse.system);
    reset({
      fullName: sessionResponse.user.fullName,
      email: sessionResponse.user.email,
      phone: sessionResponse.user.phone ?? "",
    });
  }, [reset]);

  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchSettings() {
      try {
        await load();
      } catch {
        if (cancelled) return;
        toast({
          title: "Could not load the settings",
          description: "Please refresh the page and try again.",
          tone: "error",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchSettings();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  async function onSave(values: AdminProfileValues) {
    try {
      await apiFetch("/api/v1/auth/profile", {
        method: "PATCH",
        body: {
          fullName: values.fullName,
          email: values.email,
          phone: values.phone,
        },
      });

      toast({
        title: "Profile updated",
        description: "Your administrator details were saved.",
        tone: "success",
      });
      setReloadToken((token) => token + 1);
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = error.fieldErrors;
        if (fieldErrors.fullName) {
          setError("fullName", { message: fieldErrors.fullName });
        }
        if (fieldErrors.email) setError("email", { message: fieldErrors.email });
        if (fieldErrors.phone) setError("phone", { message: fieldErrors.phone });
        toast({
          title: "Could not save the profile",
          description: error.message,
          tone: "error",
        });
        return;
      }
      toast({
        title: "Could not save the profile",
        description: "Please try again.",
        tone: "error",
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="System information and your administrator profile."
      />

      <Card>
        <CardHeader>
          <CardTitle>Administrator profile</CardTitle>
          <CardDescription>
            The name and email shown on your administrator account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSave)} noValidate>
            <div className="flex flex-col gap-5">
              <div>
                <Label htmlFor="admin-name" required>
                  Full name
                </Label>
                <Input
                  id="admin-name"
                  disabled={loading}
                  error={errors.fullName?.message}
                  {...register("fullName")}
                />
              </div>
              <div>
                <Label htmlFor="admin-email" required>
                  Email
                </Label>
                <Input
                  id="admin-email"
                  type="email"
                  disabled={loading}
                  error={errors.email?.message}
                  {...register("email")}
                />
              </div>
              <div>
                <Label htmlFor="admin-phone">Mobile number</Label>
                <Input
                  id="admin-phone"
                  inputMode="numeric"
                  placeholder="01712345678"
                  disabled={loading}
                  error={errors.phone?.message}
                  {...register("phone")}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" loading={isSubmitting}>
                  Save changes
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System information</CardTitle>
          <CardDescription>
            A live count of the records held by this ZevaPay installation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {system ? (
            <dl className="flex flex-col gap-3 text-[13px] sm:flex-row sm:flex-wrap sm:gap-x-12">
              <div>
                <dt className="text-ink-muted">Merchants</dt>
                <dd className="mt-0.5 font-medium text-ink">
                  {formatNumber(system.merchants)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Users</dt>
                <dd className="mt-0.5 font-medium text-ink">
                  {formatNumber(system.users)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Devices</dt>
                <dd className="mt-0.5 font-medium text-ink">
                  {formatNumber(system.devices)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Transactions</dt>
                <dd className="mt-0.5 font-medium text-ink">
                  {formatNumber(system.transactions)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Environment</dt>
                <dd className="mt-0.5 font-medium text-ink">
                  {system.environment}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-[13px] text-ink-muted">
              Loading system information…
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About this build</CardTitle>
          <CardDescription>
            A short note on the scope of the current release.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-elevated">
              <Info className="size-4 text-ink-soft" aria-hidden="true" />
            </span>
            <p className="text-[13px] leading-relaxed text-ink-soft">
              ZevaPay helps Bangladeshi merchants keep track of payments
              received through mobile financial services. Merchants connect their
              bKash, Nagad, Rocket, or Upay accounts and an Android SMS Bridge
              device, then review the notifications that get recorded. ZevaPay
              reads the notification — it never settles the payment with the
              provider, and it never asks for a PIN or an OTP.
            </p>
          </div>
        </CardContent>
      </Card>

      {user ? (
        <Card>
          <CardHeader>
            <CardTitle>Your account</CardTitle>
            <CardDescription>
              The role and sign-in details on this administrator account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3 text-[13px] sm:flex-row sm:flex-wrap sm:gap-x-12">
              <div>
                <dt className="text-ink-muted">Role</dt>
                <dd className="mt-0.5 font-medium text-ink">
                  {user.role.replace(/_/g, " ")}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Last sign-in</dt>
                <dd className="mt-0.5 font-medium text-ink">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleString("en-US")
                    : "First session"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
