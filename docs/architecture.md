# Architecture

## The shape of the system

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser                                                             │
│  ─ public site (static)  ─ merchant dashboard  ─ admin console      │
│                                                                      │
│  All browser calls go to /api/v1/... on the app's own origin.       │
└───────────────────────────┬──────────────────────────────────────────┘
                            │  httpOnly cookies travel automatically
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Next.js 16 (frontend, :3000)                                       │
│                                                                      │
│  src/app/api/v1/[...path]/route.ts   same-origin proxy → API        │
│  src/proxy.ts                        refreshes the access token     │
│  src/lib/server-api.ts               server-side fetch (cookies)    │
│  src/app/dashboard/layout.tsx        session guard + role redirect  │
│  src/app/admin/layout.tsx            session guard + role redirect  │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Fastify 5 (backend, :4000)                                          │
│                                                                      │
│  routes/auth.ts     sessions, registration, password reset          │
│  routes/merchant.ts the merchant's own records                       │
│  routes/admin.ts    platform-wide operations                         │
│  routes/device.ts   device connect and notification ingest          │
│  routes/stream.ts   Server-Sent Events                               │
│  parser/            one parser per provider + a confidence score     │
│  lib/events.ts      the in-process event hub                         │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PostgreSQL 16 (db, :5432) via Prisma 7 + the pg driver adapter    │
└──────────────────────────────────────────────────────────────────────┘
```

## Why a proxy instead of calling the API directly

The browser could call `http://localhost:4000` cross-origin. It does not,
because of two specific problems that the proxy removes:

1. **Cookie scope.** The session cookie is `SameSite=Lax`. A cross-origin
   `fetch` with `credentials: "include"` would need an exact
   `Access-Control-Allow-Origin` match *and* `Allow-Credentials: true`, and
   `SameSite=Lax` would still block the cookie on a cross-site request. The
   proxy keeps every request same-origin, so the cookie just works.

2. **The event stream.** Server-Sent Events need an unbuffered pipe. A
   reverse proxy or CDN in between tends to buffer, which holds events back
   until the connection closes. The Next.js route handler passes the body
   straight through and sets `x-accel-buffering: no`.

The cost is one extra hop. The benefit is that cookie policy, CORS and
streaming all stop being a problem.

### What the proxy forwards

Everything except hop-by-hop headers (`connection`, `keep-alive`,
`transfer-encoding`, …). `Set-Cookie` is copied back with
`getSetCookie()`, which preserves the multiple cookies the API sets.

If the API is unreachable, the proxy returns `502` with the code
`API_UNREACHABLE` rather than hanging.

## Session handling

```
sign in ──► zp_access (15 min)  +  zp_refresh (30 days)
                │                        │
                │ expires                │ rotated on use
                ▼                        ▼
        src/proxy.ts exchanges the refresh token for a new access token
        before the request goes any further
```

`src/proxy.ts` runs on every `/dashboard/*`, `/admin/*` and `/api/v1/*`
request. It reads the `exp` claim off the access token — without verifying
it, because the API stays the only authority on validity — and if the token
is missing or within 60 seconds of expiry it:

1. calls `POST /api/v1/auth/refresh` with the refresh cookie;
2. rewrites the *request* headers with the new pair, so the request that
   triggered the refresh is not itself rejected;
3. writes the new cookies onto the response.

If the refresh token is no longer valid, both cookies are cleared and the app
sends the user to the sign-in page rather than retrying forever.

Access tokens are stateless JWTs. The refresh token is stored **hashed**
(SHA-256), so a database leak cannot be replayed against the API.

### Server components

Server components cannot set cookies, so they cannot refresh a token
themselves. They forward the caller's cookies to the API directly
(`src/lib/server-api.ts`) and treat a 401 as "signed out", which triggers the
redirect in the dashboard layout.

## Authorization

Two layers, both enforced on the server.

**Role gate.** `app.requireRole([...])` rejects a request whose role is not in
the list. Merchant routes accept `MERCHANT_OWNER`, `MERCHANT_ADMIN`,
`MERCHANT_MANAGER`, `MERCHANT_SUPPORT` and `MERCHANT_VIEWER`; read-only
roles cannot write.

**Tenant gate.** `app.resolveMerchantId(request)` returns the merchant from
the *session*, never from the request. A merchant user therefore cannot reach
another merchant's records by changing an id in the URL — the id is looked up
with `where: { id, merchantId }`, so a foreign id simply returns 404 rather
than 403.

