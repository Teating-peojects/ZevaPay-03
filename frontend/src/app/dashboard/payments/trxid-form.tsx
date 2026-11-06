"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatBDT } from "@/lib/format";
import type { ApiPayment } from "@/types/api";

export interface TrxMatch {
  /** approved: confirmed. review: needs a person. waiting: no SMS yet. */
  outcome: "approved" | "review" | "waiting";
  reasons: string[];
}

interface AttemptResponse {
  data: { payment: ApiPayment; attemptId: string; match: TrxMatch };
}

const PROVIDERS = [
  { value: "BKASH", label: "bKash" },
  { value: "NAGAD", label: "Nagad" },
] as const;

/** Mirrors the server's cleaning, so a mistake is caught before sending. */
function cleanTrxId(raw: string): string | null {
  const cleaned = raw.trim().replace(/\s+/g, "").toUpperCase();
  return /^[A-Z0-9][A-Z0-9-]{3,29}$/.test(cleaned) ? cleaned : null;
}

/**
 * Records the TrxID a customer gave after paying, then asks the server to
 * match it with the SMS from the merchant's device. The match is decided on
 * the server; this form only submits and reports what came back.
 */
export function TrxIdForm({
  payment,
  onResult,
}: {
  payment: ApiPayment;
  onResult: (payment: ApiPayment, match: TrxMatch) => void;
}) {
  const { toast } = useToast();
  const [provider, setProvider] = React.useState<(typeof PROVIDERS)[number]["value"]>("BKASH");
  const [trxId, setTrxId] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const cleaned = cleanTrxId(trxId);
    if (!cleaned) {
      setError("Enter the TrxID exactly as in the confirmation message: 4 to 30 letters or numbers.");
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      const response = await apiFetch<AttemptResponse>(
        `/api/v1/merchant/payments/${payment.id}/attempts`,
        { method: "POST", body: { provider, trxId: cleaned } },
      );
      setTrxId("");
      toast({
        title:
          response.data.match.outcome === "approved"
            ? "Payment confirmed from SMS"
            : response.data.match.outcome === "review"
              ? "Sent for review"
              : "TrxID recorded",
        description:
          response.data.match.outcome === "waiting"
            ? "Waiting for the matching SMS from your device."
            : undefined,
        tone: response.data.match.outcome === "review" ? "warning" : "success",
      });
      onResult(response.data.payment, response.data.match);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "The TrxID could not be saved. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-3 rounded-lg border border-line bg-elevated p-4"
      noValidate
    >
      <div>
        <h3 className="text-sm font-semibold text-ink">Record the customer&rsquo;s TrxID</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          After the customer sends {formatBDT(payment.amountMinor / 100)}, enter the TrxID from
          their bKash or Nagad message. It is matched with the SMS your device records.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
        <div>
          <Label htmlFor={`provider-${payment.id}`}>Provider</Label>
          <Select
            id={`provider-${payment.id}`}
            value={provider}
            onChange={(event) =>
              setProvider(event.target.value as (typeof PROVIDERS)[number]["value"])
            }
          >
            {PROVIDERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`trxid-${payment.id}`} required>
            TrxID
          </Label>
          <Input
            id={`trxid-${payment.id}`}
            value={trxId}
            onChange={(event) => setTrxId(event.target.value)}
            placeholder="e.g. DK3508MJ4R"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="font-mono uppercase"
            error={error}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={busy}>
          Match payment
        </Button>
      </div>
    </form>
  );
}
