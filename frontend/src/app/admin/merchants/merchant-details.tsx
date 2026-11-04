"use client";

import { Modal } from "@/components/ui/modal";
import { MerchantStatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatDateTime } from "@/lib/format";
import type { ApiMerchant } from "@/types/api";

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

/** Read-only merchant record for the admin console's details dialog. */
export function MerchantDetails({
  merchant,
  onClose,
}: {
  merchant: ApiMerchant | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={merchant !== null}
      onClose={onClose}
      title="Merchant details"
      description={merchant?.businessName}
      size="md"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-elevated"
        >
          Close
        </button>
      }
    >
      {merchant ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 rounded-lg border border-line bg-elevated px-4 py-4">
            <span className="text-[13px] text-ink-muted">Business name</span>
            <span className="text-lg font-semibold tracking-tight text-ink">
              {merchant.businessName}
            </span>
            <div className="mt-1.5">
              <MerchantStatusBadge status={merchant.status} />
            </div>
          </div>

          <div className="flex flex-col">
            <DetailRow label="Merchant ID">{merchant.id}</DetailRow>
            <DetailRow label="Owner name">{merchant.ownerName}</DetailRow>
            <DetailRow label="Email">{merchant.email}</DetailRow>
            <DetailRow label="Phone">{merchant.phone ?? "Not provided"}</DetailRow>
            <DetailRow label="Country">{merchant.country}</DetailRow>
            <DetailRow label="Plan">{merchant.plan}</DetailRow>
            <DetailRow label="Registered">
              {formatDate(merchant.registrationDate)}
            </DetailRow>
            <DetailRow label="Last active">
              {formatDateTime(merchant.lastActiveAt)}
            </DetailRow>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
