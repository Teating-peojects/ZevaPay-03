"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Eye, Plus, RotateCcw, Store, UserCheck, UserX } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { MerchantStatusBadge } from "@/components/shared/status-badge";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { useServerTable } from "@/hooks/use-server-table";
import { useLiveEvents } from "@/hooks/use-live-events";
import type { ApiMerchant } from "@/types/api";
import type { CreateMerchantValues } from "@/lib/schemas";
import { MerchantDetails } from "./merchant-details";
import { MerchantForm } from "./merchant-form";

/**
 * What the admin is about to do. Approving a merchant in review and
 * reinstating a suspended one both set the status to ACTIVE, but they are
 * different decisions, so they read differently.
 */
type PendingAction = {
  merchant: ApiMerchant;
  action: "approve" | "reinstate" | "suspend";
};

const MERCHANT_STATUSES = ["ACTIVE", "PENDING_REVIEW", "SUSPENDED"];

const ACTION_COPY = {
  approve: {
    title: "Approve merchant?",
    confirm: "Approve merchant",
    toast: "Merchant approved",
    toastBody: (name: string) => `${name} can now sign in and use ZevaPay.`,
    describe: (name: string) =>
      `${name} will be approved and can sign in and use ZevaPay.`,
  },
  reinstate: {
    title: "Reinstate merchant?",
    confirm: "Reinstate merchant",
    toast: "Merchant reinstated",
    toastBody: (name: string) => `${name} has its dashboard access back.`,
    describe: (name: string) =>
      `${name} is suspended. Reinstating restores its dashboard access.`,
  },
  suspend: {
    title: "Suspend merchant?",
    confirm: "Suspend merchant",
    toast: "Merchant suspended",
    toastBody: (name: string) =>
      `${name} has been suspended and lost dashboard access.`,
    describe: (name: string) =>
      `${name} will be suspended and its users will no longer be able to sign in or use the dashboard. Its transaction history is kept.`,
  },
} as const;

/**
 * The admin console's merchants screen.
 *
 * This is one of the pages that calls the real API: `GET
 * /api/v1/admin/merchants` lists the merchants and `PATCH
 * /api/v1/admin/merchants/:id` changes one account's status. `POST
 * /api/v1/admin/merchants` registers a new merchant with its owner.
 */
