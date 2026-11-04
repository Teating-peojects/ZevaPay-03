"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PasswordStrength } from "@/components/auth/password-strength";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Label } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { changePasswordSchema, type ChangePasswordValues } from "@/lib/schemas";
import type { ApiSession } from "@/types/api";

export default function SecurityPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [sessions, setSessions] = React.useState<ApiSession[]>([]);
  const [sessionsError, setSessionsError] = React.useState<string | null>(null);
  const [signOutOpen, setSignOutOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const newPassword = useWatch({ control, name: "newPassword" });

  React.useEffect(() => {
    let cancelled = false;
    apiFetch<{ sessions: ApiSession[] }>("/api/v1/auth/sessions")
      .then((response) => {
        if (!cancelled) setSessions(response.sessions);
      })
      .catch((caught) => {
        if (!cancelled) {
          setSessionsError(caught instanceof ApiError ? caught.message : "Your sessions could not be loaded.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(values: ChangePasswordValues) {
    setFormError(null);
    try {
      await apiFetch("/api/v1/auth/change-password", {
        method: "POST",
        body: { currentPassword: values.currentPassword, newPassword: values.newPassword },
      });
      toast({ title: "Password changed", description: "Sign in again with your new password.", tone: "success" });
      router.push("/login");
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError) {
        const fields = caught.fieldErrors;
        if (fields.currentPassword) setError("currentPassword", { message: fields.currentPassword });
        else setFormError(caught.message);
      } else {
        setFormError("We could not reach the server. Try again.");
      }
    }
  }

  async function signOutEverywhere() {
    setSigningOut(true);
    try {
      await apiFetch("/api/v1/auth/logout-all", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (caught) {
      toast({
        title: "Could not sign out",
        description: caught instanceof ApiError ? caught.message : undefined,
        tone: "error",
      });
      setSigningOut(false);
      setSignOutOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Security" description="Your password and the devices signed in to your account." />

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>You will be signed out everywhere and asked to sign in again.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-md flex-col gap-4">
            {formError ? <Alert tone="danger">{formError}</Alert> : null}
            <div>
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                error={errors.currentPassword?.message}
                {...register("currentPassword")}
              />
            </div>
            <div>
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                error={errors.newPassword?.message}
                {...register("newPassword")}
              />
              <PasswordStrength value={newPassword ?? ""} className="mt-2" />
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                error={errors.confirmPassword?.message}
                {...register("confirmPassword")}
              />
            </div>
            <div>
              <Button type="submit" loading={isSubmitting}>
                Change password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Active sessions</CardTitle>
            <CardDescription>Browsers and devices currently signed in.</CardDescription>
          </div>
          <Button variant="outline" onClick={() => setSignOutOpen(true)}>
            <LogOut className="size-4" aria-hidden="true" />
            Sign out everywhere
          </Button>
        </CardHeader>
        <CardContent>
          {sessionsError ? (
            <Alert tone="danger">{sessionsError}</Alert>
          ) : sessions.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No active sessions.</p>
          ) : (
            <ul className="divide-y divide-line">
              {sessions.map((session) => (
                <li key={session.id} className="flex flex-col gap-0.5 py-3">
                  <span className="truncate text-[13px] text-ink">{session.userAgent ?? "Unknown device"}</span>
                  <span className="text-[12px] text-ink-muted">
                    {session.ipAddress ?? "Unknown IP"} · signed in {formatDateTime(session.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={signOutOpen}
        title="Sign out everywhere?"
        description="Every browser and device, including this one, will be signed out."
        confirmLabel="Sign out everywhere"
        loading={signingOut}
        onConfirm={() => void signOutEverywhere()}
        onCancel={() => setSignOutOpen(false)}
      />
    </div>
  );
}
