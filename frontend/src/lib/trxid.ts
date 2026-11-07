/**
 * Cleans a TrxID typed by a person: no spaces, upper case, and only the
 * characters a TrxID can contain. Returns null when it cannot be one.
 *
 * The server applies the same rule and is the authority; this only catches a
 * typo before a request is made.
 */
export function cleanTrxId(raw: string): string | null {
  const cleaned = raw.trim().replace(/\s+/g, "").toUpperCase();
  return /^[A-Z0-9][A-Z0-9-]{3,29}$/.test(cleaned) ? cleaned : null;
}

export const TRXID_HELP =
  "Enter the TrxID exactly as in the confirmation message: 4 to 30 letters or numbers.";
