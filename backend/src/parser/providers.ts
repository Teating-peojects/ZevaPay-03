import {
  cleanName,
  extractAmount,
  extractName,
  extractPhone,
  extractProviderRef,
  extractSenderReference,
  extractTimestamp,
  isCredit,
  isDebit,
  isFailure,
  normalize,
} from "./common.js";
import type { ParseOutcome, ParseResult, ProviderParser } from "./types.js";

/**
 * Scores a parse and reports what is missing.
 *
 * The confidence model separates two questions:
 *
 *   1. *Is this an incoming payment at all?* — an outgoing debit or a
 *      provider-reported failure is unambiguous. There is no decision for a
 *      human to make, so these are recorded directly and never enter the
 *      review queue.
 *
 *   2. *Are the details of an incoming payment right?* — this is what the
 *      score measures. Weights:
 *
 *        - a provider reference is worth 0.40
 *        - a recognised amount is worth 0.35
 *        - a sender name is worth 0.15
 *        - a sender phone is worth 0.05
 *        - an embedded timestamp is worth 0.05
 *
 *      The provider reference carries the most weight because it is the only
 *      field that makes a notification traceable back to the provider.
 *      Reaching the 0.9 confidence threshold therefore requires an amount,
 *      a reference and a sender name — exactly the bar for a notification
 *      that can be trusted without a human looking at it.
 */
function score(result: Omit<ParseResult, "confidence" | "reasons" | "missing">) {
  const reasons: string[] = [];
  const missing: string[] = [];
  let confidence = 0;

  if (result.outcome !== "payment_received") {
    // Nothing to disambiguate — the provider already told us what happened.
    return {
      confidence: 1,
      reasons: [
        result.outcome === "payment_failed"
          ? "Provider reported a failed transaction."
          : "Provider reported an outgoing debit.",
      ],
      missing,
    };
  }

  if (result.amount !== null) {
    confidence += 0.35;
    reasons.push("Amount identified.");
  } else {
    missing.push("amount");
  }

  if (result.providerRef) {
    confidence += 0.4;
    reasons.push("Provider reference extracted.");
  } else {
    missing.push("providerRef");
  }

  if (result.customerName) {
    confidence += 0.15;
    reasons.push("Sender name extracted.");
  } else {
    missing.push("customerName");
  }

  if (result.customerPhone) {
    confidence += 0.05;
    reasons.push("Sender phone extracted.");
  } else {
    missing.push("customerPhone");
  }

  if (result.occurredAt) {
    confidence += 0.05;
    reasons.push("Transaction timestamp extracted.");
  } else {
    missing.push("occurredAt");
  }

  if (!result.directionExplicit) {
    missing.push("direction");
  }

  return {
    confidence: Math.min(1, Number(confidence.toFixed(2))),
    reasons,
    missing,
  };
}

function finalise(
  result: Omit<ParseResult, "confidence" | "reasons" | "missing">,
): ParseResult {
  return { ...result, ...score(result) };
}

/**
 * Resolves what the message describes.
 *
 * `directionExplicit` records whether the message actually stated the
 * direction. A message that merely carries a reference is *not* explicit:
 * a reference proves the transaction exists but not which way the money
 * moved, so the parser will not claim to know.
 */
function resolveOutcome(clean: string): {
  direction: "credit" | "debit";
  outcome: ParseOutcome;
  explicit: boolean;
} {
  if (isFailure(clean)) {
    return { direction: "credit", outcome: "payment_failed", explicit: true };
  }
  if (isDebit(clean)) {
    return { direction: "debit", outcome: "payment_debited", explicit: true };
  }
  if (isCredit(clean)) {
    return { direction: "credit", outcome: "payment_received", explicit: true };
  }
  return { direction: "credit", outcome: "payment_received", explicit: false };
}

// ---------------------------------------------------------------------------
// bKash
// ---------------------------------------------------------------------------

const bkashParser: ProviderParser = {
  provider: "BKASH",
  matches: (text) => /bKash|bksh|\bbk\b/i.test(text),
  parse(text) {
    const clean = normalize(text);
    const { direction, outcome, explicit } = resolveOutcome(clean);

    const name = extractName(clean, [
      "from",
      "received from",
      "sender",
      "paid by",
    ]);

    return finalise({
      provider: "BKASH",
      amount: extractAmount(clean),
      direction,
      directionExplicit: explicit,
      outcome,
      customerName: name ? cleanName(name) : null,
      customerPhone: extractPhone(clean),
      providerRef: extractProviderRef(clean),
      senderReference: extractSenderReference(clean),
      occurredAt: extractTimestamp(clean),
    });
  },
};

// ---------------------------------------------------------------------------
// Nagad
// ---------------------------------------------------------------------------

const nagadParser: ProviderParser = {
  provider: "NAGAD",
  matches: (text) => /Nagad|Ngd\b/i.test(text),
  parse(text) {
    const clean = normalize(text);
    const { direction, outcome, explicit } = resolveOutcome(clean);

    const name = extractName(clean, [
      "from",
      "sender",
      "credited by",
      "received",
    ]);

    return finalise({
      provider: "NAGAD",
      amount: extractAmount(clean),
      direction,
      directionExplicit: explicit,
      outcome,
      customerName: name ? cleanName(name) : null,
      customerPhone: extractPhone(clean),
      providerRef: extractProviderRef(clean),
      senderReference: extractSenderReference(clean),
      occurredAt: extractTimestamp(clean),
    });
  },
};

// ---------------------------------------------------------------------------
// Rocket
// ---------------------------------------------------------------------------

const rocketParser: ProviderParser = {
  provider: "ROCKET",
  matches: (text) => /Rocket|RKT\b/i.test(text),
  parse(text) {
    const clean = normalize(text);
    const { direction, outcome, explicit } = resolveOutcome(clean);

    const name = extractName(clean, ["from", "sender", "received from"]);

    return finalise({
      provider: "ROCKET",
      amount: extractAmount(clean),
      direction,
      directionExplicit: explicit,
      outcome,
      customerName: name ? cleanName(name) : null,
      customerPhone: extractPhone(clean),
      providerRef: extractProviderRef(clean),
      senderReference: extractSenderReference(clean),
      occurredAt: extractTimestamp(clean),
    });
  },
};

// ---------------------------------------------------------------------------
// Upay
// ---------------------------------------------------------------------------

const upayParser: ProviderParser = {
  provider: "UPAY",
  matches: (text) => /Upay|UPay\b/i.test(text),
  parse(text) {
    const clean = normalize(text);
    const { direction, outcome, explicit } = resolveOutcome(clean);

    const name = extractName(clean, ["from", "sender", "received from"]);

    return finalise({
      provider: "UPAY",
      amount: extractAmount(clean),
      direction,
      directionExplicit: explicit,
      outcome,
      customerName: name ? cleanName(name) : null,
      customerPhone: extractPhone(clean),
      providerRef: extractProviderRef(clean),
      senderReference: extractSenderReference(clean),
      occurredAt: extractTimestamp(clean),
    });
  },
};

export const PROVIDER_PARSERS: ProviderParser[] = [
  bkashParser,
  nagadParser,
  rocketParser,
  upayParser,
];
