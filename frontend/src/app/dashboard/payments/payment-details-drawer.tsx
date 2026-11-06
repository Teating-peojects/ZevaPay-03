"use client";

import * as React from "react";
import Link from "next/link";
import { Ban } from "lucide-react";
import { PaymentStatusBadge } from "@/components/shared/payment-status-badge";
import { ProviderBadge } from "@/components/shared/provider-badge";
import { CopyableValue } from "@/components/shared/copyable-value";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatBDT, formatDateTime } from "@/lib/format";
import { TrxIdForm, type TrxMatch } from "./trxid-form";
import { statusDisplay } from "@/lib/payment-status";
import type { ApiPayment, ApiPaymentDetail } from "@/types/api";

const CANCELLABLE = ["CREATED", "PENDING", "REVIEW"];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-0">
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] text-ink">{children}</dd>
    </div>
  );
}

/**
 * What a payment's status means for the person looking at it. Payments settle
 * by matching a TrxID and amount with an SMS, so the generic wording written
 * for notifications does not fit these four statuses.
 */
function paymentNote(status: ApiPayment["status"]): { tone: "info" | "success" | "warning"; text: string } | null {
  switch (status) {
    case "CREATED":
      return { tone: "info", text: "No TrxID has been recorded yet. Enter the TrxID the customer gives you after paying." };
    case "PENDING":
      return { tone: "info", text: "A TrxID is recorded. Waiting for a matching SMS from your device." };
    case "REVIEW":
      return { tone: "warning", text: "An SMS with this TrxID was found, but something did not agree. Decide it under Transactions." };
    case "CONFIRMED":
      return { tone: "success", text: "The TrxID and amount matched an SMS your device recorded. This is not a check with bKash or Nagad." };
    default:
      return null;
  }
}

interface ActivityEntry {
  at: string;
  title: string;
  detail?: string;
}

/**
 * Builds the activity list from timestamps the API actually returns. No event
 * log exists for payments, so the final state is shown with `updatedAt`, which
 * is the last time the row changed, not necessarily the status change itself.
 */
function buildActivity(payment: ApiPaymentDetail): ActivityEntry[] {
  const entries: ActivityEntry[] = [
    { at: payment.createdAt, title: "Payment created" },
  ];
  for (const attempt of payment.attempts) {
    entries.push({
      at: attempt.createdAt,
      title: `Attempt through ${attempt.provider}`,
      detail: attempt.providerReference
        ? `TrxID ${attempt.providerReference}`
        : undefined,
    });
  }
  if (payment.confirmedAt) {
    entries.push({ at: payment.confirmedAt, title: "Confirmed from SMS" });
  } else if (["CANCELLED", "EXPIRED", "FAILED"].includes(payment.status)) {
    entries.push({
      at: payment.updatedAt,
      title: statusDisplay(payment.status).label,
      detail: "Last update to this payment",
    });
  }
  return entries.sort((a, b) => a.at.localeCompare(b.at));
}

