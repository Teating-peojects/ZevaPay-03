"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentStatusBadge } from "@/components/shared/payment-status-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/states";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatBDT, formatDate, formatDateTimeShort } from "@/lib/format";
import type { ApiCustomer } from "@/types/api";
import { CustomerFormModal } from "../customer-form-modal";

export function CustomerDetailScreen() {
  const params = useParams<{ id: string }>();
  const [customer, setCustomer] = React.useState<ApiCustomer | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [reload, setReload] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    apiFetch<{ data: ApiCustomer }>(`/api/v1/merchant/customers/${params.id}`)
      .then((payload) => {
        if (!cancelled) setCustomer(payload.data);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : "We could not load this customer.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, reload]);

  if (error) {
    return <Alert tone="danger" title="Customer unavailable">{error}</Alert>;
  }
  if (!customer) {
    return <Skeleton className="h-64 w-full" />;
  }

  const payments = customer.payments ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/customers"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Customers
      </Link>

      <PageHeader
        title={customer.name || "Unnamed customer"}
        description={`Added ${formatDate(customer.createdAt)}`}
        actions={
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0 lg:grid-cols-3">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">Contact</h2>
          <dl className="mt-3 space-y-3 text-[13px]">
            <div>
              <dt className="text-ink-muted">Email</dt>
              <dd className="text-ink">{customer.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Phone</dt>
              <dd className="text-ink">{customer.phone || "—"}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Notes</dt>
              <dd className="whitespace-pre-wrap text-ink">{customer.notes || "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-ink">Recent payments</h2>
          {payments.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-muted">No payments for this customer yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {payments.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[13px] font-medium text-ink">{payment.reference}</p>
                    <p className="text-[12px] text-ink-muted">{formatDateTimeShort(payment.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-medium text-ink">
                      {formatBDT(payment.amountMinor / 100)}
                    </span>
                    <PaymentStatusBadge status={payment.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <CustomerFormModal
        open={editing}
        customer={customer}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          setReload((n) => n + 1);
        }}
      />
    </div>
  );
}
