/**
 * Live update client for the dashboards.
 *
 * The API exposes a Server-Sent Events feed at `/api/v1/stream`. The app
 * proxies that path to the API service, so the browser can connect to its own
 * origin and the session cookie travels with the request.
 */

export type LiveEventType =
  | "connected"
  | "transaction.created"
  | "transaction.reviewed"
  | "device.paired"
  | "device.updated"
  | "device.removed"
  | "account.created"
  | "account.updated"
  | "account.removed"
  | "merchant.updated"
  | "user.updated";

export interface LiveEvent<T = unknown> {
  type: LiveEventType;
  data: T;
}

export type LiveStatus = "connecting" | "live" | "offline";

type Handler<T> = (event: LiveEvent<T>) => void;

/**
 * Opens the event stream and dispatches every message to `onEvent`.
 * Returns a function that closes the connection.
 */
export function connectLiveStream<T = unknown>(
  onEvent: Handler<T>,
  onStatus?: (status: LiveStatus) => void,
): () => void {
  if (typeof window === "undefined" || typeof EventSource === "undefined") {
    return () => {};
  }

  const source = new EventSource("/api/v1/stream", {
    withCredentials: true,
  });

  const dispatch = (type: string) => (event: MessageEvent) => {
    let payload: unknown = null;
    try {
      payload = JSON.parse(event.data);
    } catch {
      payload = event.data;
    }
    onEvent({ type: type as LiveEventType, data: payload as T });
  };

  source.addEventListener("connected", () => {
    onStatus?.("live");
  });

  source.addEventListener("open", () => {
    onStatus?.("live");
  });

  source.addEventListener("error", () => {
    // EventSource reconnects on its own; surface the state meanwhile.
    onStatus?.(source.readyState === EventSource.CLOSED ? "offline" : "connecting");
  });

  const types: LiveEventType[] = [
    "transaction.created",
    "transaction.reviewed",
    "device.paired",
    "device.updated",
    "device.removed",
    "account.created",
    "account.updated",
    "account.removed",
    "merchant.updated",
    "user.updated",
  ];

  for (const type of types) {
    source.addEventListener(type, dispatch(type));
  }

  return () => {
    source.close();
  };
}
