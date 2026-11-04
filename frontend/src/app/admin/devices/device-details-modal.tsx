"use client";

import { Modal } from "@/components/ui/modal";
import { DeviceStatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatDateTime } from "@/lib/format";
import type { ApiDevice } from "@/types/api";

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

/** Read-only device record for the admin device details dialog. */
export function DeviceDetailsModal({
  device,
  merchantName,
  accountLabel,
  onClose,
}: {
  device: ApiDevice | null;
  merchantName?: string;
  accountLabel?: string;
  onClose: () => void;
}) {
  return (
    <Modal
      open={device !== null}
      onClose={onClose}
      title="Device details"
      description={device?.deviceId}
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
      {device ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 rounded-lg border border-line bg-elevated px-4 py-4">
            <span className="text-[13px] text-ink-muted">Device name</span>
            <span className="text-lg font-semibold tracking-tight text-ink">
              {device.name}
            </span>
            <div className="mt-1.5">
              <DeviceStatusBadge status={device.status} />
            </div>
          </div>

          <div className="flex flex-col">
            <DetailRow label="Device ID">{device.deviceId}</DetailRow>
            {merchantName ? (
              <DetailRow label="Merchant">{merchantName}</DetailRow>
            ) : null}
            <DetailRow label="Android version">
              {device.androidVersion ?? "Unknown"}
            </DetailRow>
            <DetailRow label="Connected account">
              {accountLabel ?? "Not linked"}
            </DetailRow>
            <DetailRow label="Connected on">
              {formatDate(device.connectedAt)}
            </DetailRow>
            <DetailRow label="Last active">
              {formatDateTime(device.lastActiveAt)}
            </DetailRow>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
