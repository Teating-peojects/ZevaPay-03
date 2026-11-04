/**
 * Payment status vocabulary.
 *
 * The product spec defines eight statuses. The backend currently models
 * four. This module is the single place that reconciles the two, so no
 * screen ever has to guess which label to show.
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

/** The four statuses the backend can currently store. */
export type BackendStatus = "SUCCESS" | "PENDING" | "REVIEW" | "FAILED";

/** Product status → backend status, for records read from the API. */
export const SPEC_TO_BACKEND: Record<PaymentStatus, BackendStatus | null> = {
  CREATED: null,
  PENDING: "PENDING",
  REVIEW: "REVIEW",
  CONFIRMED: "SUCCESS",
  FAILED: "FAILED",
  EXPIRED: null,
  CANCELLED: null,
  REFUNDED: null,
};

/** Backend status → product status, for records read from the API. */
export const BACKEND_TO_SPEC: Record<BackendStatus, PaymentStatus> = {
  SUCCESS: "CONFIRMED",
  PENDING: "PENDING",
  REVIEW: "REVIEW",
  FAILED: "FAILED",
};

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

/** Converts a backend status into the product status. */
export function toSpecStatus(status: BackendStatus): PaymentStatus {
  return BACKEND_TO_SPEC[status];
}

/** Converts a product status into the backend status, or null if unsupported. */
export function toBackendStatus(status: PaymentStatus): BackendStatus | null {
  return SPEC_TO_BACKEND[status];
}

/** Display metadata for a product status. */
export function statusDisplay(status: PaymentStatus): StatusDisplay {
  return STATUS_DISPLAY[status];
}

/** Short label for a product status. */
export function statusLabel(status: PaymentStatus): string {
  return STATUS_DISPLAY[status].label;
}
