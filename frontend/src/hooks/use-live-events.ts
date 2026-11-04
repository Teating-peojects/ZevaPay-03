"use client";

import * as React from "react";
import {
  connectLiveStream,
  type LiveEventType,
  type LiveStatus,
} from "@/lib/live-events";

/**
 * Subscribes to the API's Server-Sent Events feed and reports both the
 * connection state and the events that arrive.
 *
 * Pages use this to refresh their data when something changes on the server
 * — for example when a device reports a new payment notification.
 */
export function useLiveEvents(
  onEvent?: (type: LiveEventType) => void,
): LiveStatus {
  const [status, setStatus] = React.useState<LiveStatus>("connecting");

  // Keep the latest callback without re-opening the stream on every render.
  const handler = React.useRef(onEvent);
  React.useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);

  React.useEffect(() => {
    const close = connectLiveStream<unknown>((event) => {
      handler.current?.(event.type);
    }, setStatus);
    return close;
  }, []);

  return status;
}
