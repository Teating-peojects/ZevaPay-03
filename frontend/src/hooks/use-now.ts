"use client";

import * as React from "react";

/**
 * The current time, refreshed on an interval, so "5 min ago" and device
 * health stay accurate on a page that is left open.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
