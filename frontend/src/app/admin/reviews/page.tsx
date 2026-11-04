"use client";

import * as React from "react";
import { Check, Eye, ListChecks, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ProviderBadge } from "@/components/shared/provider-badge";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { TransactionDetailsModal } from "@/components/shared/transaction-details-modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { formatBDT, formatDateTimeShort, formatNumber } from "@/lib/format";
import { useServerTable } from "@/hooks/use-server-table";
import { useLiveEvents } from "@/hooks/use-live-events";
import type { ApiTransaction } from "@/types/api";

/**
 * The payment review queue.
 *
 * The real API holds the queue: `GET /api/v1/admin/transactions?status=REVIEW`
 * returns the records that need a decision, and `POST
 * /api/v1/admin/transactions/:id/review` records one.
 *
 * The honesty rule from the product spec applies here more than anywhere. A
 * record leaves this queue marked "confirmed from SMS" — a human looked at the
 * notification and accepted it. Nobody checked with bKash.
 */
export default function AdminReviewsPage() {
  const { toast } = useToast();
  const [selected, setSelected] = React.useState<ApiTransaction | null>(null);
  const [reviewing, setReviewing] = React.useState(false);

  const table = useServerTable<ApiTransaction>({
    path: "/api/v1/admin/transactions",
    pageSize: 10,
    extraQuery: { status: "REVIEW" },
    buildQuery: (state) => ({
      q: state.query,
      provider: state.filters.provider,
    }),
  });

  useLiveEvents((type) => {
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
      key: "confidence",
      header: "Parser confidence",
      align: "right",
      render: (transaction) => (
        <span
          className={
            transaction.confidence >= 0.8
              ? "text-[13px] text-ink-soft"
              : "text-[13px] font-medium text-warning-fg"
          }
        >
          {Math.round(transaction.confidence * 100)}%
        </span>
      ),
    },
    {
      key: "date",
      header: "Recorded",
      render: (transaction) => (
        <span className="text-[13px] text-ink-muted">
          {formatDateTimeShort(transaction.occurredAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: () => (
        <Badge tone="info" dot>
          Needs review
        </Badge>
      ),
    },
  ];

  // The queue total and the amount waiting, read from the page the API holds.
  const waiting = table.total;
  const amountWaiting = table.rows.reduce(
    (sum, transaction) => sum + transaction.amount,
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payment reviews"
        description="Recorded notifications the parser was not confident enough to accept."
      />

      <Alert tone="warning" title="A review is a human reading a message">
        A record leaves this queue marked &ldquo;confirmed from SMS&rdquo;. That
        means someone accepted the notification after reading it. ZevaPay does
        not check with bKash, Nagad, Rocket or Upay, and a review is not a
        settlement check with the provider.
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Waiting for a decision"
          value={formatNumber(waiting)}
          hint="Records in the review queue"
          icon={ListChecks}
          tone="warning"
        />
        <StatCard
          label="Amount on this page"
          value={formatBDT(amountWaiting)}
          hint="Sum of the records shown"
          icon={ListChecks}
        />
        <StatCard
          label="Oldest record"
          value={
            table.rows.length > 0
              ? formatDateTimeShort(
                  table.rows[table.rows.length - 1].occurredAt,
                )
              : "—"
          }
          hint="At the bottom of this page"
          icon={ListChecks}
        />
        <StatCard
          label="Providers in the queue"
          value={String(new Set(table.rows.map((row) => row.provider)).size)}
          hint="Distinct providers on this page"
          icon={ListChecks}
        />
      </div>

      <DataTable
        columns={columns}
        rows={table.rows}
        loading={table.loading}
        error={table.error ?? undefined}
        showSearch
        searchPlaceholder="Search by transaction ID, customer, or merchant"
        filters={[
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
        emptyTitle="Nothing to review"
        emptyDescription="The review queue is empty. Records the parser could not read confidently appear here."
        emptyIcon={ListChecks}
        actions={(transaction) => [
          {
            label: "View details",
            icon: Eye,
            onSelect: () => setSelected(transaction),
          },
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
        ]}
        onRowClick={(transaction) => setSelected(transaction)}
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
