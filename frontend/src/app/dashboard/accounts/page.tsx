"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AccountStatusBadge } from "@/components/shared/status-badge";
import { ProviderBadge } from "@/components/shared/provider-badge";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";
import { useServerTable } from "@/hooks/use-server-table";
import { useLiveEvents } from "@/hooks/use-live-events";
import type { ApiPaymentAccount } from "@/types/api";
import { AddAccountModal } from "./add-account-modal";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  PERSONAL: "Personal",
  MERCHANT: "Merchant",
  AGENT: "Agent",
  BUSINESS: "Business",
};

export default function PaymentAccountsPage() {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [pendingRemoval, setPendingRemoval] = React.useState<ApiPaymentAccount | null>(
    null,
  );
  const [removing, setRemoving] = React.useState(false);
  const table = useServerTable<ApiPaymentAccount>({
    path: "/api/v1/merchant/accounts",
    pageSize: 10,
    buildQuery: (state) => ({
      q: state.query,
      provider: state.filters.provider,
      status: state.filters.status,
    }),
  });

  // An account added or removed elsewhere shows up without a manual refresh.
  useLiveEvents((type) => {
    if (type === "account.created" || type === "account.removed") {
      table.refresh();
    }
  });

  async function handleRemove() {
    if (!pendingRemoval) return;
    setRemoving(true);

    try {
      await apiFetch(`/api/v1/merchant/accounts/${pendingRemoval.id}`, {
        method: "DELETE",
      });
      toast({
        title: "Account removed",
        description: `${pendingRemoval.label} was removed from this merchant.`,
        tone: "success",
      });
      setPendingRemoval(null);
      table.refresh();
    } catch {
      toast({
        title: "Could not remove the account",
        description: "The account was not removed. Please try again.",
        tone: "error",
      });
    } finally {
      setRemoving(false);
    }
  }

  const columns: Column<ApiPaymentAccount>[] = [
    {
      key: "provider",
      header: "Provider",
      render: (account) => <ProviderBadge provider={account.provider} />,
    },
    {
      key: "number",
      header: "Account number",
      render: (account) => (
        <span className="font-mono text-[13px] text-ink">
          {account.accountNumber}
        </span>
      ),
    },
    {
      key: "type",
      header: "Account type",
      render: (account) => (
        <span className="text-[13px] text-ink-muted">
          {ACCOUNT_TYPE_LABELS[account.accountType] ?? account.accountType}
        </span>
      ),
    },
    {
      key: "label",
      header: "Label",
      render: (account) => (
        <span className="text-[13px] font-medium text-ink">{account.label}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (account) => <AccountStatusBadge status={account.status} />,
    },
    {
      key: "created",
      header: "Added",
      align: "right",
      render: (account) => (
        <span className="text-[13px] text-ink-muted">
          {formatDate(account.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payment Accounts"
        description="Mobile financial services accounts connected to this merchant."
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Add account
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={table.rows}
        loading={table.loading}
        error={table.error ?? undefined}
        showSearch
        searchPlaceholder="Search by label or number"
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
          {
            id: "status",
            label: "All statuses",
            options: [
              { value: "ACTIVE", label: "Active" },
              { value: "PENDING", label: "Pending" },
              { value: "SUSPENDED", label: "Suspended" },
            ],
          },
        ]}
        emptyTitle="No payment accounts yet"
        emptyDescription="Add your first bKash, Nagad, Rocket, or Upay account to start recording notifications."
        actions={(account) => [
          {
            label: "Remove account",
            icon: Trash2,
            variant: "danger",
            onSelect: () => setPendingRemoval(account),
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

      <AddAccountModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={() => table.refresh()}
      />

      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Remove payment account?"
        description={`This will remove "${pendingRemoval?.label}" from this merchant. Transactions already recorded against it are kept.`}
        confirmLabel="Remove account"
        loading={removing}
        onConfirm={handleRemove}
        onCancel={() => setPendingRemoval(null)}
      />
    </div>
  );
}
