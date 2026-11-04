"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiError } from "@/lib/api-client";
import { merchantProfileSchema, type MerchantProfileValues } from "@/lib/schemas";
import type { ApiMerchant, ApiUser } from "@/types/api";

export default function SettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [reload, setReload] = React.useState(0);

  const form = useForm<MerchantProfileValues>({
    resolver: zodResolver(merchantProfileSchema),
    defaultValues: { fullName: "", email: "", phone: "", businessName: "" },
  });
  const { reset } = form;

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<{ user: ApiUser }>("/api/v1/auth/me"),
      apiFetch<{ merchant: ApiMerchant }>("/api/v1/merchant/settings"),
    ])
      .then(([session, settings]) => {
        if (cancelled) return;
        reset({
          fullName: session.user.fullName,
          email: session.user.email,
          phone: session.user.phone ?? "",
          businessName: settings.merchant.businessName,
        });
      })
      .catch(() => {
        if (!cancelled) {
          toast({
            title: "Could not load your settings",
            description: "Refresh the page and try again.",
            tone: "error",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload, reset, toast]);

  async function onSubmit(values: MerchantProfileValues) {
    try {
      await apiFetch("/api/v1/auth/profile", {
        method: "PATCH",
        body: { fullName: values.fullName, email: values.email, phone: values.phone },
      });
      await apiFetch("/api/v1/merchant/settings", {
        method: "PATCH",
        body: { businessName: values.businessName },
      });
      toast({ title: "Settings saved", tone: "success" });
      setReload((n) => n + 1);
    } catch (caught) {
      if (caught instanceof ApiError) {
        for (const [field, message] of Object.entries(caught.fieldErrors)) {
          if (field in values) form.setError(field as keyof MerchantProfileValues, { message });
        }
      }
      toast({
        title: "Could not save your settings",
        description: caught instanceof ApiError ? caught.message : "Try again.",
        tone: "error",
      });
    }
  }

  const { errors, isSubmitting } = form.formState;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Your profile and business details." />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Shown across your ZevaPay account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex max-w-xl flex-col gap-5">
            <div>
              <Label htmlFor="profile-full-name" required>Full name</Label>
              <Input id="profile-full-name" disabled={loading} error={errors.fullName?.message} {...form.register("fullName")} />
            </div>
            <div>
              <Label htmlFor="profile-email" required>Email</Label>
              <Input id="profile-email" type="email" disabled={loading} error={errors.email?.message} {...form.register("email")} />
            </div>
            <div>
              <Label htmlFor="profile-phone">Mobile number</Label>
              <Input id="profile-phone" inputMode="numeric" placeholder="01712345678" disabled={loading} error={errors.phone?.message} {...form.register("phone")} />
            </div>
            <div>
              <Label htmlFor="profile-business" required>Business name</Label>
              <Input id="profile-business" disabled={loading} error={errors.businessName?.message} {...form.register("businessName")} />
            </div>
            <div>
              <Button type="submit" loading={isSubmitting}>Save changes</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
