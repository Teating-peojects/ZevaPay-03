"use client";

import * as React from "react";
import { MonitorSmartphone, PlugZap } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DeviceStatusBadge } from "@/components/shared/status-badge";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { formatRelativeTime } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";
import { useServerTable } from "@/hooks/use-server-table";
import { useLiveEvents } from "@/hooks/use-live-events";
import type { ApiDevice, ApiPaymentAccount } from "@/types/api";
import { ConnectDeviceModal } from "./connect-device-modal";

export default function DevicesPage() {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [pendingDisconnect, setPendingDisconnect] = React.useState<ApiDevice | null>(
    null,
  );
  const [disconnecting, setDisconnecting] = React.useState(false);

  const table = useServerTable<ApiDevice>({
    path: "/api/v1/merchant/devices",
    pageSize: 10,
    buildQuery: (state) => ({
      q: state.query,
      status: state.filters.status,
    }),
  });

  const accounts = useServerTable<ApiPaymentAccount>({
    path: "/api/v1/merchant/accounts",
    pageSize: 50,
  });

  // A device pairing itself shows up in the list without a manual refresh.
  useLiveEvents((type) => {
    if (
      type === "device.paired" ||
      type === "device.updated" ||
      type === "device.removed"
    ) {
      table.refresh();
    }
  });

  async function handleDisconnect() {
    if (!pendingDisconnect) return;
    setDisconnecting(true);

    try {
      await apiFetch(`/api/v1/merchant/devices/${pendingDisconnect.id}`, {
        method: "DELETE",
      });
      toast({
        title: "Device disconnected",
        description: `${pendingDisconnect.name} was removed from this merchant.`,
        tone: "success",
      });
      setPendingDisconnect(null);
      table.refresh();
    } catch {
      toast({
        title: "Could not disconnect the device",
        description: "The device was not removed. Please try again.",
        tone: "error",
      });
    } finally {
      setDisconnecting(false);
    }
  }

  const columns: Column<ApiDevice>[] = [
    {
      key: "name",
      header: "Device name",
      render: (device) => (
        <span className="text-[13px] font-medium text-ink">{device.name}</span>
      ),
    },
    {
      key: "deviceId",
      header: "Device ID",
      render: (device) => (
        <span className="font-mono text-[13px] text-ink-soft">
          {device.deviceId}
        </span>
      ),
    },
    {
      key: "status",
      header: "Connection status",
      render: (device) => <DeviceStatusBadge status={device.status} />,
    },
    {
      key: "lastActive",
      header: "Last active",
      render: (device) => (
        <span className="text-[13px] text-ink-muted">
          {formatRelativeTime(device.lastActiveAt, Date.now())}
        </span>
      ),
    },
    {
      key: "account",
      header: "Connected account",
      render: (device) =>
        device.connectedAccountLabel ? (
          <span className="text-[13px] text-ink-soft">
            {device.connectedAccountLabel}
          </span>
        ) : (
          <span className="text-[13px] text-ink-faint">Not linked</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Devices"
        description="Android SMS Bridge devices that report payment notifications for this merchant."
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <PlugZap className="size-4" aria-hidden="true" />
            Connect device
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={table.rows}
        loading={table.loading}
        error={table.error ?? undefined}
        showSearch
        searchPlaceholder="Search by name or device ID"
        filters={[
          {
            id: "status",
            label: "All statuses",
            options: [
              { value: "ONLINE", label: "Online" },
              { value: "OFFLINE", label: "Offline" },
              { value: "PENDING", label: "Pending" },
            ],
          },
        ]}
        emptyTitle="No devices connected"
        emptyDescription="Connect your first Android SMS Bridge device to start recording payment notifications."
        emptyIcon={MonitorSmartphone}
        actions={(device) => [
          {
            label: "Disconnect device",
            icon: PlugZap,
            variant: "danger",
            onSelect: () => setPendingDisconnect(device),
          },
        ]}
        hideExport
        server={{
          total: table.total,
          page: table.page,
          pageSize: table.pageSize,
          query: table.query,
          filters: table.filters,
          onPageChange: table.setPage,
          onQueryChange: table.setQuery,
          onFilterChange: table.setFilter,
        }}
      />

      <ConnectDeviceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onPaired={table.refresh}
        accounts={accounts.rows}
      />

      <ConfirmDialog
        open={pendingDisconnect !== null}
        title="Disconnect device?"
        description={`This will remove "${pendingDisconnect?.name}" from this merchant. The physical device is not affected and can be paired again later.`}
        confirmLabel="Disconnect device"
        loading={disconnecting}
        onConfirm={handleDisconnect}
        onCancel={() => setPendingDisconnect(null)}
      />
    </div>
  );
}
