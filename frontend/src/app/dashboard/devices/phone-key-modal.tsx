"use client";

import * as React from "react";
import { Check, CircleCheck, Copy, Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

interface PhoneKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

/**
 * Connect a phone. The Android app asks for the merchant's email and password,
 * then for a phone key made here. A phone key can only connect a phone to the
 * SMS app: it cannot create payments, so it is safe to type on a phone and easy
 * to revoke. The full key is shown once, when it is made.
 */
export function PhoneKeyModal({
  open,
  onClose,
  onConnected,
  connected,
}: {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
  /** True once a phone has connected while this dialog was open. */
  connected: boolean;
}) {
  const { toast } = useToast();
  const { copied, copy } = useCopyToClipboard();
  const [keys, setKeys] = React.useState<PhoneKey[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [issued, setIssued] = React.useState<{ name: string; secret: string } | null>(null);
  const [reload, setReload] = React.useState(0);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      try {
        const response = await apiFetch<{ deviceKeys: PhoneKey[] }>(
          "/api/v1/merchant/device-keys",
        );
        if (cancelled) return;
        setKeys(response.deviceKeys);
        setLoadError(null);
      } catch {
        if (!cancelled) setLoadError("We could not load your phone keys.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, reload]);

  async function createKey(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    setCreating(true);
    try {
      const response = await apiFetch<{
        deviceKey: PhoneKey;
        secret: string;
      }>("/api/v1/merchant/device-keys", { method: "POST", body: { name: trimmed } });
      setIssued({ name: response.deviceKey.name, secret: response.secret });
      setName("");
      setReload((n) => n + 1);
    } catch {
      toast({
        title: "Could not make the key",
        description: "No key was made. Please try again.",
        tone: "error",
      });
    } finally {
      setCreating(false);
    }
  }

  async function removeKey(key: PhoneKey) {
    try {
      await apiFetch(`/api/v1/merchant/device-keys/${key.id}`, { method: "DELETE" });
      toast({
        title: "Key removed",
        description: `${key.name} can no longer be used to connect a phone.`,
        tone: "success",
      });
      setReload((n) => n + 1);
    } catch {
      toast({
        title: "Could not remove the key",
        description: "The key still works. Please try again.",
        tone: "error",
      });
    }
  }

  async function copySecret() {
    if (!issued) return;
    const ok = await copy(issued.secret);
    toast({
      title: ok ? "Key copied" : "Could not copy",
      description: ok
        ? "Paste it into the app on your phone."
        : "Your browser blocked clipboard access. Select the key by hand.",
      tone: ok ? "success" : "error",
    });
  }

  function finish() {
    setIssued(null);
    onConnected();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setIssued(null);
        onClose();
      }}
      title="Connect a phone"
      description="The ZevaPay SMS app asks for your email, your password and a phone key."
      size="md"
      footer={
        <Button type="button" onClick={finish}>
          Done
        </Button>
      }
    >
      {connected ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-success-tint">
            <CircleCheck className="size-6 text-success-fg" aria-hidden="true" />
          </span>
          <p className="text-base font-semibold text-ink">Phone connected</p>
          <p className="max-w-xs text-[13px] leading-relaxed text-ink-muted">
            The phone is now in your device list. The key you used still works
            for other phones until you remove it.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <Alert tone="info">
            A phone key can only connect a phone to the SMS app. It cannot
            create payments. If a phone is lost, remove its key here and
            disconnect the phone from the list.
          </Alert>

          {issued ? (
            <div className="flex flex-col gap-2 rounded-lg border border-line bg-elevated px-4 py-4">
              <p className="text-[13px] font-medium text-ink-soft">
                Your new key for “{issued.name}”
              </p>
              <div className="flex items-center gap-3">
                <code className="min-w-0 flex-1 break-all font-mono text-[13px] font-semibold text-ink">
                  {issued.secret}
                </code>
                <Button type="button" variant="outline" size="sm" onClick={copySecret}>
                  {copied ? (
                    <Check className="size-3.5 text-success-fg" aria-hidden="true" />
                  ) : (
                    <Copy className="size-3.5" aria-hidden="true" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-[12px] text-warning-fg">
                This is the only time the full key is shown. Copy it now.
              </p>
            </div>
          ) : (
            <form onSubmit={createKey} className="flex items-end gap-3">
              <div className="min-w-0 flex-1">
                <Label htmlFor="phone-key-name">Make a new key</Label>
                <Input
                  id="phone-key-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Shop counter phone"
                  maxLength={80}
                />
              </div>
              <Button type="submit" loading={creating} disabled={name.trim().length < 2}>
                <Plus className="size-4" aria-hidden="true" />
                Make key
              </Button>
            </form>
          )}

          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-soft">Your phone keys</p>
            {loadError ? <Alert tone="danger">{loadError}</Alert> : null}
            {keys.length === 0 && !loadError ? (
              <p className="text-[13px] text-ink-muted">No phone keys yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {keys.map((key) => (
                  <li key={key.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">{key.name}</p>
                      <p className="font-mono text-[12px] text-ink-muted">
                        {key.keyPrefix}
                        <span className="ml-2 font-sans">
                          {key.lastUsedAt
                            ? `Last used ${formatDate(key.lastUsedAt)}`
                            : `Made ${formatDate(key.createdAt)}`}
                        </span>
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeKey(key)}
                      aria-label={`Remove ${key.name}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ol className="flex flex-col gap-2.5">
            {[
              "Open the ZevaPay SMS app on the phone.",
              "Enter your ZevaPay address, email and password.",
              "Paste the phone key and tap Connect.",
              "The phone will show up in your device list.",
            ].map((step, index) => (
              <li key={step} className="flex gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-elevated text-[11px] font-semibold text-ink-soft">
                  {index + 1}
                </span>
                <span className="text-[13px] leading-relaxed text-ink-soft">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Modal>
  );
}
