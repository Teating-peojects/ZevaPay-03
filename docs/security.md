# Security

This document describes what ZevaPay actually protects, and — just as
importantly — what it does not.

---

## The security model in one paragraph

A signed-in person holds a session cookie; a device holds its own token; a platform administrator holds a role that the API re-checks on every
request. Merchant data is isolated by tenant at the query level, not by
convention. Tokens never reach browser storage. Sensitive actions are written
to an append-only audit log.

---

## Sessions

| Property         | Value                                            |
| ---------------- | ------------------------------------------------ |
| Transport        | `httpOnly` — no script can read the token        |
| `SameSite`       | `Lax` — not sent on cross-site requests           |
| `Secure`         | Set automatically when `NODE_ENV=production`     |
| Path             | `/`                                               |
| Access lifetime  | 15 minutes (`JWT_ACCESS_TTL`)                    |
| Refresh lifetime | 30 days (`JWT_REFRESH_TTL`)                      |

**Nothing is stored in `localStorage`, `sessionStorage` or a readable cookie.**
An XSS bug cannot exfiltrate the session token because no script can read it.

Access tokens are stateless JWTs signed with `JWT_SECRET`. Refresh tokens are
stored **hashed** (SHA-256) in the `Session` table, so a database dump cannot
be replayed against the API. Refreshing rotates the token: the presented one
is revoked and a fresh pair is issued.

Changing a password revokes every other session for that user.

### What the token is allowed to be

The access token carries `sub`, `email`, `role` and `merchantId`. The API
treats the role as a hint, not as the truth — it re-reads the user row on
every authenticated request. A user who is deactivated therefore loses access
immediately, not when their token happens to expire.

---

## Passwords

Hashed with **argon2id** through the `argon2` package. The policy requires at
least 10 characters, one uppercase letter, one lowercase letter and one
digit, and it is enforced by a shared Zod schema that both the API and the
front end use — so the browser and the server agree on what is valid.

Failed sign-ins are recorded in the audit log with the reason.

---

## Authorization

Two independent gates, both on the server.

**Roles.** `MERCHANT_VIEWER` and `MERCHANT_SUPPORT` are read-only.
`MERCHANT_MANAGER`, `MERCHANT_ADMIN` and `MERCHANT_OWNER` can write within their own merchant.
`SUPER_ADMIN` and `ADMIN` can operate the admin console. Adding a team member is
restricted to `MERCHANT_OWNER` and `MERCHANT_ADMIN`.

**Tenants.** The merchant is always resolved from the *session* via
`app.resolveMerchantId(request)`, never from a request body or query
parameter. Every merchant-scoped query is filtered on `merchantId`, so a
foreign record id returns `404` rather than leaking its contents.

**Merchant status.** A `SUSPENDED` merchant cannot sign in. A `PENDING_REVIEW`
merchant can read but not write. The check happens on the server, so
manipulating the client changes nothing.

**Platform admins are still bound by the merchant gate** when they act on a
merchant's behalf — they must name the merchant they are acting on, and the
audit log records it.

---

## Device ingest

A device is not a user. When it connects, it receives its **own token**
(`zpd_…`, shown once; only its SHA-256 is stored) and sends it as
`Authorization: Bearer` on every later call. The token identifies the device,
and the device can only ever act on the merchant it is connected to. A
`deviceId` in a request body is only checked against the token, never used to
look a device up.

- Connecting a phone needs three things together: the merchant's **email and
  password**, and a **phone key** (`zp_phone_…`) made on the website. The key
  must belong to the same merchant as the account. The three are checked in
  that order, and a wrong email or password gives one answer whether the
  email exists or not.
- A phone key is a different kind of key from an API key. It can only connect
  a phone; it cannot create payments, and an API key cannot connect a phone.
  It is shown once, only its SHA-256 is stored, and the merchant can remove
  it at any time. Removing a key stops new phones using it; phones already
  connected keep their own token until they are disconnected in the dashboard.
- The password is sent once, over HTTPS, in the connect call. The app keeps it
  in memory only for the two sign-in steps and never saves it.
