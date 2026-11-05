"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ProviderBadge } from "@/components/shared/provider-badge";
import { apiFetch } from "@/lib/api-client";
import { formatBDT } from "@/lib/format";
import type { ApiTransaction } from "@/types/api";

export type ReviewDecision = "ACCEPT" | "REJECT";

/** The API accepts a reviewer note of up to this many characters. */
const NOTE_MAX_LENGTH = 500;

interface PendingReview {
  transaction: ApiTransaction;
  decision: ReviewDecision;
}

/**
 * Asks the reviewer to confirm an Accept or Reject decision.
 *
 * Accepting is the consequential one: the record becomes "confirmed from SMS"
 * and is counted as a payment. The wording says plainly what that means, and
 * what it does not. A human read a message; nobody asked bKash, Nagad, Rocket
 * or Upay.
 */
export function ReviewDecisionDialog({
  pending,
  note,
  onNoteChange,
  submitting,
  onConfirm,
  onCancel,
}: {
  pending: PendingReview | null;
  note: string;
  onNoteChange: (note: string) => void;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const accepting = pending?.decision === "ACCEPT";
  const transaction = pending?.transaction;
  const confidencePercent = transaction
    ? Math.round(transaction.confidence * 100)
    : 0;

  return (
    <Modal
      open={pending !== null}
      onClose={() => {
        if (!submitting) onCancel();
      }}
      title={accepting ? "Accept this payment?" : "Reject this payment?"}
      description={transaction?.reference}
      size="sm"
      footer={
        <>
          <Button
            variant="outline"
            type="button"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant={accepting ? "primary" : "danger"}
            type="button"
            onClick={onConfirm}
            loading={submitting}
          >
            {accepting ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <X className="size-4" aria-hidden="true" />
            )}
            {accepting ? "Accept payment" : "Reject payment"}
          </Button>
        </>
      }
    >
      {transaction ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-elevated px-4 py-3">
            <div className="flex flex-col">
              <span className="text-[13px] text-ink-muted">Amount</span>
              <span className="text-lg font-semibold tracking-tight text-ink tabular-nums">
                {formatBDT(transaction.amount)}
              </span>
            </div>
            <ProviderBadge provider={transaction.provider} size="sm" />
          </div>

          {accepting ? (
            <Alert tone="warning">
              You are confirming that you read the notification and it matches
              a payment you expect. The record will be marked{" "}
              <strong>confirmed from SMS</strong> and counted as a payment.
              The parser read it at {confidencePercent}% confidence, and
              ZevaPay has not checked it with the provider.
            </Alert>
          ) : (
            <Alert tone="info">
              The record will be marked as failed and will not be counted as a
              payment.
            </Alert>
          )}

          <div>
            <Label htmlFor="review-note">Note (optional)</Label>
            <Textarea
              id="review-note"
              name="note"
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              maxLength={NOTE_MAX_LENGTH}
              placeholder={
                accepting
                  ? "e.g. Amount and sender match the order"
                  : "e.g. Message looks altered or does not match any order"
              }
              hint={`Saved with your decision in the audit log. ${note.length}/${NOTE_MAX_LENGTH}`}
              disabled={submitting}
            />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

/**
 * The review flow shared by every screen that can accept or reject a record.
 *
 * `request()` opens the confirmation dialog; nothing is sent until the
 * reviewer confirms. Render the returned `dialog` once next to the list.
 */
export function useTransactionReview({
  scope,
  onReviewed,
}: {
  /** Which API the decision goes to: the admin's or the merchant's. */
  scope: "admin" | "merchant";
  /** Called after a decision is saved, to refresh the list and close views. */
  onReviewed: () => void;
}) {
  const { toast } = useToast();
  const [pending, setPending] = React.useState<PendingReview | null>(null);
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const request = React.useCallback(
    (transaction: ApiTransaction, decision: ReviewDecision) => {
      setNote("");
      setPending({ transaction, decision });
    },
    [],
  );

  const cancel = React.useCallback(() => {
    setPending(null);
  }, []);

  async function confirm() {
    if (!pending) return;
    const { transaction, decision } = pending;
    const trimmedNote = note.trim();

    setSubmitting(true);
    try {
      await apiFetch(`/api/v1/${scope}/transactions/${transaction.id}/review`, {
        method: "POST",
        body: trimmedNote ? { decision, note: trimmedNote } : { decision },
      });

      toast({
        title: decision === "ACCEPT" ? "Payment accepted" : "Payment rejected",
        description:
          decision === "ACCEPT"
            ? `${transaction.reference} was recorded as confirmed from a notification. It has not been checked against the provider's own records.`
            : `${transaction.reference} was marked as failed.`,
        tone: decision === "ACCEPT" ? "success" : "warning",
      });
      setPending(null);
      onReviewed();
    } catch {
      toast({
        title: "Could not save the decision",
        description: "The review was not saved. Please try again.",
        tone: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const dialog = (
    <ReviewDecisionDialog
      pending={pending}
      note={note}
      onNoteChange={setNote}
      submitting={submitting}
      onConfirm={() => void confirm()}
      onCancel={cancel}
    />
  );

  return { request, dialog, reviewing: submitting };
}
