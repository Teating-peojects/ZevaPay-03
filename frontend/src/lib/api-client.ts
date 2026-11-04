/**
 * Typed client for the ZevaPay API.
 *
 * The session lives in httpOnly cookies set by the API, so this module never
 * reads, writes or stores a token itself. It only forwards the browser's
 * cookie jar and unwraps the JSON response.
 *
 * Browser requests go to the app's own origin and are proxied to the API by
 * the rewrite in `next.config.ts`. That keeps the session cookie first-party
 * (no CORS round-trip, no cross-site cookie restrictions) and lets the live
 * event stream use the same origin. Server-side requests use the absolute
 * API URL and forward the caller's cookie explicitly.
 */

/** Absolute API origin, used by server-side calls. */
export const SERVER_API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Field-level messages, when the API returned validation details. */
  get fieldErrors(): Record<string, string> {
    if (!this.details || typeof this.details !== "object") return {};
    const entries = Object.entries(this.details as Record<string, unknown>);
    const result: Record<string, string> = {};
    for (const [key, value] of entries) {
      if (typeof value === "string") result[key] = value;
    }
    return result;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Query parameters. Undefined and empty values are omitted. */
  query?: Record<string, string | number | undefined | null>;
  signal?: AbortSignal;
  /** Server-side calls should opt out of the framework cache. */
  cache?: RequestCache;
  /** Absolute API origin. Omit for same-origin (proxied) requests. */
  baseUrl?: string;
  /** Server-side requests need the cookie header forwarded explicitly. */
  forwardCookies?: string;
}

function buildQuery(query?: RequestOptions["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

function buildUrl(
  path: string,
  query?: RequestOptions["query"],
  baseUrl?: string,
): string {
  const normalised = path.startsWith("/") ? path : `/${path}`;

  if (baseUrl) {
    return `${baseUrl.replace(/\/$/, "")}${normalised}${buildQuery(query)}`;
  }

  return `${normalised}${buildQuery(query)}`;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Performs an API request and returns the parsed body.
 * Throws an `ApiError` for any non-2xx response.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    query,
    signal,
    cache,
    baseUrl,
    forwardCookies,
  } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (forwardCookies) headers.cookie = forwardCookies;

  const response = await fetch(buildUrl(path, query, baseUrl), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "include",
    ...(cache ? { cache } : {}),
    ...(signal ? { signal } : {}),
  });

  const payload = await parseBody(response);

  if (!response.ok) {
    const errorBody = payload as ApiErrorBody | null;
    const error = errorBody?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "REQUEST_FAILED",
      error?.message ?? "The request could not be completed.",
      error?.details,
    );
  }

  return payload as T;
}

/**
 * Same as `apiFetch` but returns `null` instead of throwing when the session
 * has expired. Used by server components that redirect on 401.
 */
export async function apiFetchOptional<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T | null> {
  try {
    return await apiFetch<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
