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
 * Transaction reference, e.g. `TXN-100245`. The numeric part is a
 * monotonically increasing counter derived from the row id so references
 * stay unique and sortable without a dedicated sequence.
 */
export function generateTransactionReference(): string {
  const value = Math.floor(Math.random() * 900_000) + 100_000;
  return `TXN-${value}`;
}

/**
 * A new API key: `zp_live_` followed by 192 bits from the system's
 * cryptographic random source. The prefix lets a key be recognised on sight
 * (and by secret scanners) without revealing anything about the rest.
 */
export function generateApiKeySecret(): string {
  return `zp_live_${randomBytes(24).toString("base64url")}`;
}

/** Whether a value has the shape of an API key. Says nothing about validity. */
export function looksLikeApiKey(value: string): boolean {
  return /^zp_live_[A-Za-z0-9_-]{32}$/.test(value);
}

/**
 * A device's own credential, issued once when it pairs. The prefix lets a
 * leaked token be recognised; only its SHA-256 is stored.
 */
export function generateDeviceToken(): string {
  return `zpd_${randomBytes(24).toString("base64url")}`;
}

/** Whether a value has the shape of a device token. Says nothing about validity. */
export function looksLikeDeviceToken(value: string): boolean {
  return /^zpd_[A-Za-z0-9_-]{32}$/.test(value);
}

/**
 * A key that lets a phone connect to the SMS app. It is not an API key: it
 * cannot create payments. It is shown once, only its SHA-256 is stored, and it
 * is only ever accepted together with the merchant's email and password.
 */
export function generateDeviceKeySecret(): string {
  return `zp_phone_${randomBytes(24).toString("base64url")}`;
}

/** Whether a value has the shape of a phone key. Says nothing about validity. */
export function looksLikeDeviceKey(value: string): boolean {
  return /^zp_phone_[A-Za-z0-9_-]{32}$/.test(value);
}