export function AdminMerchantsList() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  // Deep links such as /admin/merchants?status=PENDING_REVIEW open filtered.
  const initialStatus = searchParams.get("status") ?? "";
  const [selected, setSelected] = React.useState<ApiMerchant | null>(null);
  const [pending, setPending] = React.useState<PendingAction | null>(null);
  const [updating, setUpdating] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  const table = useServerTable<ApiMerchant>({
    path: "/api/v1/admin/merchants",
    pageSize: 10,
    initialFilters: MERCHANT_STATUSES.includes(initialStatus)
      ? { status: initialStatus }
      : undefined,
    buildQuery: (state) => ({
      q: state.query,
      status: state.filters.status,
    }),
  });

  useLiveEvents((type) => {
    if (type === "merchant.updated" || type === "user.updated") {
      table.refresh();
    }
  });

  async function handleConfirm() {
    if (!pending) return;
    setUpdating(true);

    const status = pending.action === "suspend" ? "SUSPENDED" : "ACTIVE";
    const copy = ACTION_COPY[pending.action];

    try {
      await apiFetch(`/api/v1/admin/merchants/${pending.merchant.id}`, {
        method: "PATCH",
        body: { status },
      });

      toast({
        title: copy.toast,
        description: copy.toastBody(pending.merchant.businessName),
        tone: status === "ACTIVE" ? "success" : "warning",
      });
      setPending(null);
      setSelected(null);
      table.refresh();
    } catch {
      toast({
        title: "Could not update the merchant",
        description: "Nothing was changed. Please try again.",
        tone: "error",
      });
    } finally {
      setUpdating(false);
    }
  }

  async function handleCreate(values: CreateMerchantValues) {
    setCreating(true);

    try {
      await apiFetch("/api/v1/admin/merchants", {
        method: "POST",
        body: {
          businessName: values.businessName,
          ownerName: values.ownerName,
          email: values.email,
          phone: values.phone === "" ? undefined : values.phone,
          status: values.status,
        },
      });

      toast({
        title: "Merchant registered",
        description:
          "The merchant and its owner account now exist. The backend cannot send an invitation email yet, so the owner will need a password set before they can sign in.",
        tone: "success",
      });
      setFormOpen(false);
      table.refresh();
    } catch (error) {
      toast({
        title: "Could not register the merchant",
        description:
          error instanceof ApiError
            ? error.message
            : "Please try again in a moment.",
        tone: "error",
      });
    } finally {
      setCreating(false);
    }
  }

  const columns: Column<ApiMerchant>[] = [
    {
      key: "businessName",
      header: "Business name",
      render: (merchant) => (
        <span className="text-[13px] font-medium text-ink">
          {merchant.businessName}
        </span>
      ),
      sortValue: (merchant) => merchant.businessName,
    },
    {
      key: "ownerName",
      header: "Owner",
      render: (merchant) => (
        <span className="text-[13px] text-ink-soft">{merchant.ownerName}</span>
      ),
      sortValue: (merchant) => merchant.ownerName,
    },
    {
      key: "email",
      header: "Email",
      render: (merchant) => (
        <span className="text-[13px] text-ink-soft">{merchant.email}</span>
      ),
      sortValue: (merchant) => merchant.email,
    },
    {
      key: "plan",
      header: "Plan",
      render: (merchant) => (
        <span className="text-[13px] text-ink-soft">{merchant.plan}</span>
      ),
      sortValue: (merchant) => merchant.plan,
    },
    {
      key: "registrationDate",
      header: "Registered",
      render: (merchant) => (
        <span className="text-[13px] text-ink-muted">
          {formatDate(merchant.registrationDate)}
        </span>
      ),
      sortValue: (merchant) => merchant.registrationDate,
    },
    {
      key: "status",
      header: "Account status",
      render: (merchant) => <MerchantStatusBadge status={merchant.status} />,
      sortValue: (merchant) => merchant.status,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Merchants"
        description="Every business registered on the ZevaPay platform."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Register merchant
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={table.rows}
        loading={table.loading}
        error={table.error ?? undefined}
        showSearch
        searchPlaceholder="Search by business, owner, or email"
        filters={[
          {
            id: "status",
            label: "All statuses",
            options: [
              { value: "ACTIVE", label: "Active" },
              { value: "PENDING_REVIEW", label: "In Review" },
              { value: "SUSPENDED", label: "Suspended" },
            ],
          },
        ]}
        emptyTitle="No merchants found"
        emptyDescription="Merchants appear here once they register for a ZevaPay account."
        emptyIcon={Store}
        actions={(merchant) => [
          {
            label: "View details",
            icon: Eye,
            onSelect: () => setSelected(merchant),
          },
          ...(merchant.status === "PENDING_REVIEW"
            ? [
                {
                  label: "Approve merchant",
                  icon: UserCheck,
                  onSelect: () =>
                    setPending({ merchant, action: "approve" as const }),
                },
              ]
            : merchant.status === "SUSPENDED"
              ? [
                  {
                    label: "Reinstate merchant",
                    icon: RotateCcw,
                    onSelect: () =>
                      setPending({ merchant, action: "reinstate" as const }),
                  },
                ]
              : [
                {
                  label: "Suspend merchant",
                  icon: UserX,
                  variant: "danger" as const,
                  onSelect: () =>
                    setPending({ merchant, action: "suspend" as const }),
                },
              ]),
        ]}
        onRowClick={(merchant) => setSelected(merchant)}
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

      <MerchantDetails
        merchant={selected}
        onClose={() => setSelected(null)}
      />

      <MerchantForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleCreate}
        saving={creating}
      />

      <ConfirmDialog
        open={pending !== null}
        title={pending ? ACTION_COPY[pending.action].title : ""}
        description={
          pending
            ? ACTION_COPY[pending.action].describe(pending.merchant.businessName)
            : ""
        }
        confirmLabel={pending ? ACTION_COPY[pending.action].confirm : undefined}
        tone={pending?.action === "suspend" ? "danger" : "primary"}
        loading={updating}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
