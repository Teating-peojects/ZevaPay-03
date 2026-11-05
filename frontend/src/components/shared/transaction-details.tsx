"use client";

import { ProviderBadge } from "@/components/shared/provider-badge";
import { TransactionStatusBadge } from "@/components/shared/status-badge";
import { Alert } from "@/components/ui/alert";
import { formatBDT, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ApiTransaction } from "@/types/api";

/** Below this the parser is treated as unsure and the record is queued. */
const LOW_CONFIDENCE = 0.8;

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

/** A value the parser could not read, shown so the gap is obvious. */
function NotFound({ children }: { children: React.ReactNode }) {
  return <span className="font-normal text-ink-faint">{children}</span>;
}

/**
 * How much of the message the parser could read.
 *
 * Deliberately neutral in colour: a high score must never look like a green
 * "verified" tick. It measures the parser's reading of the text, not whether
 * the money arrived.
 */
function ConfidenceMeter({ value }: { value: number }) {
  const percent = Math.round(value * 100);
  const low = value < LOW_CONFIDENCE;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-ink-soft">
          Parser confidence
        </span>
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            low ? "text-warning-fg" : "text-ink",
          )}
        >
          {percent}%
        </span>
      </div>
      <div
        role="meter"
        aria-label="Parser confidence"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 overflow-hidden rounded-full bg-elevated"
      >
        <div
          className={cn(
            "h-full rounded-full",
            low ? "bg-warning-500" : "bg-brand-solid",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-[12px] leading-relaxed text-ink-muted">
        How much of the message the parser could read. It is not a check with
        the provider.
      </p>
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

  // When a person accepts a record, the API stores confidence as 100%. That
  // number is no longer the parser's reading, so it is not shown as one.
  const acceptedByReviewer =
    transaction.status === "CONFIRMED" && transaction.reviewedAt !== null;
  const rejectedByReviewer =
    transaction.status === "FAILED" && transaction.reviewedAt !== null;

  // Fields a notification normally carries that the parser did not find.
  const missingFields = [
    transaction.customerName ? null : "Customer name",
    transaction.customerPhone ? null : "Customer phone",
    transaction.providerRef ? null : "Provider reference",
  ].filter((field): field is string => field !== null);

  const reviewVerb = acceptedByReviewer
    ? "Accepted by"
    : rejectedByReviewer
      ? "Rejected by"
      : "Reviewed by";

  return (
    <div className="flex flex-col gap-4">
      {awaitingReview ? (
        <Alert tone="warning">
          This notification was parsed with {confidencePercent}% confidence,
          which is below the auto-accept threshold. It is waiting for a
          decision from your team and has not been counted as a payment.
        </Alert>
      ) : acceptedByReviewer ? (
        <Alert tone="info">
          {transaction.reviewedByName ?? "A reviewer"} accepted this record
          after reading the notification. ZevaPay has not checked it with the
          provider.
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
        <span className="text-2xl font-semibold tracking-tight text-ink tabular-nums">
          {formatBDT(transaction.amount)}
        </span>
        <div className="mt-1.5 flex items-center gap-2">
          <ProviderBadge provider={transaction.provider} size="sm" />
          <TransactionStatusBadge status={transaction.status} />
        </div>
      </div>

      {acceptedByReviewer ? null : (
        <ConfidenceMeter value={transaction.confidence} />
      )}

      {missingFields.length > 0 ? (
        <Alert tone="warning">
          The parser did not find: {missingFields.join(", ").toLowerCase()}.
          Check the raw notification below before deciding.
        </Alert>
      ) : null}

      <div className="flex flex-col">
        <DetailRow label="Transaction ID">{transaction.reference}</DetailRow>
        {merchantName ? (
          <DetailRow label="Merchant">{merchantName}</DetailRow>
        ) : null}
        <DetailRow label="Payment method">
          <ProviderBadge provider={transaction.provider} size="sm" />
        </DetailRow>
        <DetailRow label="Customer name">
          {transaction.customerName ?? <NotFound>Not found in message</NotFound>}
        </DetailRow>
        <DetailRow label="Customer phone">
          {transaction.customerPhone ?? <NotFound>Not found in message</NotFound>}
        </DetailRow>
        <DetailRow label="Payment account">
          {transaction.accountLabel ?? <NotFound>Not linked</NotFound>}
        </DetailRow>
        <DetailRow label="Reporting device">
          {transaction.deviceName ?? <NotFound>Not linked</NotFound>}
        </DetailRow>
        <DetailRow label="Provider reference">
          {transaction.providerRef ?? <NotFound>Not found in message</NotFound>}
        </DetailRow>
        <DetailRow label="Occurred at">
          {formatDateTime(transaction.occurredAt)}
        </DetailRow>
        <DetailRow label="Recorded at">
          {formatDateTime(transaction.createdAt)}
        </DetailRow>
        {transaction.reviewedAt ? (
          <DetailRow label="Review">
            {reviewVerb} {transaction.reviewedByName ?? "a reviewer"} ·{" "}
            {formatDateTime(transaction.reviewedAt)}
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
