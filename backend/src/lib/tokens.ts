import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { sha256, randomToken } from "./hash.js";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  merchantId: string | null;
  typ: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  typ: "refresh";
}

/**
 * Parses a duration string like `15m`, `30d`, `12h`, `3600` into seconds.
 */
export function parseTtl(ttl: string): number {
  const match = /^(\d+)([smhd])?$/.exec(ttl.trim());
  if (!match) return 0;
  const value = Number(match[1]);
  switch (match[2]) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 3600;
    case "d":
      return value * 86400;
    default:
      return value;
  }
}

/**
 * Issues a stateless access token. Access tokens are short-lived and are not
 * persisted; the refresh token row is the source of truth for revocation.
 */
export async function issueAccessToken(
  app: FastifyInstance,
  user: {
    id: string;
    email: string;
    role: string;
    merchantId: string | null;
  },
): Promise<string> {
  const payload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    merchantId: user.merchantId,
    typ: "access",
  };

  return app.jwt.sign(payload, { expiresIn: config.jwt.accessTtl });
}

/**
 * Issues a refresh token. Only the SHA-256 hash of the token is stored, so a
 * database leak cannot be replayed against the API.
 */
export async function issueRefreshToken(
  userId: string,
  meta: { userAgent?: string | null; ipAddress?: string | null } = {},
): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
  const token = randomToken(48);
  const expiresAt = new Date(Date.now() + parseTtl(config.jwt.refreshTtl) * 1000);

  const session = await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      type: "REFRESH",
      userId,
      expiresAt,
      userAgent: meta.userAgent ?? null,
      ipAddress: meta.ipAddress ?? null,
    },
    select: { id: true },
  });

  return { token, sessionId: session.id, expiresAt };
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresAt: Date;
}

export async function issueSession(
  app: FastifyInstance,
  user: {
    id: string;
    email: string;
    role: string;
    merchantId: string | null;
  },
  meta: { userAgent?: string | null; ipAddress?: string | null } = {},
): Promise<SessionTokens> {
  const accessToken = await issueAccessToken(app, user);
  const refresh = await issueRefreshToken(user.id, meta);

  return {
    accessToken,
    refreshToken: refresh.token,
    expiresIn: parseTtl(config.jwt.accessTtl),
    refreshExpiresAt: refresh.expiresAt,
  };
}

/** Cookie names used for browser sessions. */
export const ACCESS_COOKIE = "zp_access";
export const REFRESH_COOKIE = "zp_refresh";

/**
 * Writes the session cookies.
 *
 * Both cookies are `httpOnly` so that no script — including any script on
 * the page — can read the tokens, and `sameSite: "lax"` so they are not
 * sent on cross-site requests. The refresh cookie is only sent to the API's
 * own origin.
 */
export function setSessionCookies(
  reply: import("fastify").FastifyReply,
  tokens: SessionTokens,
): void {
  const secure = config.isProduction;

  reply.setCookie(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: tokens.expiresIn,
  });

  reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: Math.floor(
      (tokens.refreshExpiresAt.getTime() - Date.now()) / 1000,
    ),
  });
}

/** Clears the session cookies. */
export function clearSessionCookies(
  reply: import("fastify").FastifyReply,
): void {
  const secure = config.isProduction;

  reply.clearCookie(ACCESS_COOKIE, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
  });
  reply.clearCookie(REFRESH_COOKIE, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
  });
}

/**
 * Rotates a refresh token: the presented token is revoked and a fresh pair is
 * issued. Returns null when the token is unknown, expired or already used.
 */
export async function rotateSession(
  app: FastifyInstance,
  refreshToken: string,
  meta: { userAgent?: string | null; ipAddress?: string | null } = {},
): Promise<
  | (SessionTokens & { userId: string })
  | null
> {
  const tokenHash = sha256(refreshToken);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  if (!session.user.isActive) return null;

  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  const tokens = await issueSession(
    app,
    {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      merchantId: session.user.merchantId,
    },
    meta,
  );

  return { ...tokens, userId: session.user.id };
}

/** Revokes every live refresh session for a user (used on sign-out). */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Removes expired session rows. Called periodically by the server. */
export async function pruneExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
