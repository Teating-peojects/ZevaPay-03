"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Check, Eye, Receipt, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ProviderBadge } from "@/components/shared/provider-badge";
import { TransactionStatusBadge } from "@/components/shared/status-badge";
import { DataTable, type Column, type SortState } from "@/components/shared/data-table";
import { LiveIndicator } from "@/components/shared/live-indicator";
import { TransactionDetailsBody } from "@/components/shared/transaction-details";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";
import { useTransactionReview } from "@/components/shared/review-decision";
import { formatBDT, formatDateTimeShort } from "@/lib/format";
import { dateRangeBounds } from "@/lib/date-range";
import { STATUS_FILTER_OPTIONS } from "@/lib/payment-status";
import { downloadCsv, exportDateStamp } from "@/lib/download";
import { parseAmount } from "@/lib/money";
import { useServerTable } from "@/hooks/use-server-table";
import { useLiveEvents } from "@/hooks/use-live-events";
import type { ApiTransaction } from "@/types/api";

export function TransactionsList() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [selected, setSelected] = React.useState<ApiTransaction | null>(null);

  // The API has no amount filter, so the range is applied to the rows that
  // are on screen. The hint under the inputs says as much.
  const [amount, setAmount] = React.useState({ min: "", max: "" });

  // The API always returns the newest records first and has no sort
  // parameter, so sorting is applied to the page the table holds. The note
  // under the table says so.
  const [sort, setSort] = React.useState<SortState>({
    sort: "date",
    order: "desc",
  });

  const table = useServerTable<ApiTransaction>({
    path: "/api/v1/merchant/transactions",
    pageSize: 10,
    initialQuery: searchParams.get("q") ?? "",
    buildQuery: (state) => {
      const bounds = dateRangeBounds(state.dateRange);
      return {
        q: state.query,
        status: state.filters.status,
        provider: state.filters.provider,
        from: bounds.from,
        to: bounds.to,
      };
    },
  });

  // A device reporting a new notification refreshes the list in place.
  const liveStatus = useLiveEvents((type) => {
    if (type === "transaction.created" || type === "transaction.reviewed") {
      table.refresh();
    }
  });

  // Accept and Reject both go through a confirmation dialog first.
  const review = useTransactionReview({
    scope: "merchant",
    onReviewed: () => {
      setSelected(null);
      table.refresh();
    },
  });

  /**
   * Exports the rows currently on screen.
   *
   * The API exposes a CSV export endpoint, but it ignores every filter and
   * always returns the newest 5,000 records. Exporting what the reader is
   * actually looking at is more useful and more honest, so the file is built
   * in the browser from the rows on screen.
   */
  function handleExport() {
    const rows = table.rows.filter((transaction) => {
      const min = parseAmount(amount.min);
      const max = parseAmount(amount.max);
      if (min !== null && transaction.amount < min) return false;
      if (max !== null && transaction.amount > max) return false;
      return true;
    });

    if (rows.length === 0) {
      toast({
        title: "Nothing to export",
        description: "No transactions on this page match the current filters.",
        tone: "warning",
      });
      return;
    }

    downloadCsv(
      `zevapay-transactions-${exportDateStamp()}.csv`,
      [
        "reference",
        "provider",
        "amount",
        "currency",
        "customer",
        "phone",
        "status",
        "confidence",
        "occurredAt",
      ],
      rows.map((transaction) => [
        transaction.reference,
        transaction.provider,
        transaction.amount,
        "BDT",
        transaction.customerName ?? "",
        transaction.customerPhone ?? "",
        transaction.status,
        transaction.confidence,
        transaction.occurredAt,
      ]),
    );

    toast({
      title: "Export downloaded",
      description: `${rows.length} transaction${rows.length === 1 ? "" : "s"} from this page were written to a CSV file.`,
      tone: "success",
    });
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
      sortValue: (transaction) => transaction.reference,
    },
    {
      key: "provider",
      header: "Payment method",
      render: (transaction) => (
        <ProviderBadge provider={transaction.provider} size="sm" />
      ),
      sortValue: (transaction) => transaction.provider,
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
      sortValue: (transaction) => transaction.amount,
    },
    {
      key: "customer",
      header: "Customer",
      render: (transaction) => (
        <span className="block">
          <span className="block text-[13px] text-ink-soft">
            {transaction.customerName ?? "Unknown sender"}
          </span>
          <span className="block text-[12px] text-ink-muted">
            {transaction.customerPhone ?? "No number"}
          </span>
        </span>
      ),
      sortValue: (transaction) => transaction.customerName ?? "",
    },
    {
      key: "date",
      header: "Date",
      align: "right",
      render: (transaction) => (
        <span className="text-[13px] text-ink-muted">
          {formatDateTimeShort(transaction.occurredAt)}
        </span>
      ),
      sortValue: (transaction) => transaction.occurredAt,
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
      sortValue: (transaction) => transaction.status,
    },
  ];

  const awaitingReview = selected?.status === "REVIEW";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Transactions"
        description="Payment notifications recorded by your connected devices."
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

      <Alert tone="info" title="Recorded from SMS">
        These are the notifications your devices have recorded. A record is
        marked &ldquo;confirmed from SMS&rdquo; — a notification was
        received and matched, not checked with the provider.
      </Alert>

      <DataTable
        columns={columns}
        rows={table.rows}
        loading={table.loading}
        error={table.error ?? undefined}
        showSearch
        searchPlaceholder="Search by ID, customer, or reference"
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
        amountFilter={{
          min: amount.min,
          max: amount.max,
          onChange: setAmount,
          match: (transaction, min, max) => {
            if (min !== null && transaction.amount < min) return false;
            if (max !== null && transaction.amount > max) return false;
            return true;
          },
          hint: "Filters the rows on this page. The API does not filter by amount.",
        }}
        showDateFilter
        emptyTitle="No transactions recorded"
        emptyDescription="Transactions appear here once a connected device reports a payment notification."
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
        onRowClick={(transaction) => setSelected(transaction)}
        server={{
          total: table.total,
          page: table.page,
          pageSize: table.pageSize,
          query: table.query,
          filters: table.filters,
          dateRange: table.dateRange,
          sort,
          onPageChange: table.setPage,
          onQueryChange: table.setQuery,
          onFilterChange: table.setFilter,
          onDateRangeChange: table.setDateRange,
          onSortChange: setSort,
          onExport: handleExport,
          hint: "Sorting applies to the rows on this page. The API returns the newest records first and cannot sort the full set.",
        }}
      />

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Transaction details"
        description={selected?.reference}
        size="lg"
        footer={
          awaitingReview ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  if (selected) review.request(selected, "REJECT");
                }}
                type="button"
              >
                <X className="size-4" aria-hidden="true" />
                Reject
              </Button>
              <Button
                onClick={() => {
                  if (selected) review.request(selected, "ACCEPT");
                }}
                type="button"
              >
                <Check className="size-4" aria-hidden="true" />
                Accept payment
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setSelected(null)} type="button">
              Close
            </Button>
          )
        }
      >
        {selected ? (
          <TransactionDetailsBody transaction={selected} />
        ) : null}
      </Drawer>

      {review.dialog}
    </div>
  );
}
