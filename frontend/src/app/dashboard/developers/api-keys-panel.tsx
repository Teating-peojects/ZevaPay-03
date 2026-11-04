"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react";
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
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { apiKeySchema, type ApiKeyValues } from "@/lib/schemas";
import type { ApiApiKey } from "@/types/api";

/**
 * API keys, on the real API.
 *
 * The backend already covers `GET/POST/DELETE /api/v1/merchant/api-keys`, so
 * this panel talks to the real endpoint rather than the mock layer. The full
 * secret comes back exactly once, in the response to the create call; after
 * that only the prefix is ever visible.
 */
export function ApiKeysPanel() {
  const { toast } = useToast();
  const { copied, copy } = useCopyToClipboard();

  const [keys, setKeys] = React.useState<ApiApiKey[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [issuedSecret, setIssuedSecret] = React.useState<{
    name: string;
    secret: string;
  } | null>(null);
  const [revoking, setRevoking] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ApiKeyValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: { name: "" },
  });

  React.useEffect(() => {
    let cancelled = false;

    async function fetchKeys() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch<{ apiKeys: ApiApiKey[] }>(
          "/api/v1/merchant/api-keys",
        );
        if (cancelled) return;
        setKeys(response.apiKeys);
      } catch {
        if (cancelled) return;
        setError(
          "We could not reach the API to list your keys. The rest of this page still works.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchKeys();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  async function onCreate(values: ApiKeyValues) {
    try {
      const response = await apiFetch<{
        apiKey: ApiApiKey;
        secret: string;
      }>("/api/v1/merchant/api-keys", {
        method: "POST",
        body: { name: values.name.trim() },
      });

      setIssuedSecret({ name: response.apiKey.name, secret: response.secret });
      setCreateOpen(false);
      reset();
      setReloadToken((token) => token + 1);
    } catch {
      toast({
        title: "Could not create the key",
        description: "No key was created. Please try again.",
        tone: "error",
      });
    }
  }

  async function handleRevoke(key: ApiApiKey) {
    setRevoking(key.id);
    try {
      await apiFetch(`/api/v1/merchant/api-keys/${key.id}`, { method: "DELETE" });
      toast({
        title: "Key revoked",
        description: `${key.name} can no longer be used.`,
        tone: "success",
      });
      setReloadToken((token) => token + 1);
    } catch {
      toast({
        title: "Could not revoke the key",
        description: "The key is still active. Please try again.",
        tone: "error",
      });
    } finally {
      setRevoking(null);
    }
  }

  async function handleCopySecret() {
    if (!issuedSecret) return;
    const ok = await copy(issuedSecret.secret);
    toast({
      title: ok ? "Key copied" : "Could not copy",
      description: ok
        ? "The key is on your clipboard. Store it somewhere safe."
        : "Your browser blocked clipboard access. Select the key manually.",
      tone: ok ? "success" : "error",
    });
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>API keys</CardTitle>
            <CardDescription>
              Keys for reading your transaction data programmatically.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="shrink-0"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            New key
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? <Alert tone="danger">{error}</Alert> : null}

          {loading ? (
            <div className="flex flex-col gap-2">
              {[0, 1].map((index) => (
                <div
                  key={index}
                  className="h-12 animate-pulse rounded-lg bg-elevated"
                />
              ))}
            </div>
          ) : keys.length === 0 ? (
            <p className="text-[13px] text-ink-muted">
              You have no API keys yet. Create one to read your transaction
              history from your own systems.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {keys.map((key) => (
                <li
                  key={key.id}
                  className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink">
                      {key.name}
                    </p>
                    <p className="mt-0.5 font-mono text-[12px] text-ink-muted">
                      {key.keyPrefix}
                      <span className="ml-2 font-sans">
                        Created {formatDate(key.createdAt)}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {key.revokedAt ? (
                      <Badge tone="danger" dot>
                        Revoked
                      </Badge>
                    ) : (
                      <>
                        <span className="text-[12px] text-ink-muted">
                          {key.lastUsedAt
                            ? `Last used ${formatDate(key.lastUsedAt)}`
                            : "Never used"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleRevoke(key)}
                          loading={revoking === key.id}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                          Revoke
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Create key modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create API key"
        description="Give the key a name so you can recognise it later."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="developers-api-key-form" loading={isSubmitting}>
              Create key
            </Button>
          </>
        }
      >
        <form
          id="developers-api-key-form"
          onSubmit={handleSubmit(onCreate)}
          noValidate
        >
          <div>
            <Label htmlFor="developers-api-key-name" required>
              Key name
            </Label>
            <Input
              id="developers-api-key-name"
              placeholder="e.g. Reporting script"
              error={errors.name?.message}
              {...register("name")}
            />
          </div>
        </form>
      </Modal>

      {/* Issued secret modal */}
      <Modal
        open={issuedSecret !== null}
        onClose={() => setIssuedSecret(null)}
        title="Your new API key"
        description={issuedSecret?.name}
        size="sm"
        footer={
          <Button onClick={() => setIssuedSecret(null)}>Done</Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Alert tone="warning" title="Copy this now">
            This is the only time the full key is shown. If you lose it, revoke
            the key and create a new one.
          </Alert>

          <div className="flex items-center gap-3 rounded-lg border border-line bg-elevated px-4 py-3">
            <code className="flex-1 font-mono text-[13px] break-all text-ink">
              {issuedSecret?.secret}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopySecret}
              className="shrink-0"
            >
              {copied ? (
                <Check className="size-3.5 text-success-fg" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          <p className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-muted">
            <KeyRound
              className="mt-0.5 size-3.5 shrink-0 text-ink-faint"
              aria-hidden="true"
            />
            Treat the key like a password. ZevaPay only stores a hash of it, so
            it cannot be shown again.
          </p>
        </div>
      </Modal>
    </>
  );
}
