# ZevaPay API reference

Base URL: `http://localhost:4000` · All application routes live under `/api/v1`.

---

## Authentication

ZevaPay uses **cookie-based sessions**. Signing in sets two `httpOnly` cookies:

| Cookie       | Lifetime | Purpose                             |
| ------------ | -------- | ----------------------------------- |
| `zp_access`  | 15 min   | The signed access token             |
| `zp_refresh` | 30 days  | Exchanges for a fresh access token  |

Both are `SameSite=Lax`, `HttpOnly`, `Path=/`, and `Secure` in production.
**No token is ever returned in a response body or stored in `localStorage`.**

The browser sends them automatically. Non-browser clients may instead send
`Authorization: Bearer <access token>`.

```bash
curl -c jar.txt -X POST http://localhost:4000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"owner@dhanmondi.test","password":"ZevaPay#2026"}'

curl -b jar.txt http://localhost:4000/api/v1/merchant/overview
```

### Roles

| Role                | Can do                                                   |
| ------------------- | -------------------------------------------------------- |
| `SUPER_ADMIN`      | Everything in `/api/v1/admin/*`                           |
| `MERCHANT_OWNER`    | Read + write within their own merchant                   |
| `MERCHANT_ADMIN`    | Read + write within their own merchant                   |
| `MERCHANT_MANAGER`  | Read + write within their own merchant                   |
| `MERCHANT_VIEWER`   | Read only within their own merchant                      |

A merchant user can only ever see their own merchant's records — the merchant
is resolved from the session, never from the request body.

### Errors

