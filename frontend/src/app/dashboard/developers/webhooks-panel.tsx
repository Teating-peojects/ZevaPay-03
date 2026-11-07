"use client";

import * as React from "react";
import { Check, Copy, Plus, Send, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDateTimeShort } from "@/lib/format";
import type { ApiWebhook, ApiWebhookDelivery } from "@/types/api";

const EVENT_LABEL: Record<string, string> = {
  "payment.confirmed": "Payment confirmed",
  "payment.review": "Payment needs review",
  "webhook.test": "Test",
};

function DeliveryList({ id }: { id: string }) {
  const [rows, setRows] = React.useState<ApiWebhookDelivery[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    apiFetch<{ deliveries: ApiWebhookDelivery[] }>(
      `/api/v1/merchant/webhooks/${id}/deliveries`,
    )
      .then((response) => !cancelled && setRows(response.deliveries))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (failed) return <p className="text-[12px] text-ink-muted">Could not load recent deliveries.</p>;
  if (!rows) return <p className="text-[12px] text-ink-muted">Loading…</p>;
  if (rows.length === 0) return <p className="text-[12px] text-ink-muted">Nothing has been sent yet.</p>;

  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-1 px-3 py-2 text-[12px] sm:flex-row sm:items-center sm:justify-between">
          <span className="text-ink">
            {EVENT_LABEL[row.event] ?? row.event}
            <span className="ml-2 text-ink-muted">{formatDateTimeShort(row.createdAt)}</span>
          </span>
          <span className="flex items-center gap-2">
            <Badge
              tone={row.status === "DELIVERED" ? "success" : row.status === "FAILED" ? "danger" : "warning"}
              dot
            >
              {row.status === "DELIVERED" ? "Delivered" : row.status === "FAILED" ? "Failed" : "Retrying"}
            </Badge>
            <span className="text-ink-muted">
              {row.attempts} {row.attempts === 1 ? "try" : "tries"}
              {row.responseCode ? ` · HTTP ${row.responseCode}` : ""}
            </span>
          </span>
          {row.status !== "DELIVERED" && row.lastError ? (
            <span className="text-ink-muted sm:basis-full">{row.lastError}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Webhook addresses: where ZevaPay tells your server a payment changed. */
export function WebhooksPanel() {
  const { toast } = useToast();
  const { copied, copy } = useCopyToClipboard();

  const [hooks, setHooks] = React.useState<ApiWebhook[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reload, setReload] = React.useState(0);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [urlError, setUrlError] = React.useState<string | undefined>();
  const [saving, setSaving] = React.useState(false);
  const [issued, setIssued] = React.useState<string | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await apiFetch<{ webhooks: ApiWebhook[] }>("/api/v1/merchant/webhooks");
        if (cancelled) return;
        setHooks(response.webhooks);
        setError(null);
      } catch {
        if (!cancelled) setError("We could not load your webhook addresses.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setUrlError(undefined);
    if (!url.trim()) {
      setUrlError("Enter the address that should receive events.");
      return;
    }
    setSaving(true);
    try {
      const response = await apiFetch<{ webhook: ApiWebhook; secret: string }>(
        "/api/v1/merchant/webhooks",
        { method: "POST", body: { url: url.trim() } },
      );
      setIssued(response.secret);
      setCreateOpen(false);
      setUrl("");
      setReload((n) => n + 1);
    } catch (caught) {
      setUrlError(caught instanceof ApiError ? caught.message : "Could not add the address. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function act(id: string, run: () => Promise<unknown>, done: string, failure: string) {
    setBusyId(id);
    try {
      await run();
      toast({ title: done, tone: "success" });
      setReload((n) => n + 1);
    } catch (caught) {
      toast({
        title: failure,
        description: caught instanceof ApiError ? caught.message : undefined,
        tone: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Webhooks</CardTitle>
            <CardDescription>
              ZevaPay sends a signed message to your server when a payment is
              confirmed or needs review, so you do not have to keep asking.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" aria-hidden="true" />
            Add address
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {loading ? (
            <div className="h-12 animate-pulse rounded-lg bg-elevated" />
          ) : hooks.length === 0 ? (
            <p className="text-[13px] text-ink-muted">
              No webhook address yet. Your server can still check a payment with
              the status call.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {hooks.map((hook) => (
                <li key={hook.id} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-mono text-[13px] break-all text-ink">{hook.url}</p>
                      <p className="mt-0.5 text-[12px] text-ink-muted">
                        {hook.events.map((e) => EVENT_LABEL[e] ?? e).join(", ")}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Badge tone={hook.isActive ? "success" : "neutral"} dot>
                        {hook.isActive ? "On" : "Off"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={busyId === hook.id}
                        onClick={() =>
                          void act(
                            hook.id,
                            () => apiFetch(`/api/v1/merchant/webhooks/${hook.id}/test`, { method: "POST" }),
                            "Test event queued",
                            "Could not queue a test",
                          )
                        }
                      >
                        <Send className="size-3.5" aria-hidden="true" />
                        Send test
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === hook.id}
                        onClick={() =>
                          void act(
                            hook.id,
                            () =>
                              apiFetch(`/api/v1/merchant/webhooks/${hook.id}`, {
                                method: "PATCH",
                                body: { isActive: !hook.isActive },
                              }),
                            hook.isActive ? "Webhook turned off" : "Webhook turned on",
                            "Could not change the webhook",
                          )
                        }
                      >
                        {hook.isActive ? "Turn off" : "Turn on"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === hook.id}
                        onClick={() =>
                          void act(
                            hook.id,
                            () => apiFetch(`/api/v1/merchant/webhooks/${hook.id}`, { method: "DELETE" }),
                            "Webhook removed",
                            "Could not remove the webhook",
                          )
                        }
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        Remove
                      </Button>
                    </div>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="text-[12px] font-medium text-brand underline-offset-2 hover:underline"
                      aria-expanded={openId === hook.id}
                      onClick={() => setOpenId(openId === hook.id ? null : hook.id)}
                    >
                      {openId === hook.id ? "Hide recent deliveries" : "Show recent deliveries"}
                    </button>
                    {openId === hook.id ? (
                      <div className="mt-2">
                        <DeliveryList id={hook.id} />
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add a webhook address"
        description="It must start with https:// and be reachable from the internet."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="webhook-form" loading={saving}>
              Add address
            </Button>
          </>
        }
      >
        <form id="webhook-form" onSubmit={(e) => void create(e)} noValidate>
          <Label htmlFor="webhook-url" required>
            Address
          </Label>
          <Input
            id="webhook-url"
            type="url"
            inputMode="url"
            placeholder="https://your-shop.example/zevapay-webhook"
            value={url}
            error={urlError}
            onChange={(e) => setUrl(e.target.value)}
          />
        </form>
      </Modal>

      <Modal
        open={issued !== null}
        onClose={() => setIssued(null)}
        title="Your signing secret"
        size="sm"
        footer={<Button onClick={() => setIssued(null)}>Done</Button>}
      >
        <div className="flex flex-col gap-4">
          <Alert tone="warning" title="Copy this now">
            Use it to check the ZevaPay-Signature header on every message. It
            is shown only once. If you lose it, remove the address and add it
            again.
          </Alert>
          <div className="flex items-center gap-3 rounded-lg border border-line bg-elevated px-4 py-3">
            <code className="flex-1 font-mono text-[13px] break-all text-ink">{issued}</code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => issued && void copy(issued)}
            >
              {copied ? (
                <Check className="size-3.5 text-success-fg" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
