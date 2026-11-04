"use client";

import { Check, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { TransactionDetailsBody } from "@/components/shared/transaction-details";
import type { ApiTransaction } from "@/types/api";

/**
 * Read-only view of a single transaction record.
 *
 * Records are parsed provider notifications. They are never presented as
 * verified or settled payments — the confidence score shows how much of the
 * message the parser was able to read.
 */
export function TransactionDetailsModal({
  transaction,
  onClose,
  merchantName,
  onAccept,
  onReject,
  reviewing = false,
}: {
  transaction: ApiTransaction | null;
  onClose: () => void;
  /** Optional merchant label, shown in the merchant and admin views. */
  merchantName?: string;
  /** Shown when the record is waiting for a review decision. */
  onAccept?: () => void;
  onReject?: () => void;
  reviewing?: boolean;
}) {
  const awaitingReview = transaction?.status === "REVIEW";

  return (
    <Modal
      open={transaction !== null}
      onClose={onClose}
      title="Transaction details"
      description={transaction?.reference}
      size="md"
      footer={
        awaitingReview && (onAccept || onReject) ? (
          <>
            <Button
              variant="outline"
              onClick={onReject}
              loading={reviewing}
              type="button"
            >
              <X className="size-4" aria-hidden="true" />
              Reject
            </Button>
            <Button
              onClick={onAccept}
              loading={reviewing}
              type="button"
            >
              <Check className="size-4" aria-hidden="true" />
              Accept payment
            </Button>
          </>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-elevated"
          >
            Close
          </button>
        )
      }
    >
      {transaction ? (
        <TransactionDetailsBody
          transaction={transaction}
          merchantName={merchantName}
        />
      ) : null}
    </Modal>
  );
}
