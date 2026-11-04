import { NextResponse } from "next/server";

/**
 * Same-origin proxy to the ZevaPay API.
 *
 * Browser code calls `/api/v1/...` on the app's own origin and this handler
 * forwards the request to the API service. Two things fall out of that:
 *
 *  - the session cookie stays first-party, so `sameSite=lax` works and no
 *    CORS pre-flight is needed for credentialed requests;
 *  - the live event stream (Server-Sent Events) can be piped straight
 *    through without a buffering proxy in between.
 *
 * The API's `Set-Cookie` headers are copied back verbatim.
 */

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "content-encoding",
]);

async function proxy(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const search = new URL(request.url).search;
  const target = `${API_URL.replace(/\/$/, "")}/api/v1/${path.join("/")}${search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) return;
    if (lower === "cookie") return;
    headers.set(key, value);
  });

  // Forward the browser's session cookie to the API.
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";

  const body = hasBody ? await request.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "API_UNREACHABLE",
          message:
            "The ZevaPay API is not responding. Check that the backend is running.",
        },
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) return;
    if (lower === "set-cookie") return;
    responseHeaders.set(key, value);
  });

  // `Set-Cookie` may appear more than once, so it has to be copied with
  // `getSetCookie()` rather than a plain `get()`.
  const setCookies = upstream.headers.getSetCookie();
  for (const cookie of setCookies) {
    responseHeaders.append("set-cookie", cookie);
  }

  // Server-Sent Events must not be buffered.
  const contentType = upstream.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    responseHeaders.set("cache-control", "no-cache, no-transform");
    responseHeaders.set("x-accel-buffering", "no");
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
