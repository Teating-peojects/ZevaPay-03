"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { ApiSupport } from "@/types/api";

const FIELDS = [
  { key: "whatsapp", label: "WhatsApp number", placeholder: "01712345678", hint: "With or without the country code." },
  { key: "telegram", label: "Telegram username", placeholder: "@myshop", hint: "Or paste your t.me link." },
  { key: "facebook", label: "Facebook page", placeholder: "myshop", hint: "The page name, or paste the page link." },
  { key: "instagram", label: "Instagram username", placeholder: "@myshop", hint: "Or paste your profile link." },
] as const;

type Key = (typeof FIELDS)[number]["key"];
type Values = Record<Key, string>;
const EMPTY: Values = { whatsapp: "", telegram: "", facebook: "", instagram: "" };

/** How customers reach the merchant. Shown on the checkout page when a customer is stuck. */
export function SupportCard() {
  const { toast } = useToast();
  const [values, setValues] = React.useState<Values>(EMPTY);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await apiFetch<ApiSupport>("/api/v1/merchant/support");
        if (cancelled) return;
        setValues({
          whatsapp: response.support.whatsapp ?? "",
          telegram: response.support.telegram ?? "",
          facebook: response.support.facebook ?? "",
          instagram: response.support.instagram ?? "",
        });
      } catch {
        if (!cancelled) setError("We could not load your support contacts.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch<ApiSupport>("/api/v1/merchant/support", {
        method: "PUT",
        body: values,
      });
      // Show what was stored, which may be cleaner than what was typed.
      setValues({
        whatsapp: response.support.whatsapp ?? "",
        telegram: response.support.telegram ?? "",
        facebook: response.support.facebook ?? "",
        instagram: response.support.instagram ?? "",
      });
      toast({ title: "Support contacts saved", tone: "success" });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Support contacts</CardTitle>
        <CardDescription>
          Shown to your customers on the payment page when a payment does not go through, so they can
          message you. Leave a field empty to hide it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void save(event)} noValidate className="flex max-w-xl flex-col gap-5">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <Label htmlFor={`support-${field.key}`}>{field.label}</Label>
              <Input
                id={`support-${field.key}`}
                value={values[field.key]}
                disabled={loading}
                placeholder={field.placeholder}
                autoComplete="off"
                hint={field.hint}
                onChange={(event) => setValues((previous) => ({ ...previous, [field.key]: event.target.value }))}
              />
            </div>
          ))}
          {error ? (
            <p role="alert" className="text-[13px] text-danger-fg">
              {error}
            </p>
          ) : null}
          <div>
            <Button type="submit" loading={saving} disabled={loading}>
              Save contacts
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
