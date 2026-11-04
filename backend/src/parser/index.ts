import { PROVIDER_PARSERS } from "./providers.js";
import type { ParseResult, ProviderParser } from "./types.js";

export * from "./types.js";
export { PROVIDER_PARSERS } from "./providers.js";

export interface ParseOptions {
  /**
   * Provider hint. Devices are bound to a payment account, so the provider is
   * known before parsing — the hint is used to pick the right parser even if
   * the message body itself does not mention the provider.
   */
  expectedProvider?: ParseResult["provider"];
}

export interface ParseOutcomeResult {
  result: ParseResult;
  /** The parser that handled the message. */
  parser: ProviderParser["provider"];
  /** True when no provider could be identified at all. */
  ambiguous: boolean;
}

/**
 * Parses a provider SMS notification.
 *
 * The parser for the expected provider always wins when one is supplied;
 * otherwise the message is routed by its own content.
 */
export function parseNotification(
  text: string,
  options: ParseOptions = {},
): ParseOutcomeResult {
  const expected = options.expectedProvider;

  if (expected) {
    const parser = PROVIDER_PARSERS.find((p) => p.provider === expected);
    if (parser) {
      return { result: parser.parse(text), parser: parser.provider, ambiguous: false };
    }
  }

  const matched = PROVIDER_PARSERS.find((parser) => parser.matches(text));
  if (matched) {
    return { result: matched.parse(text), parser: matched.provider, ambiguous: false };
  }

  // Nothing matched. We still know how to read the amount and the direction,
  // so build a conservative result that will land in the Review queue.
  return {
    result: {
      provider: expected ?? "BKASH",
      amount: null,
      direction: "credit",
      directionExplicit: false,
      outcome: "payment_received",
      customerName: null,
      customerPhone: null,
      providerRef: null,
      occurredAt: null,
      confidence: 0,
      reasons: ["Provider could not be identified from the message."],
      missing: [
        "provider",
        "amount",
        "direction",
        "providerRef",
        "customerName",
        "customerPhone",
        "occurredAt",
      ],
    },
    parser: expected ?? "BKASH",
    ambiguous: true,
  };
}
