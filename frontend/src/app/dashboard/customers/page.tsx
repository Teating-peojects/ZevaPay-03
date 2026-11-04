"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { useServerTable } from "@/hooks/use-server-table";
import type { ApiCustomer } from "@/types/api";
import { CustomerFormModal } from "./customer-form-modal";

export default function CustomersPage() {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);

  const table = useServerTable<ApiCustomer>({
    path: "/api/v1/merchant/customers",
    pageSize: 10,
    buildQuery: (state) => ({ q: state.query }),
  });

  const columns: Column<ApiCustomer>[] = [
    {
      key: "name",
      header: "Customer",
      render: (customer) => (
        <span className="block">
          <span className="block text-[13px] font-medium text-ink">
            {customer.name || "Unnamed customer"}
          </span>
          {customer.email ? (
            <span className="block text-[12px] text-ink-muted">{customer.email}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (customer) => (
        <span className="text-[13px] text-ink-soft">{customer.phone || "—"}</span>
      ),
    },
    {
      key: "created",
      header: "Added",
      align: "right",
      render: (customer) => (
        <span className="text-[13px] text-ink-muted">{formatDate(customer.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Customers"
        description="The people and businesses you collect payments from."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Add customer
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={table.rows}
        loading={table.loading}
        error={table.error ?? undefined}
        showSearch
        searchPlaceholder="Search by name, email, or phone"
        emptyTitle="No customers yet"
        emptyDescription="Add a customer to keep their details and payments together."
        emptyIcon={Users}
        onRowClick={(customer) => router.push(`/dashboard/customers/${customer.id}`)}
        hideExport
        server={{
          total: table.total,
          page: table.page,
          pageSize: table.pageSize,
          query: table.query,
          onPageChange: table.setPage,
          onQueryChange: table.setQuery,
          onFilterChange: table.setFilter,
        }}
      />

      <CustomerFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          table.refresh();
        }}
      />
    </div>
  );
}
