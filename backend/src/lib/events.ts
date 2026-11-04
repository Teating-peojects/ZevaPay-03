import { EventEmitter } from "node:events";

/**
 * Lightweight in-process event hub used to push live updates to the
 * dashboards over Server-Sent Events.
 *
 * Events are keyed by channel. A merchant dashboard subscribes to
 * `merchant:<id>` and the admin console subscribes to `platform`.
 */
export interface StreamEvent {
  channel: string;
  type: string;
  payload: unknown;
  at: string;
}

class EventHub {
  private readonly emitter = new EventEmitter();
  private readonly recent: StreamEvent[] = [];

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  publish(channel: string, type: string, payload: unknown): void {
    const event: StreamEvent = {
      channel,
      type,
      payload,
      at: new Date().toISOString(),
    };

    this.recent.push(event);
    if (this.recent.length > 200) this.recent.shift();

    this.emitter.emit("event", event);
  }

  subscribe(listener: (event: StreamEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => {
      this.emitter.off("event", listener);
    };
  }

  /** Recent activity, used by the dashboard to backfill missed events. */
  history(channel?: string): StreamEvent[] {
    if (!channel) return [...this.recent];
    return this.recent.filter((event) => event.channel === channel);
  }
}

export const eventHub = new EventHub();

/** Channel names used across the app. */
export const channels = {
  merchant: (merchantId: string) => `merchant:${merchantId}`,
  platform: "platform",
  account: (merchantId: string, accountId: string) =>
    `merchant:${merchantId}:account:${accountId}`,
} as const;