The token carries a role for cheap checks, but the **user row is the source
of truth** and is re-read on every authenticated request. A suspended account
loses access immediately, not when its token happens to expire.

The dashboard layouts enforce the same split on the front end: a platform
admin who opens `/dashboard` is sent to `/admin`, and a merchant who opens
`/admin` is sent back to `/dashboard`.

## The parser engine

```
raw SMS ──► provider detection ──► field extraction ──► confidence ──► status
```

Each provider has its own parser. A parser pulls out what it can:

| Field           | Example                                  |
| --------------- | ---------------------------------------- |
| `amount`        | `Tk 2,450.00` → `2450`                   |
| `customerName`  | `from Rakib Chowdhury`                   |
| `customerPhone` | `Mobile: 01723-445566`                  |
| `providerRef`   | `TrxID: 8H2K4L9M`                        |
| `occurredAt`    | `Date: 2026-11-02 16:58`                 |

**Confidence** is a weighted score over the fields the parser found:

| Field           | Weight |
| --------------- | ------ |
| Provider reference | 0.40 |
| Amount          | 0.35   |
| Sender name     | 0.15   |
| Sender phone    | 0.05   |
| Embedded date   | 0.05   |

The provider reference carries the most weight because it is the only field
that makes a notification traceable back to the provider. Reaching the 0.9
confidence threshold does not verify a real payment. The response reports
which fields were missing, so the reason for a low score is visible.

Two outcomes bypass the scoring entirely, because the provider has already
said what happened and there is nothing for a human to decide:

- a **provider-reported failure** → confidence 1.0;
- an **outgoing debit** → confidence 1.0.

The threshold lives in `AUTO_ACCEPT_CONFIDENCE` (default `0.9`):

- **at or above** → recorded as `PENDING`;
- **below** → recorded as `REVIEW` and put in the review queue, where a
  merchant accepts or rejects it.

The parser never asks the provider whether a payment really happened. It
reports what the SMS said, and how sure it is.

## Live updates

`lib/events.ts` holds an in-process `EventEmitter` and a ring buffer of the
last 200 events.

```
device → POST /device/notifications
            │
            ├─► parse ─► write transaction
            │
            └─► eventHub.publish("merchant:<id>", "transaction.created", …)
                        │
                        ▼
              GET /api/v1/stream (SSE)
                        │
                        ▼
              browser EventSource ─► table.refresh()
```

Channels are `merchant:<id>` for a merchant's own events and `platform` for
administrators. A subscription receives only the channel it is entitled to.

The hub is **in-process**. That is a deliberate limit for a single-instance
deployment: it does not survive a restart, and two API instances behind a load
balancer would not see each other's events. The fix, when it is needed, is to
replace the hub's `EventEmitter` with Redis pub/sub — the call sites
(`eventHub.publish` / `eventHub.subscribe`) do not need to change.

## The device simulator

The Android app is out of scope. `backend/src/tools/simulate.ts` stands in for
it and follows the same flow a real phone would:

1. sign in as a merchant;
2. make a phone key;
3. connect with the email, password and phone key;
4. post provider notifications at a realistic cadence.

It draws from `backend/src/parser/samples.ts`, which holds realistic provider
wording with synthetic reference ids.

```bash
npm --prefix backend run simulate -- \
  --email owner@dhanmondi.test \
  --password 'ZevaPay#2026' \
  --device ZP-SMS-SIM01 \
  --count 10
```

## Data model

| Model            | Holds                                                      |
| ---------------- | ---------------------------------------------------------- |
| `User`           | A person, their role, their merchant and password hash     |
| `Merchant`       | The business, its status and plan                          |
| `PaymentAccount` | A provider account, masked when read back                  |
| `Device`         | A paired phone, its status and last-seen time              |
| `Transaction`    | A parsed notification, its confidence and its review state  |
| `PairingCode`    | Unused since phone keys replaced pairing codes (kept, not dropped) |
| `Session`        | A refresh token (hashed) with its device and IP            |
| `ApiKey`         | A hashed key with its prefix, last use and revocation      |
| `AuditLog`       | An append-only trail of sensitive actions                  |

Every merchant-scoped table carries `merchantId`, and every query is filtered
on it.