/** What happened to the TrxID the merchant just submitted. */
function MatchResult({ match }: { match: TrxMatch }) {
  if (match.outcome === "approved") {
    return (
      <Alert tone="success" title="Payment confirmed from SMS">
        The TrxID and amount matched an SMS your device recorded. This is not a check with the provider.
      </Alert>
    );
  }
  if (match.outcome === "review") {
    return (
      <Alert tone="warning" title="Sent for review">
        <ul className="list-disc pl-4">
          {match.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <Link href="/dashboard/transactions" className="mt-1 inline-block font-medium underline">
          Open transactions
        </Link>
      </Alert>
    );
  }
  return (
    <Alert tone="info" title="Waiting for the SMS">
      No SMS with this TrxID has been recorded yet. The payment confirms by itself when it arrives, if the amount agrees.
    </Alert>
  );
}

/** Loads the full payment while the drawer is open. Keyed by id by the parent. */
function DrawerBody({
  payment,
  onChanged,
}: {
  payment: ApiPayment;
  onChanged: (payment: ApiPayment) => void;
}) {
  const [detail, setDetail] = React.useState<ApiPaymentDetail | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);
  // Bumped after a TrxID is submitted so the detail is loaded again.
  const [version, setVersion] = React.useState(0);
  const [lastMatch, setLastMatch] = React.useState<TrxMatch | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    apiFetch<{ data: ApiPaymentDetail }>(
      `/api/v1/merchant/payments/${payment.id}`,
      { signal: controller.signal },
    )
      .then((response) => {
        setFailed(null);
        setDetail(response.data);
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setFailed(
          caught instanceof ApiError
            ? caught.message
            : "The customer and attempts could not be loaded.",
        );
      });
    return () => controller.abort();
  }, [payment.id, version]);

  const display = statusDisplay(payment.status);
  const note = paymentNote(payment.status);
  const customer = detail?.customer ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-3xl font-semibold tracking-tight text-ink tabular-nums">
          {formatBDT(payment.amountMinor / 100)}
        </p>
        <PaymentStatusBadge status={payment.status} />
      </div>

      <Alert
        tone={note?.tone ?? (display.tone === "neutral" ? "info" : display.tone)}
        title={display.label}
      >
        {note?.text ?? display.description}
      </Alert>

      {lastMatch ? <MatchResult match={lastMatch} /> : null}

      {payment.status === "CREATED" || payment.status === "PENDING" ? (
        <TrxIdForm
          payment={payment}
          onResult={(fresh, match) => {
            setLastMatch(match);
            setVersion((current) => current + 1);
            onChanged(fresh);
          }}
        />
      ) : null}

      <dl>
        <Row label="Reference">
          <CopyableValue value={payment.reference} label="Payment reference" />
        </Row>
        <Row label="Description">{payment.description || "—"}</Row>
        <Row label="Customer">
          {detail ? (
            customer ? (
              <span className="block">
                <span className="block">{customer.name ?? "Unnamed"}</span>
                {customer.phone ? (
                  <span className="block text-[12px] text-ink-muted">{customer.phone}</span>
                ) : null}
              </span>
            ) : (
              "—"
            )
          ) : failed ? (
            "—"
          ) : (
            <span className="text-ink-muted">Loading…</span>
          )}
        </Row>
        <Row label="Created">{formatDateTime(payment.createdAt)}</Row>
        <Row label="Expires">
          {payment.expiresAt ? formatDateTime(payment.expiresAt) : "No expiry"}
        </Row>
        {payment.confirmedAt ? (
          <Row label="Confirmed">{formatDateTime(payment.confirmedAt)}</Row>
        ) : null}
      </dl>

      {failed ? (
        <Alert tone="warning" title="Some details are missing">
          {failed}
        </Alert>
      ) : null}

      <section aria-labelledby="payment-activity">
        <h3 id="payment-activity" className="mb-3 text-sm font-semibold text-ink">
          Activity
        </h3>
        {detail ? (
          <ol className="flex flex-col gap-3.5">
            {buildActivity(detail).map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="flex gap-3">
                <span
                  className="mt-1.5 size-2.5 shrink-0 rounded-full bg-brand-solid"
                  aria-hidden="true"
                />
                <div className="min-w-0 text-[13px]">
                  <p className="font-medium text-ink">{entry.title}</p>
                  {entry.detail ? (
                    <p className="text-ink-muted">{entry.detail}</p>
                  ) : null}
                  <p className="text-ink-muted">{formatDateTime(entry.at)}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : failed ? null : (
          <p className="text-[13px] text-ink-muted">Loading activity…</p>
        )}
      </section>

      {detail && detail.attempts.length > 0 ? (
        <section aria-labelledby="payment-attempts">
          <h3 id="payment-attempts" className="mb-2 text-sm font-semibold text-ink">
            Attempts
          </h3>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {detail.attempts.map((attempt) => (
              <li
                key={attempt.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
              >
                <ProviderBadge provider={attempt.provider} size="sm" />
                {attempt.providerReference ? (
                  <span className="font-mono text-[12px] text-ink-soft">
                    {attempt.providerReference}
                  </span>
                ) : null}
                <span className="text-[13px] font-medium text-ink tabular-nums">
                  {formatBDT(attempt.amountMinor / 100)}
                </span>
                <PaymentStatusBadge status={attempt.status} showTooltip={false} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function PaymentDetailsDrawer({
  payment,
  onClose,
  onCancel,
  onChanged,
}: {
  payment: ApiPayment | null;
  onClose: () => void;
  onCancel: (payment: ApiPayment) => void;
  /** Called with the fresh payment after a TrxID is submitted. */
  onChanged: (payment: ApiPayment) => void;
}) {
  return (
    <Drawer
      open={payment !== null}
      onClose={onClose}
      title="Payment details"
      description={payment?.reference}
      size="lg"
      footer={
        <>
          {payment && CANCELLABLE.includes(payment.status) ? (
            <Button variant="outline" onClick={() => onCancel(payment)} type="button">
              <Ban className="size-4" aria-hidden="true" />
              Cancel payment
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose} type="button">
            Close
          </Button>
        </>
      }
    >
      {payment ? <DrawerBody key={payment.id} payment={payment} onChanged={onChanged} /> : null}
    </Drawer>
  );
}