- A device already connected to a different merchant cannot be taken over.
  Connecting a device of your own again issues a new token and the old one
  stops working. Removing a device in the dashboard ends its token at once.
- The connect call holds guessable credentials, so it is limited to 10 per
  minute per address. Notifications are limited to 600 per minute.

This matters because a payment is confirmed from a notification: if anyone
could post notifications for someone else's device, they could confirm a
payment they never made. There is no longer a secret shared by all devices,
and nothing secret is built into the app.

---

## Input validation

Every request body and query string is parsed with **Zod** before it reaches
the database. Unknown fields are stripped rather than passed through. The
schema module is shared between the API and the front end, so the client-side
validation is a convenience, not the enforcement point.

Payloads are bounded: `pageSize` is capped at 100, string fields have maximum
lengths, and the CSV export is limited to 5000 rows.

---

## Rate limiting

`@fastify/rate-limit` is registered globally at **300 requests per minute**
per IP. Auth endpoints are stricter:

| Endpoint                | Limit        |
| ----------------------- | ------------ |
| `POST /auth/register`   | 10 / hour    |
| `POST /auth/login`      | 10 / minute  |
| `POST /auth/refresh`    | 60 / minute  |
| `POST /auth/forgot-password` | 5 / 15 minutes |
| `POST /device/connect`  | 10 / minute  |
| `POST /device/notifications` | 600 / minute |
| `POST /device/heartbeat`| 120 / minute |

---

## Account enumeration

`POST /auth/forgot-password` returns `{ ok: true }` whether or not the address
has an account. `POST /auth/login` returns the same message for an unknown
address and a wrong password. Neither endpoint can be used to find out who has
an account.

---

## Data at rest

| Data                | How it is stored                          |
| ------------------- | ----------------------------------------- |
| Passwords           | argon2id hash                             |
| Refresh tokens      | SHA-256 hash — the token itself is not stored |
| API keys            | Hashed; only the prefix is ever shown again |
| Account numbers     | Masked when read back (`0162****677`)     |
| Session cookies     | Never readable by JavaScript              |

The full account number is stored so the platform can attribute notifications
to the right account, but it is never returned in full by the API.

---

## The audit log

Append-only records of sensitive actions: registration, sign-in, sign-out,
failed sign-in, password change, merchant status change, account add/remove,
device pair/disconnect, API key create/revoke, transaction review.

Each entry records the actor, the merchant, the action, some metadata, the IP
address and the time. The log is written to the database and is not editable
through the API.

---

## HTTP hardening

`@fastify/helmet` sets the standard security headers, including
`X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`
and `Strict-Transport-Security`.

CORS is an explicit allow-list (`CORS_ORIGINS`). Because the browser talks to
the front end's own origin and the front end proxies to the API, the
credentialed path never crosses an origin boundary at all.

---

## What this system does not protect against

Being honest about the edges:

- **A stolen phone holds a working token** until the device is removed in the
  dashboard. Notifications from it are still only evidence: they confirm a
  payment only if a customer gave the same TrxID and amount.
- **The event hub is in-process.** Live events do not survive a restart and
  are not shared between API instances. Redis pub/sub would fix it.
- **There is no email transport.** Password reset tokens are stored hashed and
  expire, but the reset link cannot be delivered until an email provider is configured.
- **There is no multi-factor authentication.**
- **There is no malware scanning on uploaded files**, because nothing is
  uploaded.
- **The seed data is synthetic.** It does not represent real merchants,
  accounts or transactions.
- **The audit log has no retention policy.** It grows until something prunes
  it.

---

## The boundary of the product

This is the part that matters most, and it is a design decision rather than a
missing feature.

ZevaPay **reads notifications**. It does not settle payments, does not verify
a payment with bKash, Nagad, Rocket or Upay, does not move money, and never
asks a user for a provider PIN or OTP.

That means:

- a merchant can see what a provider's SMS said, and how confident the parser
  is about it — but not a bank-grade confirmation that money arrived;
- parser notifications are `PENDING` or `REVIEW`; neither indicates provider confirmation;
- anything the parser was not confident about goes to a human.

The UI says this in plain language rather than dressing the records up as
verified payments.
