"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleCheck,
  Clock,
  CreditCard,
  MonitorSmartphone,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActivityChart } from "@/components/shared/activity-chart";
import { ProviderBadge } from "@/components/shared/provider-badge";
import { TransactionStatusBadge } from "@/components/shared/status-badge";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatBDT,
  formatDateTimeShort,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type { MerchantOverview } from "@/types/api";

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-brand-link transition-colors hover:text-brand-link-hover"
    >
      {children}
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </Link>
  );
}

/** The merchant overview. Every figure comes from the API. */
export function MerchantOverviewScreen({
  merchantName,
  firstName,
  live,
}: {
  merchantName: string;
  firstName: string;
  live: MerchantOverview | null;
}) {
  if (!live) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={`Welcome back, ${firstName}`} description={merchantName} />
        <Alert tone="danger" title="The overview is unavailable">
          We could not load your figures. Refresh the page to try again.
        </Alert>
      </div>
    );
  }

  const { stats, devices, accounts, recentTransactions } = live;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={`${merchantName} · notifications recorded from your connected devices`}
      />

      {stats.pendingReviews > 0 ? (
        <Alert tone="warning" title={`${stats.pendingReviews} to review`}>
          Some notifications could not be read with confidence.{" "}
          <Link href="/dashboard/transactions" className="font-medium underline">
            Review them
          </Link>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Recorded amount"
          value={formatBDT(stats.totalAmount)}
          hint="All recorded notifications, including pending, review and failed. Not revenue."
          icon={Wallet}
        />
        <StatCard
          label="Transactions"
          value={formatNumber(stats.totalTransactions)}
          hint={`${formatNumber(stats.pendingTransactions)} awaiting verification`}
          icon={Clock}
          tone="info"
        />
        <StatCard
          label="Success rate"
          value={formatPercent(stats.successRate)}
          hint="Recorded as confirmed from SMS"
          icon={CircleCheck}
          tone="success"
        />
        <StatCard
          label="Needs review"
          value={formatNumber(stats.pendingReviews)}
          hint="Waiting for your decision"
          icon={Clock}
          tone={stats.pendingReviews > 0 ? "warning" : "neutral"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>Notifications recorded in the last 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityChart data={live.activity} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
          <CardDescription>
            A confirmed status means the notification said so. It is not verified with the provider.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <p className="text-[13px] text-ink-muted">
              Nothing has been recorded yet. Transactions appear once a connected device reports a notification.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {recentTransactions.slice(0, 6).map((transaction) => (
                <li key={transaction.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <ProviderBadge provider={transaction.provider} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-ink">
                        {transaction.customerName ?? "Unknown sender"}
                      </p>
                      <p className="text-[12px] text-ink-muted">
                        {formatDateTimeShort(transaction.occurredAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-[13px] font-medium text-ink">
                      {formatBDT(transaction.amount)}
                    </span>
                    <TransactionStatusBadge status={transaction.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="pt-2">
            <CardLink href="/dashboard/transactions">View all transactions</CardLink>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Connected devices</CardTitle>
              <CardDescription>
                {live.deviceCounts.online} of {devices.length} online
              </CardDescription>
            </div>
            <MonitorSmartphone className="size-4 text-ink-soft" aria-hidden="true" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {devices.slice(0, 4).map((device) => (
              <div key={device.id} className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-[13px] text-ink-soft">{device.name}</p>
                <span className="shrink-0 text-[12px] font-medium text-ink-muted">
                  {device.status === "ONLINE" ? "Online" : device.status === "PENDING" ? "Pending" : "Offline"}
                </span>
              </div>
            ))}
            {devices.length === 0 ? (
              <p className="text-[13px] text-ink-muted">No devices are connected yet.</p>
            ) : null}
            <CardLink href="/dashboard/devices">Manage devices</CardLink>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Payment accounts</CardTitle>
              <CardDescription>
                {accounts.filter((account) => account.status === "ACTIVE").length} of {accounts.length} active
              </CardDescription>
            </div>
            <CreditCard className="size-4 text-ink-soft" aria-hidden="true" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between gap-3">
                <ProviderBadge provider={account.provider} size="sm" />
                <span className="shrink-0 font-mono text-[12px] text-ink-muted">
                  {account.accountNumber}
                </span>
              </div>
            ))}
            {accounts.length === 0 ? (
              <p className="text-[13px] text-ink-muted">No payment accounts are connected yet.</p>
            ) : null}
            <CardLink href="/dashboard/accounts">Manage accounts</CardLink>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
