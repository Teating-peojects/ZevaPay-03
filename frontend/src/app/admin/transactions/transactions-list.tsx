"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Check, Eye, Receipt, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ProviderBadge } from "@/components/shared/provider-badge";
import { TransactionStatusBadge } from "@/components/shared/status-badge";
import { DataTable, type Column } from "@/components/shared/data-table";
import { LiveIndicator } from "@/components/shared/live-indicator";
import { TransactionDetailsModal } from "@/components/shared/transaction-details-modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { formatBDT, formatDateTimeShort } from "@/lib/format";
import { dateRangeBounds } from "@/lib/date-range";
import { STATUS_FILTER_OPTIONS } from "@/lib/payment-status";
import { useServerTable } from "@/hooks/use-server-table";
import { useLiveEvents } from "@/hooks/use-live-events";
import type { ApiTransaction } from "@/types/api";

export function AdminTransactionsList() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [selected, setSelected] = React.useState<ApiTransaction | null>(null);
  const [reviewing, setReviewing] = React.useState(false);

  const table = useServerTable<ApiTransaction>({
    path: "/api/v1/admin/transactions",
    pageSize: 10,
    initialQuery: searchParams.get("q") ?? "",
    buildQuery: (state) => {
      const bounds = dateRangeBounds(state.dateRange);
      return {
        q: state.query,
        status: state.filters.status,
        provider: state.filters.provider,
        merchantId: state.filters.merchantId,
        from: bounds.from,
        to: bounds.to,
      };
    },
  });

  const liveStatus = useLiveEvents((type) => {
    if (type === "transaction.created" || type === "transaction.reviewed") {
      table.refresh();
    }
  });

  async function handleReview(
    transaction: ApiTransaction,
    decision: "ACCEPT" | "REJECT",
  ) {
    setReviewing(true);
    try {
      await apiFetch(`/api/v1/admin/transactions/${transaction.id}/review`, {
        method: "POST",
        body: { decision },
      });
      toast({
        title: decision === "ACCEPT" ? "Payment accepted" : "Payment rejected",
        description:
          decision === "ACCEPT"
            ? `${transaction.reference} was recorded as confirmed from a notification. It has not been checked against the provider's own records.`
            : `${transaction.reference} was marked as failed.`,
        tone: decision === "ACCEPT" ? "success" : "warning",
      });
      setSelected(null);
      table.refresh();
    } catch {
      toast({
        title: "Could not save the decision",
        description: "The review was not saved. Please try again.",
        tone: "error",
      });
    } finally {
      setReviewing(false);
    }
  }

  const columns: Column<ApiTransaction>[] = [
    {
      key: "reference",
      header: "Transaction ID",
      render: (transaction) => (
        <span className="font-mono text-[13px] font-medium text-ink">
          {transaction.reference}
        </span>
      ),
    },
    {
      key: "merchant",
      header: "Merchant",
      render: (transaction) => (
        <span className="text-[13px] text-ink-soft">
          {transaction.merchantName ?? "Unknown"}
        </span>
      ),
    },
    {
      key: "provider",
      header: "Provider",
      render: (transaction) => (
        <ProviderBadge provider={transaction.provider} size="sm" />
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (transaction) => (
        <span className="font-medium text-ink">
          {formatBDT(transaction.amount)}
        </span>
      ),
    },
    {
      key: "date",
      header: "Date",
      render: (transaction) => (
        <span className="text-[13px] text-ink-muted">
          {formatDateTimeShort(transaction.occurredAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (transaction) => (
        <span className="flex items-center gap-1.5">
          <TransactionStatusBadge status={transaction.status} />
          {transaction.status === "REVIEW" ? (
            <span className="text-[11px] text-ink-faint">
              {Math.round(transaction.confidence * 100)}%
            </span>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Transactions"
        description="Every transaction recorded across all merchants."
        actions={
          <div className="flex items-center gap-3">
            <LiveIndicator status={liveStatus} />
            {table.total > 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2">
                <span className="text-[13px] text-ink-muted">Total</span>
                <span className="text-[13px] font-semibold text-ink">
                  {table.total}
                </span>
              </div>
            ) : null}
          </div>
        }
      />

      <DataTable
        columns={columns}
        rows={table.rows}
        loading={table.loading}
        error={table.error ?? undefined}
        showSearch
        searchPlaceholder="Search by ID, customer, or merchant"
        filters={[
          {
            id: "status",
            label: "All statuses",
            options: STATUS_FILTER_OPTIONS,
          },
          {
            id: "provider",
            label: "All providers",
            options: [
              { value: "BKASH", label: "bKash" },
              { value: "NAGAD", label: "Nagad" },
              { value: "ROCKET", label: "Rocket" },
              { value: "UPAY", label: "Upay" },
            ],
          },
        ]}
        showDateFilter
        emptyTitle="No transactions found"
        emptyDescription="Try a different filter or clear the search to see all records."
        emptyIcon={Receipt}
        actions={(transaction) => [
          {
            label: "View details",
            icon: Eye,
            onSelect: () => setSelected(transaction),
          },
          ...(transaction.status === "REVIEW"
            ? [
                {
                  label: "Accept payment",
                  icon: Check,
                  onSelect: () => void handleReview(transaction, "ACCEPT"),
                },
                {
                  label: "Reject payment",
                  icon: X,
                  variant: "danger" as const,
                  onSelect: () => void handleReview(transaction, "REJECT"),
                },
              ]
            : []),
        ]}
        hideExport
        server={{
          total: table.total,
          page: table.page,
          pageSize: table.pageSize,
          query: table.query,
          filters: table.filters,
          dateRange: table.dateRange,
          onPageChange: table.setPage,
          onQueryChange: table.setQuery,
          onFilterChange: table.setFilter,
          onDateRangeChange: table.setDateRange,
        }}
      />

      <TransactionDetailsModal
        transaction={selected}
        onClose={() => setSelected(null)}
        merchantName={selected?.merchantName ?? undefined}
        onAccept={
          selected?.status === "REVIEW"
            ? () => void handleReview(selected, "ACCEPT")
            : undefined
        }
        onReject={
          selected?.status === "REVIEW"
            ? () => void handleReview(selected, "REJECT")
            : undefined
        }
        reviewing={reviewing}
      />
    </div>
  );
}
