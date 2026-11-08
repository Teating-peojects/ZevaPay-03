import { prisma } from "../db.js";
import { ForbiddenError, UnauthorizedError } from "./errors.js";
import { looksLikeApiKey, sha256 } from "./hash.js";

export interface ApiKeyIdentity {
  id: string;
  merchantId: string;
}

/** How often `lastUsedAt` is written, so a busy key does not write per call. */
const LAST_USED_WRITE_INTERVAL_MS = 60_000;

type HeaderValue = string | string[] | undefined;

function first(value: HeaderValue): string | null {
  const single = Array.isArray(value) ? value[0] : value;
  return typeof single === "string" && single.trim() ? single.trim() : null;
}

/**
 * Reads the key from `Authorization: Bearer zp_live_…` or `x-api-key`.
 * The value is only ever compared as a hash and is never logged.
 */
export function readApiKey(headers: Record<string, HeaderValue>): string | null {
  const authorization = first(headers.authorization);
  if (authorization && /^bearer\s+/i.test(authorization)) {
    return authorization.replace(/^bearer\s+/i, "").trim();
  }
  return first(headers["x-api-key"]);
}

/**
 * Identifies the merchant behind an API key.
 *
 * A key that is unknown, malformed, revoked or expired is refused with the
 * same message, so the response does not tell a guesser which it was. A key
 * belonging to a merchant that is not active is refused too: suspending a
 * merchant must stop its integrations, not only its logins.
 */
export async function resolveApiKey(
  headers: Record<string, HeaderValue>,
  now: Date = new Date(),
): Promise<ApiKeyIdentity> {
  const provided = readApiKey(headers);
  const refusal = new UnauthorizedError("A valid API key is required.");
  if (!provided || !looksLikeApiKey(provided)) throw refusal;

  const key = await prisma.apiKey.findUnique({
    where: { keyHash: sha256(provided) },
    select: {
      id: true,
      merchantId: true,
      kind: true,
      revokedAt: true,
      expiresAt: true,
      lastUsedAt: true,
      merchant: { select: { status: true } },
    },
  });
  if (!key || key.kind !== "INTEGRATION" || key.revokedAt || (key.expiresAt && key.expiresAt <= now)) throw refusal;

  if (key.merchant.status !== "ACTIVE") {
    throw new ForbiddenError("This merchant account is not active.");
  }

  if (!key.lastUsedAt || now.getTime() - key.lastUsedAt.getTime() > LAST_USED_WRITE_INTERVAL_MS) {
    // Bookkeeping only: a failure here must not fail the request.
    prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: now } })
      .catch(() => undefined);
  }

  return { id: key.id, merchantId: key.merchantId };
}