Every error has the same shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields need attention.",
    "details": { "email": "Enter a valid email address" },
    "requestId": "req_mvziqblh_ng0yiqax"
  }
}
```

| Status | Code              | Meaning                                     |
| ------ | ----------------- | ------------------------------------------- |
| 400    | `BAD_REQUEST`     | Malformed request                           |
| 400    | `VALIDATION_ERROR`| Field-level validation failed (`details`)   |
| 401    | `UNAUTHORIZED`    | Missing or expired session                  |
| 403    | `FORBIDDEN`       | Authenticated but not allowed               |
| 404    | `NOT_FOUND`       | No such record, or not visible to this user |
| 409    | `CONFLICT`        | Duplicate account, email already in use     |
| 429    | `RATE_LIMITED`    | Too many requests                           |

### Pagination

List endpoints accept `page` (default 1) and `pageSize` (default 20, max 100)
and return:

```json
{ "pagination": { "page": 1, "pageSize": 20, "total": 42, "totalPages": 3 } }
```

---

## Auth — `/api/v1/auth`

| Method | Path                     | Auth | Notes                                    |
| ------ | ------------------------ | ---- | ---------------------------------------- |
| POST   | `/auth/register`         | —    | Creates a merchant + owner. Rate limited to 10/hour |
| POST   | `/auth/login`            | —    | Sets the session cookies                  |
| POST   | `/auth/refresh`          | cookie | Rotates the access token                 |
| POST   | `/auth/logout`           | cookie | Revokes the session, clears the cookies  |
| POST   | `/auth/logout-all`       | yes   | Revokes every session for the user        |
| POST   | `/auth/forgot-password`  | —    | Always reports success                    |
| POST   | `/auth/reset-password`   | —    | Consumes a reset token                    |
| GET    | `/auth/me`               | yes   | The current session                       |
| PATCH  | `/auth/profile`          | yes   | Updates name, email, phone                |
| POST   | `/auth/change-password`  | yes   | Revokes every other session               |
| GET    | `/auth/sessions`         | yes   | Active sessions with device and IP        |

**`POST /auth/register`**

```json
{
  "businessName": "Sunrise Electronics",
  "ownerName": "Arif Hossain",
  "email": "arif@sunrise.test",
  "phone": "01712345678",
  "password": "ZevaPay#2026"
}
```

Password rules: at least 10 characters, one uppercase, one lowercase, one
number. New merchants start in `PENDING_REVIEW`.

**`POST /auth/login`**

```json
{ "email": "owner@dhanmondi.test", "password": "ZevaPay#2026", "rememberMe": true }
```

Returns `{ user, merchant, expiresIn }`.

A merchant whose status is `SUSPENDED` is refused with `403 FORBIDDEN`. A
merchant that is still `PENDING_REVIEW` may sign in, but every write against
its records is refused until an administrator approves it.

**`POST /auth/forgot-password`**

```json
{ "email": "someone@example.com" }
```

Always returns `{ ok: true }`, whether or not the address has an account — the
endpoint cannot be used to discover which addresses are registered.

---

## Merchant — `/api/v1/merchant`

Requires a merchant role. The merchant is always taken from the session.

| Method | Path                        | Write | Description                              |
| ------ | --------------------------- | ----- | ---------------------------------------- |
| GET    | `/merchant/overview`        | —     | Stats, activity chart, accounts, devices, recent transactions |
| GET    | `/merchant/accounts`        | —     | `q`, `provider`, `status`                |
| POST   | `/merchant/accounts`        | ✓     | Add a payment account                    |
| PATCH  | `/merchant/accounts/:id`    | ✓     | Update an account                        |
| DELETE | `/merchant/accounts/:id`    | ✓     | Remove an account                        |
| GET    | `/merchant/devices`         | —     | `q`, `status`                            |
| POST   | `/merchant/devices/pairing-codes` | ✓ | Issue a single-use pairing code   |
| PATCH  | `/merchant/devices/:id`     | ✓     | Rename, re-link or pause a device        |
| DELETE | `/merchant/devices/:id`     | ✓     | Disconnect a device                      |
| GET    | `/merchant/transactions`    | —     | `q`, `status`, `provider`, `from`, `to`  |
| GET    | `/merchant/transactions/:id`| —     | One transaction with its raw notification |
| POST   | `/merchant/transactions/:id/review` | ✓ | `ACCEPT` or `REJECT`             |
| GET    | `/merchant/transactions/export` | —  | CSV export of the filtered set           |
| GET    | `/merchant/api-keys`        | —     | Keys, prefix only                        |
| POST   | `/merchant/api-keys`        | ✓     | Create a key — the secret is returned once |
| DELETE | `/merchant/api-keys/:id`    | ✓     | Revoke a key                             |
| GET    | `/merchant/audit-logs`      | —     | The merchant's audit trail               |
| GET    | `/merchant/team`            | —     | Team members                             |
| POST   | `/merchant/team`            | ✓     | Invite a team member                     |
| GET    | `/merchant/settings`        | —     | The merchant record                      |
| PATCH  | `/merchant/settings`        | ✓     | Update the business name                 |

**`POST /merchant/accounts`**

```json
{
  "provider": "BKASH",
  "accountNumber": "01723445566",
  "accountType": "MERCHANT",
  "label": "Main bKash Counter"
}
```

`provider` is one of `BKASH`, `NAGAD`, `ROCKET`, `UPAY`. `accountType` is one
of `PERSONAL`, `MERCHANT`, `AGENT`, `BUSINESS`. The stored number is masked
when it is read back.

**`POST /merchant/devices/pairing-codes`**

```json
{ "connectedAccountId": "clx..." }
```

`connectedAccountId` is optional; `null` means "any account". The response
holds the code and its expiry:

```json
{
  "pairingCode": {
    "id": "clx...",
    "code": "ZP-W5FT-9Z",
    "expiresAt": "2026-11-02T17:25:00.528Z",
    "connectedAccountId": null
  }
}
```

The code is **single-use** and expires after 15 minutes.

**`POST /merchant/transactions/:id/review`**

```json
{ "decision": "ACCEPT", "note": "Confirmed against the counter slip" }
```

`decision` is `ACCEPT` or `REJECT`. Accepting sets the status to `CONFIRMED`;
rejecting sets it to `FAILED`.

---

## Payments and customers

Merchant payment and customer routes require a permission assigned through the
role/permission tables. Tenant IDs come from the authenticated session.

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/merchant/payments` | Paginated payments; optional `status` |
| POST | `/merchant/payments` | Create a payment using `amountMinor` and `currency` |
| GET | `/merchant/payments/:id` | Payment with attempts and customer details |
| POST | `/merchant/payments/:id/attempts` | Record the customer's TrxID and match it to a recorded SMS (see below) |
| PATCH | `/merchant/payments/:id/status` | Validated non-confirming status transition |
| GET | `/merchant/customers` | Paginated customer list; optional `q` |
| POST | `/merchant/customers` | Create a merchant-scoped customer |
| GET | `/merchant/customers/:id` | Customer and recent payments |
| PATCH | `/merchant/customers/:id` | Update a merchant-scoped customer |
| DELETE | `/merchant/customers/:id` | Delete a merchant-scoped customer |

