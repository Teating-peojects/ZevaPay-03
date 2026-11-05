"use client";

import * as React from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { PROVIDER_LIST } from "@/data/providers";
import type { ApiDevice, ApiPaymentAccount } from "@/types/api";

/**
 * Renames a device and changes the payment account it reports for, using
 * `PATCH /api/v1/merchant/devices/:id`.
 */
export function EditDeviceModal({
  device,
  accounts,
  onClose,
  onSaved,
}: {
  device: ApiDevice | null;
  accounts: ApiPaymentAccount[];
  onClose: () => void;
  onSaved: () => void;
}) {
  // Keyed by device so the form starts from that device's current values
  // every time it opens, without copying props into state in an effect.
  return device ? (
    <EditDeviceDialog
      key={device.id}
      device={device}
      accounts={accounts}
      onClose={onClose}
      onSaved={onSaved}
    />
  ) : null;
}

function EditDeviceDialog({
  device,
  accounts,
  onClose,
  onSaved,
}: {
  device: ApiDevice;
  accounts: ApiPaymentAccount[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = React.useState(device.name);
  const [accountId, setAccountId] = React.useState(
    device.connectedAccountId ?? "",
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const trimmed = name.trim();
  const nameError =
    trimmed.length < 2 ? "Enter a name of at least 2 characters." : undefined;
  const unchanged =
    trimmed === device.name &&
    accountId === (device.connectedAccountId ?? "");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (nameError) return;

    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/merchant/devices/${device.id}`, {
        method: "PATCH",
        body: { name: trimmed, connectedAccountId: accountId || null },
      });
      toast({
        title: "Device updated",
        description: `${trimmed} was saved.`,
        tone: "success",
      });
      onSaved();
      onClose();
    } catch {
      setError("The device was not updated. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => {
        if (!saving) onClose();
      }}
      title="Edit device"
      description={device.deviceId}
      size="sm"
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-device-form"
            loading={saving}
            disabled={unchanged || Boolean(nameError)}
          >
            Save changes
          </Button>
        </>
      }
    >
      <form
        id="edit-device-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        {error ? <Alert tone="danger">{error}</Alert> : null}

        <div>
          <Label htmlFor="edit-device-name" required>
            Device name
          </Label>
          <Input
            id="edit-device-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            error={name.length > 0 ? nameError : undefined}
            autoComplete="off"
          />
        </div>

        <div>
          <Label htmlFor="edit-device-account">Assigned account</Label>
          <Select
            id="edit-device-account"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            hint="Notifications from this device are attributed to this account."
          >
            <option value="">Not linked</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label} ·{" "}
                {PROVIDER_LIST.find((provider) => provider.id === account.provider)
                  ?.name ?? account.provider}
              </option>
            ))}
          </Select>
        </div>
      </form>
    </Modal>
  );
}
