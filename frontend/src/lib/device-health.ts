import type { ApiDevice } from "@/types/api";

/**
 * How long a device may go without syncing before it is flagged.
 *
 * The API marks a device ONLINE on every heartbeat but never marks it OFFLINE
 * when heartbeats stop, so the stored status alone can read "Online" for a
 * phone that died days ago. The console therefore also looks at the last
 * sync time. The heartbeat interval is not documented, so this threshold is a
 * conservative console assumption, not a server rule.
 */
export const SILENT_AFTER_MS = 15 * 60 * 1000;

export type DeviceHealthState = "online" | "silent" | "offline" | "pending";

export interface DeviceHealth {
  state: DeviceHealthState;
  label: string;
  tone: "success" | "warning" | "neutral";
  /** True when notifications from this device may not be getting through. */
  needsAttention: boolean;
}

/** The connection state to show, combining stored status and last sync. */
export function deviceHealth(
  device: Pick<ApiDevice, "status" | "lastActiveAt">,
  now: number,
): DeviceHealth {
  if (device.status === "PENDING") {
    return { state: "pending", label: "Pending", tone: "warning", needsAttention: false };
  }
  if (device.status === "OFFLINE") {
    return { state: "offline", label: "Offline", tone: "warning", needsAttention: true };
  }

  const silentFor = now - new Date(device.lastActiveAt).getTime();
  if (silentFor > SILENT_AFTER_MS) {
    return { state: "silent", label: "Not reporting", tone: "warning", needsAttention: true };
  }
  return { state: "online", label: "Online", tone: "success", needsAttention: false };
}
