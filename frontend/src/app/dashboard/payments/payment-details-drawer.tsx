"use client";

import { Ban } from "lucide-react";
import { PaymentStatusBadge } from "@/components/shared/payment-status-badge";
import { CopyableValue } from "@/components/shared/copyable-value";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { formatBDT, formatDateTime } from "@/lib/format";
import type { ApiPayment } from "@/types/api";

const CANCELLABLE = ["CREATED", "PENDING", "REVIEW"];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-0">
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] text-ink">{children}</dd>
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
      title={payment?.reference ?? "Payment"}
      description="Payment details"
      footer={
        payment && CANCELLABLE.includes(payment.status) ? (
          <Button variant="outline" onClick={() => onCancel(payment)}>
            <Ban className="size-4" aria-hidden="true" />
            Cancel payment
          </Button>
        ) : undefined
      }
    >
      {payment ? (
        <dl>
          <Row label="Status">
            <PaymentStatusBadge status={payment.status} />
          </Row>
          <Row label="Amount">{formatBDT(payment.amountMinor / 100)}</Row>
          <Row label="Reference">
            <CopyableValue value={payment.reference} label="Payment reference" />
          </Row>
          <Row label="Description">{payment.description || "—"}</Row>
          <Row label="Created">{formatDateTime(payment.createdAt)}</Row>
          <Row label="Expires">
            {payment.expiresAt ? formatDateTime(payment.expiresAt) : "—"}
          </Row>
          {payment.confirmedAt ? (
            <Row label="Confirmed">{formatDateTime(payment.confirmedAt)}</Row>
          ) : null}
        </dl>
      ) : null}
    </Drawer>
  );
}
