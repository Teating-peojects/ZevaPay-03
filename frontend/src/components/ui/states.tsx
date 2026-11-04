import * as React from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/** Empty state shown when a list has no records. */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-elevated">
        <Icon className="size-5 text-ink-muted" aria-hidden="true" />
      </div>
      <p className="mt-4 text-[15px] font-semibold text-ink">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Shimmering placeholder used while data is loading. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-elevated", className)}
      aria-hidden="true"
    />
  );
}

/** Skeleton shaped like a stat card. */
export function StatCardSkeleton() {
  return (
    <div className="surface rounded-xl p-5">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="mt-4 h-7 w-32" />
      <Skeleton className="mt-3 h-3 w-20" />
    </div>
  );
}

/** Skeleton shaped like a table with `rows` placeholder rows. */
export function TableSkeleton({
  rows = 6,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <Skeleton
              key={colIndex}
              className={cn(
                "h-3.5",
                colIndex === 0 ? "w-40" : "w-24",
                colIndex === columns - 1 ? "ml-auto" : undefined,
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
