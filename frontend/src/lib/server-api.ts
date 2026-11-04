import "server-only";
import { cookies } from "next/headers";
import {
  ApiError,
  apiFetch,
  SERVER_API_URL,
  type RequestOptions,
} from "./api-client";
import type { SessionResponse } from "@/types/api";

/**
 * Server-side API access.
 *
 * The session cookie is httpOnly, so it has to be forwarded explicitly from
 * the incoming request to the API. This module is server-only.
 */

async function cookieHeader(): Promise<string | undefined> {
  const store = await cookies();
  const parts: string[] = [];

  const access = store.get("zp_access")?.value;
  if (access) parts.push(`zp_access=${access}`);

  const refresh = store.get("zp_refresh")?.value;
  if (refresh) parts.push(`zp_refresh=${refresh}`);

  return parts.length > 0 ? parts.join("; ") : undefined;
}

/**
 * Performs an API request with the caller's session cookie attached.
 * Returns `null` when the session is missing or expired.
 */
export async function serverFetch<T>(
  path: string,
  options: Omit<RequestOptions, "forwardCookies" | "baseUrl"> = {},
): Promise<T | null> {
  const forwardCookies = await cookieHeader();

  try {
    return await apiFetch<T>(path, {
      ...options,
      baseUrl: SERVER_API_URL,
      forwardCookies,
      cache: options.cache ?? "no-store",
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/**
 * Fetches the current session, or null when the caller is signed out.
 *
 * A network failure is treated the same as an expired session: we cannot
 * confirm who the caller is, so the dashboard sends them to the sign-in
 * page rather than failing the whole render.
 */
export async function getSession(): Promise<SessionResponse | null> {
  try {
    return await serverFetch<SessionResponse>("/api/v1/auth/me");
  } catch {
    return null;
  }
}
