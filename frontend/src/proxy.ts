import { NextResponse, type NextRequest } from "next/server";

/**
 * Session refresh.
 *
 * The API issues a short-lived access token (15 minutes by default) alongside
 * a long-lived refresh token. Both live in httpOnly cookies, so the browser
 * never has to know about them — but something has to swap the access token
 * before it expires, otherwise every request starts failing with a 401.
 *
 * This middleware runs before each request. When the access token is missing
 * or about to expire it exchanges the refresh token for a fresh pair and
 * writes the new cookies onto the response.
 */

const API_URL = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000"
).replace(/\/$/, "");

/** Refresh this many milliseconds before the access token actually expires. */
const REFRESH_MARGIN_MS = 60_000;

/**
 * Reads the `exp` claim from a JWT. The token is not verified here — the API
 * stays the only authority on validity. This is only used to decide *when* to
 * refresh.
 */
function accessTokenExpiry(token: string): number | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const normalised = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalised.padEnd(
      normalised.length + ((4 - (normalised.length % 4)) % 4),
      "=",
    );
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

interface CookieAttributes {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number | undefined;
}

/** Reads the attributes off a raw `Set-Cookie` header value. */
function readAttributes(raw: string): CookieAttributes {
  const attributes: CookieAttributes = {
    httpOnly: false,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: undefined,
  };

  for (const part of raw.split(";").slice(1)) {
    const [key, value] = part.split("=").map((piece) => piece.trim());
    const lower = key.toLowerCase();

    if (lower === "httponly") attributes.httpOnly = true;
    else if (lower === "secure") attributes.secure = true;
    else if (lower === "path" && value) attributes.path = value;
    else if (lower === "max-age" && value) attributes.maxAge = Number(value);
    else if (lower === "samesite" && value) {
      const normalised = value.toLowerCase();
      if (
        normalised === "lax" ||
        normalised === "strict" ||
        normalised === "none"
      ) {
        attributes.sameSite = normalised;
      }
    }
  }

  return attributes;
}

export async function proxy(request: NextRequest) {
  const access = request.cookies.get("zp_access")?.value;
  const refresh = request.cookies.get("zp_refresh")?.value;

  // Nothing to refresh without a refresh token.
  if (!refresh) return NextResponse.next();

  const expiry = access ? accessTokenExpiry(access) : null;
  const stillFresh =
    expiry !== null && expiry - Date.now() > REFRESH_MARGIN_MS;
  if (stillFresh) return NextResponse.next();

  let refreshed: Response;
  try {
    refreshed = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { cookie: `zp_refresh=${refresh}` },
      cache: "no-store",
    });
  } catch {
    // The API is unreachable. Let the request through so the page can show
    // its own error state rather than failing here.
    return NextResponse.next();
  }

  if (!refreshed.ok) {
    // The refresh token is no longer valid. Clear the cookies so the app
    // sends the user to the sign-in page instead of retrying forever.
    const response = NextResponse.next();
    response.cookies.delete("zp_access");
    response.cookies.delete("zp_refresh");
    return response;
  }

  // The refreshed pair has to replace the stale cookies *in the request* as
  // well as in the response, otherwise the very request that triggered the
  // refresh would still carry the expired access token downstream.
  const requestHeaders = new Headers(request.headers);
  const nextCookies: string[] = [];

  for (const raw of refreshed.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    const separator = pair.indexOf("=");
    if (separator === -1) continue;

    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (!name) continue;

    nextCookies.push(`${name}=${value}`);
  }

  if (nextCookies.length > 0) {
    requestHeaders.set("cookie", nextCookies.join("; "));
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Write the new cookies onto the response so the browser stores them.
  for (const raw of refreshed.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    const separator = pair.indexOf("=");
    if (separator === -1) continue;

    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (!name) continue;

    response.cookies.set(name, value, readAttributes(raw));
  }

  return response;
}

export const config = {
  matcher: [
    // Everything that can need a session: the dashboards, the admin console
    // and the API proxy.
    "/dashboard/:path*",
    "/admin/:path*",
    "/api/v1/:path*",
  ],
};
