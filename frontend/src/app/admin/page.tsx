import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CircleCheck,
  Clock,
  MonitorSmartphone,
  Receipt,
  Store,
  UserCheck,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActivityChart } from "@/components/shared/activity-chart";
import { ProviderBadge } from "@/components/shared/provider-badge";
import { TransactionStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBDT, formatDate, formatDateTimeShort, formatNumber } from "@/lib/format";
import { getSession, serverFetch } from "@/lib/server-api";
import type { AdminOverview } from "@/types/api";

export const metadata: Metadata = {
  title: "Admin overview",
  description:
    "ZevaPay platform overview — merchants, transactions, and device status.",
};

export default async function AdminOverviewPage() {
  const [session, overview] = await Promise.all([
    getSession(),
    serverFetch<AdminOverview>("/api/v1/admin/overview"),
  ]);

  if (!session || !overview) {
    return (
      <div className="surface rounded-xl p-8 text-center">
        <p className="text-[15px] font-semibold text-ink">
          We couldn&apos;t load the platform overview
        </p>
        <p className="mt-1.5 text-sm text-ink-muted">
          The API did not return any data. Try refreshing the page.
        </p>
      </div>
    );
  }

  const { deviceCounts, merchantCounts } = overview;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            Platform overview
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Activity across all merchants registered on ZevaPay.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total merchants"
          value={formatNumber(overview.stats.totalMerchants)}
          hint={`${merchantCounts.pendingReview} awaiting review`}
          icon={Store}
        />
        <StatCard
          label="Active merchants"
          value={formatNumber(overview.stats.activeMerchants)}
          hint={`${merchantCounts.suspended} suspended`}
          icon={UserCheck}
          tone="success"
        />
        <StatCard
          label="Total transactions"
          value={formatNumber(overview.stats.totalTransactions)}
          hint={`${formatBDT(overview.stats.totalAmount)} recorded`}
          icon={Receipt}
        />
        <StatCard
          label="Pending reviews"
          value={formatNumber(overview.stats.pendingReviews)}
          hint="Waiting for a decision"
          icon={Clock}
          tone="warning"
        />
      </div>

      {/* Chart + summaries */}
      <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Transaction activity</CardTitle>
            <CardDescription>
              Recorded notifications over the last 14 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityChart data={overview.activity} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Device status</CardTitle>
                <CardDescription>
                  {deviceCounts.online} of{" "}
                  {deviceCounts.online + deviceCounts.offline + deviceCounts.pending}{" "}
                  online
                </CardDescription>
              </div>
              <span className="flex size-9 items-center justify-center rounded-lg bg-elevated">
                <MonitorSmartphone
                  className="size-4 text-ink-soft"
                  aria-hidden="true"
                />
              </span>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {[
                {
                  label: "Online",
                  value: deviceCounts.online,
                  tone: "text-success-fg",
                },
                {
                  label: "Offline",
                  value: deviceCounts.offline,
                  tone: "text-ink-soft",
                },
                {
                  label: "Pending",
                  value: deviceCounts.pending,
                  tone: "text-warning-fg",
                },
              ].map((entry) => (
                <div
                  key={entry.label}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-[13px] text-ink-soft">{entry.label}</span>
                  <span className={`text-[13px] font-semibold ${entry.tone}`}>
                    {entry.value}
                  </span>
                </div>
              ))}
              <Link
                href="/admin/devices"
                className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-brand-link transition-colors hover:text-brand-link-hover"
              >
                Manage devices
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Merchant registrations</CardTitle>
                <CardDescription>Recently joined the platform</CardDescription>
              </div>
              <span className="flex size-9 items-center justify-center rounded-lg bg-elevated">
                <CircleCheck
                  className="size-4 text-ink-soft"
                  aria-hidden="true"
                />
              </span>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              {overview.recentMerchants.map((merchant) => (
                <div
                  key={merchant.id}
                  className="flex items-center justify-between gap-3"
                >
                  <p className="min-w-0 truncate text-[13px] text-ink-soft">
                    {merchant.businessName}
                  </p>
                  <span className="shrink-0 text-[12px] text-ink-muted">
                    {formatDate(merchant.registrationDate)}
                  </span>
                </div>
              ))}
              <Link
                href="/admin/merchants"
                className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-brand-link transition-colors hover:text-brand-link-hover"
              >
                Manage merchants
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Recent transactions</CardTitle>
            <CardDescription>
              Latest recorded notifications across all merchants
            </CardDescription>
          </div>
          <Link href="/admin/transactions">
            <Button variant="outline" size="sm">
              View all
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transaction</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.recentTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="font-mono text-[13px] font-medium text-ink">
                    {transaction.reference}
                  </TableCell>
                  <TableCell>
                    <span className="text-[13px] text-ink-soft">
                      {transaction.merchantName ?? "Unknown"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ProviderBadge
                      provider={transaction.provider}
                      size="sm"
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium text-ink">
                    {formatBDT(transaction.amount)}
                  </TableCell>
                  <TableCell>
                    <TransactionStatusBadge status={transaction.status} />
                  </TableCell>
                  <TableCell className="text-right text-[13px] text-ink-muted">
                    {formatDateTimeShort(transaction.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
