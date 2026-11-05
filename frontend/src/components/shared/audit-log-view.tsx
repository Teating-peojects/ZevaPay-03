"use client";

import * as React from "react";
import { Eye, ListChecks, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useServerTable } from "@/hooks/use-server-table";
import type { ApiAuditLog } from "@/types/api";

/**
 * The audit trail table and detail drawer, shared by the admin console and the
 * merchant dashboard.
 *
 * The API records an action name and optional metadata. It does not record a
 * severity, so the row emphasis is derived from the action itself rather than
 * inventing a field the server never sent.
 *
 * Both endpoints accept only a page number and a page size, with no search
 * term and no action filter. Rather than show controls that quietly do
 * nothing, the search box and the filter narrow the entries on the current
 * page in the browser, and the page says so.
 */

/** How much attention an action deserves. Derived from the action, not stored. */
function actionTone(
  action: string,
): "neutral" | "info" | "warning" | "danger" {
  if (action.includes("FAILED")) return "danger";
  if (
    action.includes("REVOKED") ||
    action.includes("REMOVED") ||
    action.includes("DISCONNECTED") ||
    action.includes("PASSWORD")
  ) {
    return "warning";
  }
  if (action.includes("STATUS_CHANGED")) return "info";
  return "neutral";
}

/** "MERCHANT_STATUS_CHANGED" becomes "Merchant status changed". */
function actionLabel(action: string): string {
  const words = action.toLowerCase().split("_").filter(Boolean);
  if (words.length === 0) return action;
  const [first, ...rest] = words;
  return (
    first.charAt(0).toUpperCase() +
    first.slice(1) +
    (rest.length ? ` ${rest.join(" ")}` : "")
  );
}

export const ACTION_OPTIONS = [
  { value: "LOGIN", label: "Sign in" },
  { value: "LOGIN_FAILED", label: "Failed sign-in" },
  { value: "LOGOUT", label: "Sign out" },
  { value: "REGISTER", label: "Registration" },
  { value: "PASSWORD_CHANGED", label: "Password changed" },
  { value: "MERCHANT_STATUS_CHANGED", label: "Merchant status changed" },
  { value: "ACCOUNT_CREATED", label: "Account created" },
  { value: "ACCOUNT_REMOVED", label: "Account removed" },
  { value: "DEVICE_PAIRED", label: "Device paired" },
  { value: "DEVICE_DISCONNECTED", label: "Device disconnected" },
  { value: "API_KEY_CREATED", label: "API key created" },
  { value: "API_KEY_REVOKED", label: "API key revoked" },
  { value: "TRANSACTION_REVIEWED", label: "Transaction reviewed" },
];

