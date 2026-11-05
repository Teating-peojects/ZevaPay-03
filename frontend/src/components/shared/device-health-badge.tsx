import { Badge } from "@/components/ui/badge";
import { deviceHealth } from "@/lib/device-health";
import type { ApiDevice } from "@/types/api";

/**
 * The connection state of a device, from its stored status and last sync.
 * See `deviceHealth` for why the stored status alone is not trusted.
 */
export function DeviceHealthBadge({
  device,
  now,
}: {
  device: Pick<ApiDevice, "status" | "lastActiveAt">;
  now: number;
}) {
  const health = deviceHealth(device, now);
  return (
    <Badge tone={health.tone} dot>
      {health.label}
    </Badge>
  );
}
