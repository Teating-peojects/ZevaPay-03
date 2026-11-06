"use client";

import * as React from "react";
import { Ban, Eye, Plus, Receipt } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentStatusBadge } from "@/components/shared/payment-status-badge";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatBDT, formatDateTimeShort } from "@/lib/format";
import { STATUS_FILTER_OPTIONS } from "@/lib/payment-status";
import { dateRangeBounds, type DateRange } from "@/lib/date-range";
import { useServerTable } from "@/hooks/use-server-table";
import type { ApiPayment } from "@/types/api";
import { NewPaymentModal } from "./new-payment-modal";
import { PaymentDetailsDrawer } from "./payment-details-drawer";

const CANCELLABLE = ["CREATED", "PENDING", "REVIEW"];

export default function PaymentsPage() {
  const { toast } = useToast();
  const [selected, setSelected] = React.useState<ApiPayment | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [cancelling, setCancelling] = React.useState<ApiPayment | null>(null);
  const [busy, setBusy] = React.useState(false);

  // The API filters payments by status only. Search and the date range are
  // applied to the page of rows the table holds, and the hint says so.
  const [query, setQuery] = React.useState("");
  const [dateRange, setDateRange] = React.useState<DateRange>("all");

  const table = useServerTable<ApiPayment>({
    path: "/api/v1/merchant/payments",
    pageSize: 10,
    buildQuery: (state) => ({ status: state.filters.status }),
  });

  const visibleRows = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    const { from } = dateRangeBounds(dateRange);
    return table.rows.filter((payment) => {
      if (from && payment.createdAt < from) return false;
      if (!needle) return true;
      return (
        payment.reference.toLowerCase().includes(needle) ||
        (payment.description ?? "").toLowerCase().includes(needle)
      );
    });
    // `Date.now()` inside dateRangeBounds is read when the filter changes.
  }, [table.rows, query, dateRange]);

  async function confirmCancel() {
    if (!cancelling) return;
    setBusy(true);
    try {
      await apiFetch(`/api/v1/merchant/payments/${cancelling.id}/status`, {
        method: "PATCH",
        body: { status: "CANCELLED" },
      });
      toast({ title: "Payment cancelled", tone: "success" });
      setCancelling(null);
      setSelected(null);
      table.refresh();
    } catch (caught) {
      toast({
        title: "Could not cancel the payment",
        description: caught instanceof ApiError ? caught.message : undefined,
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<ApiPayment>[] = [
    {
      key: "reference",
      header: "Payment",
      render: (payment) => (
        <span className="font-mono text-[13px] font-medium text-ink">
          {payment.reference}
        </span>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (payment) => (
        <span className="text-[13px] text-ink-soft">
          {payment.description || "—"}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (payment) => (
        <span className="font-medium text-ink">
          {formatBDT(payment.amountMinor / 100)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (payment) => <PaymentStatusBadge status={payment.status} />,
    },
    {
      key: "created",
      header: "Created",
      align: "right",
      render: (payment) => (
        <span className="text-[13px] text-ink-muted">
          {formatDateTimeShort(payment.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payments"
        description="Payments you have raised. Recorded notifications from your devices are listed under Transactions."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden="true" />
            New payment
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={visibleRows}
        loading={table.loading}
        error={table.error ?? undefined}
        showSearch
        searchPlaceholder="Search by reference or description"
        showDateFilter
        filters={[
          {
            id: "status",
            label: "All statuses",
            options: STATUS_FILTER_OPTIONS,
          },
        ]}
        emptyTitle="No payments yet"
        emptyDescription="Create a payment to start tracking what you expect to collect."
        emptyIcon={Receipt}
        actions={(payment) => [
          { label: "View details", icon: Eye, onSelect: () => setSelected(payment) },
          ...(CANCELLABLE.includes(payment.status)
            ? [
                {
                  label: "Cancel payment",
                  icon: Ban,
                  variant: "danger" as const,
                  onSelect: () => setCancelling(payment),
                },
              ]
            : []),
        ]}
        onRowClick={(payment) => setSelected(payment)}
        hideExport
        server={{
          total: table.total,
          page: table.page,
          pageSize: table.pageSize,
          filters: table.filters,
          query,
          dateRange,
          onPageChange: table.setPage,
          onQueryChange: setQuery,
          onFilterChange: table.setFilter,
          onDateRangeChange: setDateRange,
          hint: "Search and date range apply to the payments on this page. The API filters by status only.",
        }}
      />

      <PaymentDetailsDrawer
        payment={selected}
        onClose={() => setSelected(null)}
        onCancel={(payment) => setCancelling(payment)}
        onChanged={(payment) => {
          setSelected(payment);
          table.refresh();
        }}
      />

      <NewPaymentModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          table.refresh();
        }}
      />

      <ConfirmDialog
        open={cancelling !== null}
        title="Cancel this payment?"
        description="The payment will be marked as cancelled. This cannot be undone."
        confirmLabel="Cancel payment"
        loading={busy}
        onConfirm={() => void confirmCancel()}
        onCancel={() => setCancelling(null)}
      />
    </div>
  );
}
