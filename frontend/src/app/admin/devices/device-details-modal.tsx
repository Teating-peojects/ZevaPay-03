"use client";

import { Modal } from "@/components/ui/modal";
import { DeviceDetailsBody } from "@/components/shared/device-details";
import { Button } from "@/components/ui/button";
import type { ApiDevice } from "@/types/api";

/** Read-only device record for the admin device details dialog. */
export function DeviceDetailsModal({
  device,
  now,
  merchantName,
  onClose,
}: {
  device: ApiDevice | null;
  now: number;
  merchantName?: string;
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
        <Button variant="outline" onClick={onClose} type="button">
          Close
        </Button>
      }
    >
      {device ? (
        <DeviceDetailsBody
          device={device}
          now={now}
          merchantName={merchantName}
        />
      ) : null}
    </Modal>
  );
}
