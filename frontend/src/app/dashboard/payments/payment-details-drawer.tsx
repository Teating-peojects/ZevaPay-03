"use client";

import * as React from "react";
import { Ban } from "lucide-react";
import { PaymentStatusBadge } from "@/components/shared/payment-status-badge";
import { ProviderBadge } from "@/components/shared/provider-badge";
import { CopyableValue } from "@/components/shared/copyable-value";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatBDT, formatDateTime } from "@/lib/format";
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
        ? `Reference ${attempt.providerReference}`
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

/** Loads the full payment while the drawer is open. Keyed by id by the parent. */
function DrawerBody({ payment }: { payment: ApiPayment }) {
  const [detail, setDetail] = React.useState<ApiPaymentDetail | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    apiFetch<{ data: ApiPaymentDetail }>(
      `/api/v1/merchant/payments/${payment.id}`,
      { signal: controller.signal },
    )
      .then((response) => setDetail(response.data))
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setFailed(
          caught instanceof ApiError
            ? caught.message
            : "The customer and attempts could not be loaded.",
        );
      });
    return () => controller.abort();
  }, [payment.id]);

  const display = statusDisplay(payment.status);
  const customer = detail?.customer ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-3xl font-semibold tracking-tight text-ink tabular-nums">
          {formatBDT(payment.amountMinor / 100)}
        </p>
        <PaymentStatusBadge status={payment.status} />
      </div>

      <Alert tone={display.tone === "neutral" ? "info" : display.tone} title={display.label}>
        {display.description}
      </Alert>

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
}: {
  payment: ApiPayment | null;
  onClose: () => void;
  onCancel: (payment: ApiPayment) => void;
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
      {payment ? <DrawerBody key={payment.id} payment={payment} /> : null}
    </Drawer>
  );
}
