import type { LiveStatus } from "@/lib/live-events";

/**
 * Small indicator that shows whether the live event stream is connected.
 *
 * This is presentational only — the connection itself is owned by
 * `useLiveEvents()`, so a page can share one stream between the indicator and
 * its own refresh handler rather than opening a second one.
 */
export function LiveIndicator({
  status,
  className,
}: {
  status: LiveStatus;
  className?: string;
}) {
  const label =
    status === "live"
      ? "Live"
      : status === "offline"
        ? "Offline"
        : "Connecting";

  const dotClass =
    status === "live"
      ? "bg-success-tint0"
      : status === "offline"
        ? "bg-neutral-400"
        : "bg-warning-tint0 animate-pulse";

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted ${className ?? ""}`}
      title={
        status === "live"
          ? "Connected to the live update stream."
          : status === "offline"
            ? "The live update stream is unavailable. Refresh to see the latest data."
            : "Connecting to the live update stream."
      }
    >
      <span className={`size-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
      {label}
    </span>
  );
}