### Hosted checkout

Server-to-server routes authenticated with an API key
(`Authorization: Bearer zp_live_…`) and the customer-facing routes behind the
checkout page. See [checkout-integration.md](./checkout-integration.md).

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| POST | `/checkout/payments` | API key | Create a payment and get a `checkoutUrl` |
| GET | `/checkout/payments/:id` | API key | Status of one of the merchant's payments |
| GET | `/public/checkout/:token` | link secret | What the customer's page shows |
| POST | `/public/checkout/:token/trxid` | link secret | The customer's TrxID |

### Matching a TrxID to an SMS

`POST /merchant/payments/:id/attempts` takes `{ "provider": "BKASH" | "NAGAD", "trxId": "DK3508MJ4R" }`
and returns `201` with `{ data: { payment, attemptId, match } }`.

A payment is settled when a recorded SMS agrees with the customer on the
**provider, the TrxID and the amount**, in either order (SMS first or TrxID
first). `match.outcome` is one of:

| `outcome` | Meaning |
| --------- | ------- |
| `approved` | TrxID and amount matched. The payment and the notification are `CONFIRMED`. |
| `review` | The TrxID matched but something did not agree (amount, a date before the payment, an SMS after expiry). Both go to `REVIEW`; `match.reasons` says why. Accepting the notification confirms the payment, rejecting it reopens the payment. |
| `waiting` | No matching SMS has been recorded yet. The payment is `PENDING` and the SMS settles it when it arrives. |

Rules the server enforces:

- Only a message that says money was received can match. A debit or failure
  notice with the same TrxID and amount never does.
- One TrxID settles one payment. A TrxID that was already submitted, or whose
  SMS was already used, is refused with `409`.
- At most 5 TrxIDs may be tried per payment (`409` after that), and the route
  is rate limited.
- A payment can only be confirmed this way or by accepting its notification.
  `PATCH /merchant/payments/:id/status` still refuses `CONFIRMED`.
- `CONFIRMED` means a notification matched. It is not a check with the provider.

## Admin — `/api/v1/admin`

Requires `SUPER_ADMIN` or `ADMIN` plus the `admin:manage` permission.

| Method | Path                            | Description                          |
| ------ | ------------------------------- | ------------------------------------ |
| GET    | `/admin/overview`               | Platform-wide stats and activity     |
| GET    | `/admin/merchants`              | `q`, `status`                        |
| POST   | `/admin/merchants`              | Create a merchant                    |
| PATCH  | `/admin/merchants/:id`          | Change the merchant status           |
| GET    | `/admin/users`                  | Platform users                       |
| PATCH  | `/admin/users/:id`              | Activate or deactivate a user        |
| GET    | `/admin/transactions`           | `q`, `status`, `provider`, `merchantId`, `from`, `to` |
| POST   | `/admin/transactions/:id/review`| Accept or reject on a merchant's behalf |
| GET    | `/admin/devices`                | Every device on the platform         |
| DELETE | `/admin/devices/:id`            | Remove a device                      |
| GET    | `/admin/audit-logs`             | Platform-wide audit trail            |
| GET    | `/admin/settings`               | Live record counts and environment   |

