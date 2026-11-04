/**
 * Shared helpers used by the individual provider parsers.
 */

/** Normalises a message so parsers can rely on a single shape. */
export function normalize(text: string): string {
  return text
    .replace(/ /g, " ")
    .replace(/\r\n|\r|\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Removes the parts of a message that can never contain an amount:
 * transaction identifiers, dates and times. Without this, a reference such
 * as `TxnID: NGD330091` would be mistaken for an amount.
 */
export function stripNoise(text: string): string {
  return text
    .replace(
      /\b(?:trx|txn|trans(?:action)?)[\s-]*id\b\s*[:#-]?\s*[A-Za-z0-9-]+/gi,
      " ",
    )
    .replace(/\bref(?:erence)?\b\s*[:#-]?\s*[A-Za-z0-9-]+/gi, " ")
    .replace(/\+?88[\s-]?0[1-9](?:[\s-]?\d){8}\b/g, " ")
    .replace(/\b0[1-9](?:[\s-]?\d){8}\b/g, " ")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, " ")
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\b/gi, " ");
}

/**
 * Extracts a monetary amount. Handles `Tk 2,450.00`, `BDT 2450`, `৳500`,
 * `500 Taka` and bare comma-grouped digits.
 */
export function extractAmount(text: string): number | null {
  const clean = stripNoise(text);

  const patterns = [
    /(?:tk\.?|taka|bdt|৳)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    /([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:tk\.?|taka|bdt|৳)\b/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(clean);
    if (match) {
      const value = Number(match[1].replace(/,/g, ""));
      if (Number.isFinite(value) && value > 0) return value;
    }
  }

  // Fall back to a bare grouped number, but only when it is not part of a
  // longer token such as a phone number.
  const bare = /(?:^|\s)([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]{3,})(?![0-9-])/.exec(
    clean,
  );
  if (bare) {
    const value = Number(bare[1].replace(/,/g, ""));
    if (Number.isFinite(value) && value > 0) return value;
  }

  return null;
}

/** Extracts a provider transaction reference such as `TrxID: 8H2K4L9M`. */
export function extractProviderRef(text: string): string | null {
  const match =
    /(?:trx\s*id|trxid|txn\s*id|txnid|transaction\s*id|ref(?:erence)?)\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9-]{3,})/i.exec(
      text,
    );
  return match ? match[1].toUpperCase() : null;
}

/** Extracts a mobile number in `01XXXXXXXXX` or international form. */
export function extractPhone(text: string): string | null {
  // Providers format numbers with spaces or dashes, e.g. `01866-221334`.
  const bangladesh = /(?:\+?88[\s-]?)?(01[3-9](?:[\s-]?\d){8})(?!\d)/.exec(text);
  if (bangladesh) return bangladesh[1].replace(/\D/g, "");
  const loose = /(?:\+?88[\s-]?)?(0[1-9](?:[\s-]?\d){8})(?!\d)/.exec(text);
  return loose ? loose[1].replace(/\D/g, "") : null;
}

/**
 * Extracts a sender name. Providers phrase this differently, so the caller
 * passes the labels it expects ("from", "sender", "received from", ...).
 */
export function extractName(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const pattern = new RegExp(
      `${label}\\s*[:\\-]?\\s*([A-Za-z][A-Za-z0-9 .'&#&\\-]{1,60}?)(?=\\s*(?:[,.;:#(\\)]|\\b(?:trx|txn|ref|on|at|from|sender|for|balance|charge|account|amount|date|mobile)\\b)|$)`,
      "i",
    );
    const match = pattern.exec(text);
    if (match) {
      const name = match[1].trim().replace(/[.,;:\\-]+$/, "");
      if (name.length >= 2) return name;
    }
  }
  return null;
}

/** True when the message describes money arriving. */
export function isCredit(text: string): boolean {
  return (
    /received/i.test(text) ||
    /credited/i.test(text) ||
    /deposited/i.test(text) ||
    /\bincoming\b/i.test(text) ||
    /\bpayment received\b/i.test(text)
  );
}

/** True when the message describes a failed or reversed payment. */
export function isFailure(text: string): boolean {
  return (
    /failed/i.test(text) ||
    /declined/i.test(text) ||
    /could not be completed/i.test(text) ||
    /unsuccessful/i.test(text) ||
    /reversed/i.test(text)
  );
}

/** True when the message describes money leaving the account. */
export function isDebit(text: string): boolean {
  return (
    /debited/i.test(text) ||
    /charged/i.test(text) ||
    /\bsent\b/i.test(text) ||
    /paid to/i.test(text) ||
    /outgoing/i.test(text) ||
    /balance depleted/i.test(text)
  );
}

/**
 * Extracts a timestamp embedded in the message. Providers use several
 * formats; we accept the common ones and normalise to a Date.
 */
export function extractTimestamp(text: string): Date | null {
  const patterns: RegExp[] = [
    /(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/,
    /(\d{1,2}\/\d{1,2}\/\d{4})[ ,](\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i,
    /(\d{1,2}\/\d{1,2}\/\d{2,4})[ ,](\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const parsed = new Date(
      match[1].replace(/\//g, "-").trim() +
        "T" +
        match[2].trim().toUpperCase().replace(/\s+/g, ""),
    );
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

/** Removes provider boilerplate from a name captured mid-sentence. */
export function cleanName(name: string): string {
  return name
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/, "")
    .trim();
}
