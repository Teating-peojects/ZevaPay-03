"use client";

import { Alert } from "@/components/ui/alert";
import { DeviceHealthBadge } from "@/components/shared/device-health-badge";
import { deviceHealth } from "@/lib/device-health";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/format";
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

/**
 * The body of a device detail view, shared by the merchant drawer and the
 * admin dialog so the two never drift apart.
 */
export function DeviceDetailsBody({
  device,
  now,
  merchantName,
}: {
  device: ApiDevice;
  now: number;
  /** Shown in the admin view. */
  merchantName?: string;
}) {
  const health = deviceHealth(device, now);

  return (
    <div className="flex flex-col gap-4">
      {health.needsAttention ? (
        <Alert tone="warning" title="This device may not be reporting">
          {health.state === "offline"
            ? "The device is marked offline."
            : `The last sync was ${formatRelativeTime(device.lastActiveAt, now)}.`}{" "}
          Payment notifications on this phone may not be recorded until it
          reconnects. Check that it has internet access and the ZevaPay app is
          running.
        </Alert>
      ) : null}

      <div className="flex flex-col gap-1 rounded-lg border border-line bg-elevated px-4 py-4">
        <span className="text-[13px] text-ink-muted">Device name</span>
        <span className="text-lg font-semibold tracking-tight text-ink">
          {device.name}
        </span>
        <div className="mt-1.5">
          <DeviceHealthBadge device={device} now={now} />
        </div>
      </div>

      <div className="flex flex-col">
        <DetailRow label="Device ID">
          <span className="font-mono">{device.deviceId}</span>
        </DetailRow>
        {merchantName ? (
          <DetailRow label="Merchant">{merchantName}</DetailRow>
        ) : null}
        <DetailRow label="Assigned account">
          {device.connectedAccountLabel ?? (
            <span className="font-normal text-ink-faint">Not linked</span>
          )}
        </DetailRow>
        <DetailRow label="Last sync">
          {formatRelativeTime(device.lastActiveAt, now)} ·{" "}
          {formatDateTime(device.lastActiveAt)}
        </DetailRow>
        <DetailRow label="Connected on">{formatDate(device.connectedAt)}</DetailRow>
        <DetailRow label="Android version">
          {device.androidVersion ?? (
            <span className="font-normal text-ink-faint">Unknown</span>
          )}
        </DetailRow>
      </div>

      <div className="rounded-lg border border-dashed border-line-strong px-4 py-4">
        <p className="text-[13px] font-medium text-ink-soft">Event history</p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
          A per-device event history is not available yet. The API does not
          record device events, so there is nothing to show here. Pairings and
          disconnections are in the audit log.
        </p>
      </div>
    </div>
  );
}