**`GET /admin/settings`**

```json
{
  "system": {
    "merchants": 4,
    "users": 8,
    "devices": 6,
    "transactions": 22,
    "environment": "development"
  }
}
```

These are real counts from the database.

---

## Device ingest — `/api/v1/device`

These endpoints are for the Android device, not for a signed-in user. They
authenticate with the `x-device-secret` header and are rate limited separately.

| Method | Path                    | Description                                  |
| ------ | ----------------------- | -------------------------------------------- |
| POST   | `/device/pair`          | Exchange a pairing code for a device binding |
| POST   | `/device/notifications` | Post a raw provider notification             |
| POST   | `/device/heartbeat`     | Keep the device marked online                |

**`POST /device/pair`**

```json
{
  "code": "ZP-W5FT-9Z",
  "deviceId": "ZP-SMS-8F2A41",
  "deviceName": "Counter Terminal 1",
  "androidVersion": "14"
}
```

The code must be unused and unexpired. A device that is already paired to a
different merchant is refused.

**`POST /device/notifications`**

```json
{
  "deviceId": "ZP-SMS-8F2A41",
  "message": "bKash: You have received Tk 2,450.00 from Rakib Chowdhury. TrxID: 8H2K4L9M. Ref: BKSEND01.",
  "receivedAt": "2026-11-02T14:02:00.000Z",
  "provider": "BKASH"
}
```

The response says what the parser made of it:

```json
{
  "duplicate": false,
  "transactionId": "clx...",
  "reference": "TXN-591589",
  "status": "PENDING",
  "confidence": 0.9,
  "autoAccepted": false,
  "verificationRequired": true,
  "missing": ["occurredAt"]
}
```

- `status` is `PENDING` when parser confidence meets the routing threshold
  and `REVIEW` when parser confidence is low. Parsing never confirms a payment.
- `missing` lists the fields the parser could not find. Each one costs
  confidence.
- A repeated notification returns `{ "duplicate": true }` and does not create a
  second transaction.
- If a customer has already given this notification's TrxID for a payment and
  the amount agrees, the transaction is stored as `CONFIRMED`, the payment is
  confirmed, and the response has `"autoAccepted": true` and a `paymentId`.
  A disagreement stores both as `REVIEW`. See *Matching a TrxID to an SMS*.

---

## Live stream — `/api/v1/stream`

A Server-Sent Events feed. Requires a session. Merchant users receive their own
merchant's events; platform admins receive platform-wide events.

```
GET /api/v1/stream
```

```
event: connected
data: {"channel":"merchant:clx...","at":"2026-11-02T17:13:29.853Z"}
```

Event types:

| Event                 | Published when                             |
| --------------------- | ------------------------------------------ |
| `transaction.created` | A device reports a notification            |
| `transaction.reviewed`| A review decision is saved                 |
| `device.paired`       | A device exchanges a pairing code          |
| `device.updated`      | A device is renamed, re-linked or paused   |
| `device.removed`      | A device is disconnected                   |
| `account.created`     | A payment account is added                 |
| `account.updated`     | A payment account is updated               |
| `account.removed`     | A payment account is removed               |
| `merchant.updated`    | A merchant's status changes                |
| `user.updated`        | A platform user is updated                 |

On connect the server backfills the last 20 events for the channel, so a
reconnecting client is not left with a blank screen. A `: ping` comment is sent
every 25 seconds to keep proxies from dropping an idle connection.

---

## Health

```
GET /health
```

```json
{ "status": "ok", "service": "zevapay-api", "env": "development", "time": "..." }
```
