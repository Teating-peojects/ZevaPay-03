import { createHash, randomBytes } from "node:crypto";

/** SHA-256 hex digest — used for token and API-key lookups. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** URL-safe random token. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Human-friendly pairing code, e.g. `ZP-4821-KQ`.
 * Excludes characters that are easy to confuse when read aloud.
 */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generatePairingCode(): string {
  const pick = (length: number) =>
    Array.from({ length }, () => {
      const index = Math.floor(Math.random() * CODE_ALPHABET.length);
      return CODE_ALPHABET[index];
    }).join("");

  return `ZP-${pick(4)}-${pick(2)}`;
}

/**
 * Transaction reference, e.g. `TXN-100245`. The numeric part is a
 * monotonically increasing counter derived from the row id so references
 * stay unique and sortable without a dedicated sequence.
 */
export function generateTransactionReference(): string {
  const value = Math.floor(Math.random() * 900_000) + 100_000;
  return `TXN-${value}`;
}
