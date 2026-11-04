/**
 * Payment status vocabulary.
 *
 * The backend stores the same eight statuses the product uses (`CREATED`,
 * `PENDING`, `REVIEW`, `CONFIRMED`, `FAILED`, `EXPIRED`, `CANCELLED`,
 * `REFUNDED`), so there is no translation layer. This module is the single
 * place that decides which label and tone each status gets.
 *
 * The most important rule lives here: a parser match is not proof of
 * payment. `CONFIRMED` means "we received a notification that looked like
 * this" — never "the money is in the account". The labels below are
 * deliberately worded to keep that honest.
 */

/** The eight product statuses. */
export type PaymentStatus =
  | "CREATED"
  | "PENDING"
  | "REVIEW"
  | "CONFIRMED"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED"
  | "REFUNDED";

export interface StatusDisplay {
  /** Short label shown in badges and table cells. */
  label: string;
  /** Longer explanation shown in detail panels and tooltips. */
  description: string;
  tone: "neutral" | "success" | "warning" | "info" | "danger";
  /** Whether the record still needs a human decision. */
  actionable: boolean;
}

export const STATUS_DISPLAY: Record<PaymentStatus, StatusDisplay> = {
  CREATED: {
    label: "Created",
    description: "A payment request exists but has not been submitted yet.",
    tone: "neutral",
    actionable: false,
  },
  PENDING: {
    label: "Awaiting verification",
    description:
      "A notification was recorded but has not been matched to a provider confirmation yet.",
    tone: "warning",
    actionable: true,
  },
  REVIEW: {
    label: "Needs review",
    description:
      "The parser was not confident enough to accept this record, so it needs a human decision.",
    tone: "info",
    actionable: true,
  },
  CONFIRMED: {
    label: "Confirmed from SMS",
    description:
      "Confirmed from a recorded notification. This is not a provider-side settlement check.",
    tone: "success",
    actionable: false,
  },
  FAILED: {
    label: "Verification failed",
    description: "The recorded notification did not match a payment we could accept.",
    tone: "danger",
    actionable: true,
  },
  EXPIRED: {
    label: "Expired",
    description: "The payment link expired before it was paid.",
    tone: "neutral",
    actionable: false,
  },
  CANCELLED: {
    label: "Cancelled",
    description: "The payment request was cancelled before it was paid.",
    tone: "neutral",
    actionable: false,
  },
  REFUNDED: {
    label: "Refunded",
    description: "The payment was refunded. The refund itself is not a provider confirmation.",
    tone: "neutral",
    actionable: false,
  },
};

/** Statuses that count as money in. Used by the metrics and the charts. */
export const SUCCESSFUL_STATUSES: PaymentStatus[] = ["CONFIRMED"];

/** Statuses that are waiting on somebody. Used for the alert counters. */
export const ACTIONABLE_STATUSES: PaymentStatus[] = ["PENDING", "REVIEW", "FAILED"];

export const ALL_STATUSES: PaymentStatus[] = [
  "CREATED",
  "PENDING",
  "REVIEW",
  "CONFIRMED",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
  "REFUNDED",
];

/**
 * Shown for a status this build does not know about, e.g. one a newer API
 * added. A record must never fail to render because of an unfamiliar value.
 */
const UNKNOWN_STATUS: StatusDisplay = {
  label: "Unknown status",
  description: "The API returned a status this version of the app does not recognise.",
  tone: "neutral",
  actionable: false,
};

/** Display metadata for a status. Falls back safely for unknown values. */
export function statusDisplay(status: PaymentStatus): StatusDisplay {
  return STATUS_DISPLAY[status] ?? UNKNOWN_STATUS;
}

/** Short label for a status. */
export function statusLabel(status: PaymentStatus): string {
  return statusDisplay(status).label;
}

/**
 * Options for a status filter. The values are exactly what the API accepts
 * in its `status` query parameter.
 */
export const STATUS_FILTER_OPTIONS: { value: PaymentStatus; label: string }[] =
  ALL_STATUSES.map((status) => ({
    value: status,
    label: STATUS_DISPLAY[status].label,
  }));
