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
import { useTransactionReview } from "@/components/shared/review-decision";
import { formatBDT, formatDateTimeShort } from "@/lib/format";
import { dateRangeBounds } from "@/lib/date-range";
import { STATUS_FILTER_OPTIONS } from "@/lib/payment-status";
import { useServerTable } from "@/hooks/use-server-table";
import { useLiveEvents } from "@/hooks/use-live-events";
import type { ApiTransaction } from "@/types/api";

export function AdminTransactionsList() {
  const searchParams = useSearchParams();
  const [selected, setSelected] = React.useState<ApiTransaction | null>(null);

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

  // Accept and Reject both go through a confirmation dialog first.
  const review = useTransactionReview({
    scope: "admin",
    onReviewed: () => {
      setSelected(null);
      table.refresh();
    },
  });

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
                  onSelect: () => review.request(transaction, "ACCEPT"),
                },
                {
                  label: "Reject payment",
                  icon: X,
                  variant: "danger" as const,
                  onSelect: () => review.request(transaction, "REJECT"),
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
            ? () => review.request(selected, "ACCEPT")
            : undefined
        }
        onReject={
          selected?.status === "REVIEW"
            ? () => review.request(selected, "REJECT")
            : undefined
        }
      />

      {review.dialog}
    </div>
  );
}
