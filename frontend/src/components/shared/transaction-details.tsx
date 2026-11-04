"use client";

import { ProviderBadge } from "@/components/shared/provider-badge";
import { TransactionStatusBadge } from "@/components/shared/status-badge";
import { Alert } from "@/components/ui/alert";
import { formatBDT, formatDateTime } from "@/lib/format";
import type { ApiTransaction } from "@/types/api";

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <span className="text-[13px] text-ink-muted">{label}</span>
      <span className="text-[13px] font-medium text-ink sm:text-right">
        {children}
      </span>
    </div>
  );
}

/**
 * The body of a transaction detail view.
 *
 * Shared by the merchant's detail drawer and the admin's detail modal so the
 * two never drift apart.
 *
 * The wording is deliberate: a record is a parsed provider notification, and
 * the confidence score shows how much of the message the parser read. It is
 * never described as a verified or settled payment.
 */
export function TransactionDetailsBody({
  transaction,
  merchantName,
}: {
  transaction: ApiTransaction;
  /** Optional merchant label, shown in the admin view. */
  merchantName?: string;
}) {
  const confidencePercent = Math.round(transaction.confidence * 100);
  const awaitingReview = transaction.status === "REVIEW";

  return (
    <div className="flex flex-col gap-4">
      {awaitingReview ? (
        <Alert tone="warning">
          This notification was parsed with {confidencePercent}% confidence,
          which is below the auto-accept threshold. It is waiting for a
          decision from your team and has not been counted as a payment.
        </Alert>
      ) : (
        <Alert tone="info">
          Parsed from a provider notification with {confidencePercent}%
          confidence. ZevaPay reads the message; it does not settle the
          payment with the provider.
        </Alert>
      )}

      <div className="flex flex-col gap-1 rounded-lg border border-line bg-elevated px-4 py-4">
        <span className="text-[13px] text-ink-muted">Amount</span>
        <span className="text-2xl font-semibold tracking-tight text-ink">
          {formatBDT(transaction.amount)}
        </span>
        <div className="mt-1.5 flex items-center gap-2">
          <ProviderBadge provider={transaction.provider} size="sm" />
          <TransactionStatusBadge status={transaction.status} />
        </div>
      </div>

      <div className="flex flex-col">
        <DetailRow label="Transaction ID">{transaction.reference}</DetailRow>
        {merchantName ? (
          <DetailRow label="Merchant">{merchantName}</DetailRow>
        ) : null}
        <DetailRow label="Payment method">
          <ProviderBadge provider={transaction.provider} size="sm" />
        </DetailRow>
        <DetailRow label="Customer name">
          {transaction.customerName ?? "Not identified"}
        </DetailRow>
        <DetailRow label="Customer phone">
          {transaction.customerPhone ?? "Not identified"}
        </DetailRow>
        <DetailRow label="Payment account">
          {transaction.accountLabel ?? "Not linked"}
        </DetailRow>
        <DetailRow label="Reporting device">
          {transaction.deviceName ?? "Not linked"}
        </DetailRow>
        <DetailRow label="Provider reference">
          {transaction.providerRef ?? "Not found"}
        </DetailRow>
        <DetailRow label="Parser confidence">
          {confidencePercent}%
        </DetailRow>
        <DetailRow label="Occurred at">
          {formatDateTime(transaction.occurredAt)}
        </DetailRow>
        <DetailRow label="Recorded at">
          {formatDateTime(transaction.createdAt)}
        </DetailRow>
        {transaction.reviewedByName ? (
          <DetailRow label="Reviewed by">
            {transaction.reviewedByName} ·{" "}
            {transaction.reviewedAt ? formatDateTime(transaction.reviewedAt) : ""}
          </DetailRow>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-[13px] font-medium text-ink-soft">
          Raw notification
        </p>
        <pre className="scrollbar-thin overflow-x-auto rounded-lg border border-line bg-elevated px-3.5 py-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-ink-soft">
          {transaction.rawNotification}
        </pre>
      </div>
    </div>
  );
}
