"use client";

import * as React from "react";
import { Eye, MonitorSmartphone, Unplug } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DeviceHealthBadge } from "@/components/shared/device-health-badge";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { deviceHealth } from "@/lib/device-health";
import { formatRelativeTime } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";
import { useServerTable } from "@/hooks/use-server-table";
import { useLiveEvents } from "@/hooks/use-live-events";
import { useNow } from "@/hooks/use-now";
import type { ApiDevice } from "@/types/api";
import { DeviceDetailsModal } from "./device-details-modal";

export default function AdminDevicesPage() {
  const { toast } = useToast();
  const now = useNow();
  const [selected, setSelected] = React.useState<ApiDevice | null>(null);
  const [pendingDisconnect, setPendingDisconnect] = React.useState<ApiDevice | null>(
    null,
  );
  const [disconnecting, setDisconnecting] = React.useState(false);

  const table = useServerTable<ApiDevice>({
    path: "/api/v1/admin/devices",
    pageSize: 10,
    buildQuery: (state) => ({
      q: state.query,
      status: state.filters.status,
    }),
  });

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
      await apiFetch(`/api/v1/admin/devices/${pendingDisconnect.id}`, {
        method: "DELETE",
      });
      toast({
        title: "Device disconnected",
        description: `${pendingDisconnect.name} was removed from the platform.`,
        tone: "success",
      });
      setPendingDisconnect(null);
      setSelected(null);
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

  const notReporting = table.rows.filter(
    (device) => deviceHealth(device, now).needsAttention,
  );

  const columns: Column<ApiDevice>[] = [
    {
      key: "name",
      header: "Device name",
      render: (device) => (
        <span className="text-[13px] font-medium text-ink">{device.name}</span>
      ),
    },
    {
      key: "merchant",
      header: "Merchant",
      render: (device) => (
        <span className="text-[13px] text-ink-soft">
          {device.merchantName ?? "Unknown"}
        </span>
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
      header: "Connection",
      render: (device) => <DeviceHealthBadge device={device} now={now} />,
    },
    {
      key: "lastActive",
      header: "Last sync",
      render: (device) => (
        <span className="text-[13px] text-ink-muted">
          {formatRelativeTime(device.lastActiveAt, now)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Devices"
        description="Android SMS Bridge devices connected by merchants on the platform."
      />

      {notReporting.length > 0 ? (
        <Alert
          tone="warning"
          title={
            notReporting.length === 1
              ? "1 device on this page is not reporting"
              : `${notReporting.length} devices on this page are not reporting`
          }
        >
          Their merchants may not be recording payment notifications until the
          phones reconnect. Open a device to see its last sync.
        </Alert>
      ) : null}

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
        emptyTitle="No devices found"
        emptyDescription="Devices appear here once a merchant connects an Android SMS Bridge."
        emptyIcon={MonitorSmartphone}
        actions={(device) => [
          {
            label: "View details",
            icon: Eye,
            onSelect: () => setSelected(device),
          },
          {
            label: "Disconnect device",
            icon: Unplug,
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

      <DeviceDetailsModal
        device={selected}
        now={now}
        merchantName={selected?.merchantName ?? undefined}
        onClose={() => setSelected(null)}
      />

      <ConfirmDialog
        open={pendingDisconnect !== null}
        title="Disconnect device?"
        description={`This removes "${pendingDisconnect?.name}" from the platform. It will not be able to post notifications until the merchant pairs it again with a new code. Transactions it already reported are kept.`}
        confirmLabel="Disconnect device"
        loading={disconnecting}
        onConfirm={handleDisconnect}
        onCancel={() => setPendingDisconnect(null)}
      />
    </div>
  );
}
