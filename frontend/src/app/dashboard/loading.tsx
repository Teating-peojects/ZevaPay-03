import { StatCardSkeleton, TableSkeleton } from "@/components/ui/states";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-56 animate-pulse rounded-md bg-elevated" />
        <div className="h-4 w-80 animate-pulse rounded-md bg-elevated" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>

      <div className="surface overflow-hidden rounded-xl">
        <TableSkeleton rows={8} columns={5} />
      </div>
    </div>
  );
}
