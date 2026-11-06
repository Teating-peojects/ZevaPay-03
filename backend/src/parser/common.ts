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

/**
 * Labels that introduce the provider's own transaction id. bKash writes
 * `TrxID DK3508MJ4R`, Nagad writes `TxnID: NGD778812`.
 */
const TRANSACTION_ID_LABELS =
  "(?:trx\\s*id|txn\\s*id|transaction\\s*id)";

/**
 * Extracts the provider's transaction id, such as `TrxID: 8H2K4L9M`.
 *
 * A message can carry two different things that look alike: the provider's
 * own id (`TrxID DK3508MJ4R`) and a note the sender typed (`Ref ajaj`). Only
 * the first identifies the transaction. The note can come first in the text,
 * so the transaction-id labels are tried before anything else. A bare
 * `Ref` is accepted only as a fallback, because some providers (Upay) use it
 * as their transaction id and write no other.
 */
export function extractProviderRef(text: string): string | null {
  const labelled = new RegExp(
    `${TRANSACTION_ID_LABELS}\\s*[:#-]?\\s*([A-Za-z0-9][A-Za-z0-9-]{3,})`,
    "i",
  ).exec(text);
  if (labelled) return labelled[1].toUpperCase();

  const fallback = /\bref(?:erence)?\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9-]{3,})/i.exec(
    text,
  );
  return fallback ? fallback[1].toUpperCase() : null;
}

/**
 * Extracts the note the sender typed in the provider's Reference field, for
 * example `ajaj` from `Ref ajaj.`.
 *
 * Returns null when the message has no transaction id of its own: in that
 * case `Ref` was already used as the transaction id by `extractProviderRef`,
 * and reporting it twice would mislead.
 */
export function extractSenderReference(text: string): string | null {
  if (
    !new RegExp(`${TRANSACTION_ID_LABELS}\\s*[:#-]?\\s*[A-Za-z0-9]{4}`, "i").test(
      text,
    )
  ) {
    return null;
  }
  const match =
    /\bref(?:erence)?\s*[:#-]?\s*(.{1,60}?)(?=\s*\.(?:\s|$)|\s+(?:fee|balance|charge|trx|txn|transaction)\b|$)/i.exec(
      text,
    );
  const note = match ? match[1].trim() : "";
  return note.length > 0 ? note : null;
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
 * Bangladesh has no daylight saving, so the time printed in an SMS is
 * always UTC+06:00. Reading it in the server's own zone would shift every
 * timestamp by the difference.
 */
const DHAKA_OFFSET = "+06:00";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Builds a Date from SMS date/time parts, or null when they are invalid. */
function dhakaDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  const parsed = new Date(
    `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}${DHAKA_OFFSET}`,
  );
  if (Number.isNaN(parsed.getTime())) return null;
  // `new Date` rolls 31 Feb over to March. Reject that rather than store a
  // date the message never said.
  const check = new Date(parsed.getTime() + 6 * 60 * 60 * 1000);
  if (check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null;
  return parsed;
}

function to24Hour(hour: number, meridiem: string | undefined): number {
  if (!meridiem) return hour;
  const pm = meridiem.toUpperCase() === "PM";
  if (hour === 12) return pm ? 12 : 0;
  return pm ? hour + 12 : hour;
}

/**
 * Extracts a timestamp embedded in the message.
 *
 * Accepted: `2026-11-02 16:58` and the day-first form providers use,
 * `03/11/2026 18:09` (3 November, never 11 March). Times are read as
 * Bangladesh time.
 */
export function extractTimestamp(text: string): Date | null {
  const iso =
    /(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i.exec(
      text,
    );
  if (iso) {
    const parsed = dhakaDate(
      Number(iso[1]),
      Number(iso[2]),
      Number(iso[3]),
      to24Hour(Number(iso[4]), iso[7]),
      Number(iso[5]),
      Number(iso[6] ?? 0),
    );
    if (parsed) return parsed;
  }

  const dayFirst =
    /(\d{1,2})\/(\d{1,2})\/(\d{2,4})[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i.exec(
      text,
    );
  if (dayFirst) {
    const rawYear = Number(dayFirst[3]);
    const parsed = dhakaDate(
      rawYear < 100 ? 2000 + rawYear : rawYear,
      Number(dayFirst[2]),
      Number(dayFirst[1]),
      to24Hour(Number(dayFirst[4]), dayFirst[7]),
      Number(dayFirst[5]),
      Number(dayFirst[6] ?? 0),
    );
    if (parsed) return parsed;
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
