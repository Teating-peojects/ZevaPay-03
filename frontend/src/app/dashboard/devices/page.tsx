"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, MonitorSmartphone, Pencil, PlugZap, Unplug } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { DeviceDetailsBody } from "@/components/shared/device-details";
import { DeviceHealthBadge } from "@/components/shared/device-health-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";
import { deviceHealth } from "@/lib/device-health";
import { formatRelativeTime } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";
import { useServerTable } from "@/hooks/use-server-table";
import { useLiveEvents } from "@/hooks/use-live-events";
import { useNow } from "@/hooks/use-now";
import type { ApiDevice, ApiPaymentAccount } from "@/types/api";
import { ConnectDeviceModal } from "./connect-device-modal";
import { EditDeviceModal } from "./edit-device-modal";

export default function DevicesPage() {
  const { toast } = useToast();
  const now = useNow();
  const [modalOpen, setModalOpen] = React.useState(false);
  // Set when a device pairs while the connect dialog is open.
  const [justPaired, setJustPaired] = React.useState(false);
  const [selected, setSelected] = React.useState<ApiDevice | null>(null);
  const [editing, setEditing] = React.useState<ApiDevice | null>(null);
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
    if (type === "device.paired") setJustPaired(true);
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
      key: "lastSync",
      header: "Last sync",
      render: (device) => (
        <span className="text-[13px] text-ink-muted">
          {formatRelativeTime(device.lastActiveAt, now)}
        </span>
      ),
    },
    {
      key: "account",
      header: "Assigned account",
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
          <Button
            onClick={() => {
              setJustPaired(false);
              setModalOpen(true);
            }}
          >
            <PlugZap className="size-4" aria-hidden="true" />

      <p className="-mt-2 text-[13px] text-ink-soft">
        New phone?{" "}
        <Link href="/dashboard/app" className="font-medium text-brand-link underline-offset-2 hover:underline">
          Install the app
        </Link>{" "}
        first, then connect it here.
      </p>
            Connect device
          </Button>
        }
      />

      {notReporting.length > 0 ? (
        <Alert
          tone="warning"
          title={
            notReporting.length === 1
              ? "1 device is not reporting"
              : `${notReporting.length} devices are not reporting`
          }
        >
          Payment notifications on {notReporting.map((device) => device.name).join(", ")}{" "}
          may not be recorded until {notReporting.length === 1 ? "it" : "they"}{" "}
          reconnect. Check that the phone has internet access and the ZevaPay
          app is running.
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
        emptyTitle="No devices connected"
        emptyDescription="Connect your first Android SMS Bridge device to start recording payment notifications."
        emptyIcon={MonitorSmartphone}
        actions={(device) => [
          {
            label: "View details",
            icon: Eye,
            onSelect: () => setSelected(device),
          },
          {
            label: "Edit device",
            icon: Pencil,
            onSelect: () => setEditing(device),
          },
          {
            label: "Disconnect device",
            icon: Unplug,
            variant: "danger",
            onSelect: () => setPendingDisconnect(device),
          },
        ]}
        onRowClick={(device) => setSelected(device)}
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

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Device details"
        description={selected?.deviceId}
        size="md"
        footer={
          selected ? (
            <>
              <Button
                variant="outline"
                type="button"
                onClick={() => setPendingDisconnect(selected)}
              >
                <Unplug className="size-4" aria-hidden="true" />
                Disconnect
              </Button>
              <Button type="button" onClick={() => setEditing(selected)}>
                <Pencil className="size-4" aria-hidden="true" />
                Edit device
              </Button>
            </>
          ) : null
        }
      >
        {selected ? <DeviceDetailsBody device={selected} now={now} /> : null}
      </Drawer>

      <ConnectDeviceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onPaired={table.refresh}
        accounts={accounts.rows}
        paired={justPaired}
      />

      <EditDeviceModal
        device={editing}
        accounts={accounts.rows}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setSelected(null);
          table.refresh();
        }}
      />

      <ConfirmDialog
        open={pendingDisconnect !== null}
        title="Disconnect device?"
        description={`This removes "${pendingDisconnect?.name}" from your business. It will not be able to post notifications until it is paired again with a new code. Transactions it already reported are kept.`}
        confirmLabel="Disconnect device"
        loading={disconnecting}
        onConfirm={handleDisconnect}
        onCancel={() => setPendingDisconnect(null)}
      />
    </div>
  );
}
