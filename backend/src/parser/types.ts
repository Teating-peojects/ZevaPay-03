/**
 * Shared types for the provider SMS parser engine.
 */

/** Direction of the money movement described by a notification. */
export type TransactionDirection = "credit" | "debit";

/** What the message says happened, before confidence is applied. */
export type ParseOutcome =
  /** Money arrived. */
  | "payment_received"
  /** The provider reported that the payment did not go through. */
  | "payment_failed"
  /** Money left the account — an outgoing debit, not an incoming payment. */
  | "payment_debited";

export interface ParseResult {
  provider: "BKASH" | "NAGAD" | "ROCKET" | "UPAY";
  /** Amount in BDT. Null when no amount could be located. */
  amount: number | null;
  direction: TransactionDirection;
  outcome: ParseOutcome;
  /**
   * True when the message itself stated the direction (or reported a
   * failure) rather than the parser inferring it.
   */
  directionExplicit: boolean;
  customerName: string | null;
  customerPhone: string | null;
  /** Provider-side transaction id extracted from the message. */
  providerRef: string | null;
  /** Timestamp embedded in the message, if the provider includes one. */
  occurredAt: Date | null;
  /** 0..1 — how confident the parser is that the fields are correct. */
  confidence: number;
  /** Human-readable reasons behind the confidence score. */
  reasons: string[];
  /** Field names that could not be determined. */
  missing: string[];
}

export interface ProviderParser {
  provider: ParseResult["provider"];
  /** Cheap check used to route a message to this parser. */
  matches(text: string): boolean;
  parse(text: string): ParseResult;
}

/** Parser confidence threshold for routing; it never confirms a payment. */
export const AUTO_ACCEPT_CONFIDENCE = 0.9;
