"use client";

import * as React from "react";
import { Eye, UserCheck, UserX, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { formatDateTime, formatNumber } from "@/lib/format";
import { isPlatformRole, ROLE_LABELS } from "@/lib/roles";
import { useServerTable } from "@/hooks/use-server-table";
import { useLiveEvents } from "@/hooks/use-live-events";
import type { ApiUser, UserRole } from "@/types/api";
import { UserDetailsModal } from "./user-details-modal";

/**
 * Every person who can sign in to ZevaPay.
 *
 * This page calls the real API: `GET /api/v1/admin/users` lists the platform
 * administrators and the merchant staff, and `PATCH /api/v1/admin/users/:id`
 * activates or deactivates one. Deactivating a user also terminates their
 * sessions on the server, so this is a real switch.
 */

const ROLE_TONES: Partial<Record<UserRole, "brand">> = {
  SUPER_ADMIN: "brand",
  ADMIN: "brand",
  SUPPORT: "brand",
};

type PendingAction = {
  user: ApiUser;
  action: "activate" | "deactivate";
};

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [selected, setSelected] = React.useState<ApiUser | null>(null);
  const [pending, setPending] = React.useState<PendingAction | null>(null);
  const [updating, setUpdating] = React.useState(false);

  const table = useServerTable<ApiUser>({
    path: "/api/v1/admin/users",
    pageSize: 10,
    buildQuery: (state) => ({
      q: state.query,
      role: state.filters.role,
      isActive: state.filters.isActive,
    }),
  });

  useLiveEvents((type) => {
    if (type === "user.updated") table.refresh();
  });

  async function handleConfirm() {
    if (!pending) return;
    setUpdating(true);

    const isActive = pending.action === "activate";

    try {
      await apiFetch(`/api/v1/admin/users/${pending.user.id}`, {
        method: "PATCH",
        body: { isActive },
      });

      toast({
        title: isActive ? "Access restored" : "Access removed",
        description: isActive
          ? `${pending.user.fullName} can sign in again.`
          : `${pending.user.fullName} can no longer sign in, and their sessions were ended.`,
        tone: isActive ? "success" : "warning",
      });
      setPending(null);
      setSelected(null);
      table.refresh();
    } catch {
      toast({
        title: "Could not update the user",
        description: "Nothing was changed. Please try again.",
        tone: "error",
      });
    } finally {
      setUpdating(false);
    }
  }

  const columns: Column<ApiUser>[] = [
    {
      key: "fullName",
      header: "Person",
      render: (user) => (
        <span className="block">
          <span className="block text-[13px] font-medium text-ink">
            {user.fullName}
          </span>
          <span className="block text-[12px] text-ink-muted">{user.email}</span>
        </span>
      ),
      sortValue: (user) => user.fullName,
    },
    {
      key: "role",
      header: "Role",
      render: (user) => (
        <Badge tone={ROLE_TONES[user.role]}>{ROLE_LABELS[user.role]}</Badge>
      ),
      sortValue: (user) => user.role,
    },
    {
      key: "merchantName",
      header: "Merchant",
      render: (user) => (
        <span className="text-[13px] text-ink-soft">
          {user.merchantName ?? "ZevaPay Platform"}
        </span>
      ),
      sortValue: (user) => user.merchantName ?? "",
    },
    {
      key: "isActive",
      header: "Access",
      render: (user) => (
        <Badge tone={user.isActive ? "success" : "danger"} dot>
          {user.isActive ? "Active" : "Deactivated"}
        </Badge>
      ),
      sortValue: (user) => (user.isActive ? 1 : 0),
    },
    {
      key: "lastLoginAt",
      header: "Last sign-in",
      align: "right",
      render: (user) => (
        <span className="text-[13px] text-ink-muted">
          {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never signed in"}
        </span>
      ),
      sortValue: (user) => user.lastLoginAt ?? "",
    },
  ];

  const rows = table.rows;
  const platformStaff = rows.filter(
    (row) => isPlatformRole(row.role),
  ).length;
  const deactivated = rows.filter((row) => !row.isActive).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        description="Everyone who can sign in — platform staff and merchant staff."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Users on this page"
          value={formatNumber(rows.length)}
          hint="Platform and merchant staff"
          icon={Users}
        />
        <StatCard
          label="Platform staff"
          value={formatNumber(platformStaff)}
          hint="On this page"
          icon={UserCheck}
        />
        <StatCard
          label="Total accounts"
          value={formatNumber(table.total)}
          hint="Across the platform"
          icon={Users}
        />
        <StatCard
          label="Deactivated"
          value={formatNumber(deactivated)}
          hint="On this page"
          icon={UserX}
          tone={deactivated > 0 ? "warning" : "success"}
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={table.loading}
        error={table.error ?? undefined}
        showSearch
        searchPlaceholder="Search by name, email, or phone"
        filters={[
          {
            id: "role",
            label: "All roles",
            options: [
              ...(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => ({
                value: role,
                label: ROLE_LABELS[role],
              })),
            ],
          },
          {
            id: "isActive",
            label: "All access states",
            options: [
              { value: "true", label: "Active" },
              { value: "false", label: "Deactivated" },
            ],
          },
        ]}
        emptyTitle="No users found"
        emptyDescription="Users appear here once they register for a ZevaPay account."
        emptyIcon={Users}
        actions={(user) => [
          {
            label: "View user",
            icon: Eye,
            onSelect: () => setSelected(user),
          },
          ...(user.isActive
            ? [
                {
                  label: "Remove access",
                  icon: UserX,
                  variant: "danger" as const,
                  onSelect: () =>
                    setPending({ user, action: "deactivate" as const }),
                },
              ]
            : [
                {
                  label: "Restore access",
                  icon: UserCheck,
                  onSelect: () =>
                    setPending({ user, action: "activate" as const }),
                },
              ]),
        ]}
        onRowClick={(user) => setSelected(user)}
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

      <UserDetailsModal user={selected} onClose={() => setSelected(null)} />

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.action === "deactivate"
            ? "Remove this user's access?"
            : "Restore this user's access?"
        }
        description={
          pending?.action === "deactivate"
            ? `${pending?.user.fullName} will be signed out everywhere and will not be able to sign in again until access is restored.`
            : `${pending?.user.fullName} will be able to sign in again.`
        }
        confirmLabel={
          pending?.action === "deactivate" ? "Remove access" : "Restore access"
        }
        tone={pending?.action === "deactivate" ? "danger" : "primary"}
        loading={updating}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