export function AuditLogView({
  path,
  showMerchant,
  title = "Audit logs",
  description,
  totalHint,
  actionOptions = ACTION_OPTIONS,
}: {
  /** The list endpoint: admin or merchant. */
  path: string;
  /** Admin sees which merchant each entry belongs to. */
  showMerchant: boolean;
  title?: string;
  description: string;
  totalHint: string;
  actionOptions?: { value: string; label: string }[];
}) {
  const [selected, setSelected] = React.useState<ApiAuditLog | null>(null);
  const [query, setQuery] = React.useState("");
  const [action, setAction] = React.useState("");

  const table = useServerTable<ApiAuditLog>({
    path,
    pageSize: 10,
  });

  // The API cannot search or filter, so the narrowing happens here over the
  // entries the server just returned.
  const rows = React.useMemo(() => {
    const term = query.trim().toLowerCase();

    return table.rows.filter((log) => {
      if (action && log.action !== action) return false;
      if (!term) return true;

      return [
        log.action,
        log.actorName ?? "",
        log.merchantName ?? "",
        log.ipAddress ?? "",
      ].some((value) => value.toLowerCase().includes(term));
    });
  }, [table.rows, query, action]);

  const failures = rows.filter((row) => row.action.includes("FAILED")).length;
  const signIns = rows.filter((row) => row.action.startsWith("LOGIN")).length;

  const merchantColumn: Column<ApiAuditLog> = {
  key: "merchantName",
  header: "Merchant",
  render: (log) => (
    <span className="text-[13px] text-ink-soft">
      {log.merchantName ?? "Platform"}
    </span>
  ),
  sortValue: (log) => log.merchantName ?? "",
};

  const columns: Column<ApiAuditLog>[] = [
    {
      key: "action",
      header: "Action",
      render: (log) => (
        <span className="block">
          <span className="block text-[13px] font-medium text-ink">
            {actionLabel(log.action)}
          </span>
          <span className="block font-mono text-[11px] text-ink-faint">
            {log.action}
          </span>
        </span>
      ),
      sortValue: (log) => log.action,
    },
    {
      key: "actorName",
      header: "Actor",
      render: (log) => (
        <span className="text-[13px] text-ink-soft">
          {log.actorName ?? "System"}
        </span>
      ),
      sortValue: (log) => log.actorName ?? "",
    },
    ...(showMerchant ? [merchantColumn] : []),
    {
      key: "ipAddress",
      header: "IP address",
      render: (log) => (
        <span className="font-mono text-[12px] text-ink-muted">
          {log.ipAddress ?? "—"}
        </span>
      ),
      sortValue: (log) => log.ipAddress ?? "",
    },
    {
      key: "createdAt",
      header: "When",
      align: "right",
      render: (log) => (
        <span className="text-[13px] text-ink-muted">
          {formatDateTime(log.createdAt)}
        </span>
      ),
      sortValue: (log) => log.createdAt,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description={description}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Entries on this page"
          value={formatNumber(rows.length)}
          hint="Newest first"
          icon={ListChecks}
        />
        <StatCard
          label="Total recorded"
          value={formatNumber(table.total)}
          hint={totalHint}
          icon={ListChecks}
        />
        <StatCard
          label="Sign-in attempts"
          value={formatNumber(signIns)}
          hint="On this page"
          icon={ListChecks}
        />
        <StatCard
          label="Failed attempts"
          value={formatNumber(failures)}
          hint="On this page"
          icon={ShieldAlert}
          tone={failures > 0 ? "warning" : "success"}
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={table.loading}
        error={table.error ?? undefined}
        showSearch
        searchPlaceholder="Search this page by action, actor, or IP"
        filters={[
          {
            id: "action",
            label: "All actions",
            options: actionOptions,
          },
        ]}
        emptyTitle="No audit entries"
        emptyDescription="Entries appear here as soon as something sensitive happens."
        emptyIcon={ListChecks}
        actions={(log) => [
          {
            label: "View entry",
            icon: Eye,
            onSelect: () => setSelected(log),
          },
        ]}
        onRowClick={(log) => setSelected(log)}
        hideExport
        server={{
          total: table.total,
          page: table.page,
          pageSize: table.pageSize,
          query,
          filters: { action },
          onPageChange: table.setPage,
          onQueryChange: (value) => {
            setQuery(value);
            table.setPage(1);
          },
          onFilterChange: (id, value) => {
            if (id === "action") setAction(value);
            table.setPage(1);
          },
          hint: "The API accepts only a page number and a page size. The search box and the action filter narrow the entries on the current page in your browser — they do not search the whole trail.",
        }}
      />

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Audit entry"
        description={selected ? actionLabel(selected.action) : undefined}
        size="md"
        footer={
          <Button variant="outline" onClick={() => setSelected(null)} type="button">
            Close
          </Button>
        }
      >
        {selected ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1 rounded-lg border border-line bg-elevated px-4 py-4">
              <span className="text-[13px] text-ink-muted">Action</span>
              <span className="text-lg font-semibold tracking-tight text-ink">
                {actionLabel(selected.action)}
              </span>
              <span className="font-mono text-[12px] text-ink-faint">
                {selected.action}
              </span>
              <div className="mt-1.5">
                <Badge tone={actionTone(selected.action)} dot>
                  {selected.actorName ?? "System"}
                </Badge>
              </div>
            </div>

            <dl className="flex flex-col gap-2.5 text-[13px]">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-muted">Entry ID</dt>
                <dd className="font-mono font-medium text-ink">{selected.id}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-muted">Actor</dt>
                <dd className="font-medium text-ink">
                  {selected.actorName ?? "System"}
                </dd>
              </div>
              {showMerchant ? (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-muted">Merchant</dt>
                <dd className="font-medium text-ink">
                  {selected.merchantName ?? "Platform-wide"}
                </dd>
              </div>
              ) : null}
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-muted">IP address</dt>
                <dd className="font-mono font-medium text-ink">
                  {selected.ipAddress ?? "Not recorded"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-muted">When</dt>
                <dd className="font-medium text-ink">
                  {formatDateTime(selected.createdAt)}
                </dd>
              </div>
            </dl>

            <div>
              <p className="mb-2 text-[12px] font-semibold tracking-wide uppercase text-ink-muted">
                Metadata
              </p>
              {selected.metadata &&
              Object.keys(selected.metadata).length > 0 ? (
                <pre className="overflow-x-auto rounded-lg border border-line bg-elevated px-4 py-3 font-mono text-[12px] leading-relaxed text-ink-soft">
                  {JSON.stringify(selected.metadata, null, 2)}
                </pre>
              ) : (
                <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-ink-muted">
                  No extra detail was recorded with this entry.
                </p>
              )}
            </div>

            <p className="text-[12px] leading-relaxed text-ink-muted">
              The trail is append-only. Entries cannot be edited or deleted from
              here — the API exposes no such endpoint.
            </p>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
