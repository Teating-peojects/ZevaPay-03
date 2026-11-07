# Operations

## Running the stack

### 1. Database

```bash
docker compose up -d
docker compose ps          # wait for "healthy"
```

The container is `zevapay-postgres` on port 5432 with the credentials
`zevapay`/`zevapay` and the database `zevapay`. The volume `zevapay_pg` keeps
the data across restarts.

```bash
docker compose down         # stop, keep the data
docker compose down -v      # stop and delete the data
```

### 2. Dependencies

```bash
npm install
npm --prefix db install
npm --prefix backend install
npm --prefix frontend install
```

### 3. Schema and seed

```bash
npm --prefix db run migrate    # apply migrations
npm --prefix db run seed       # load the demo data
npm --prefix db run studio     # browse the data in a GUI
```

`migrate` creates the tables and then generates the Prisma client, which the
seed and the API both import (it is git-ignored, so a fresh clone does not have
it). If you ever need only the client, run `npm --prefix db run generate`.
`seed` fills them with four merchants, eight
users, payment accounts, devices, transactions and audit entries. The seed is
idempotent — it wipes and recreates the demo records, so it can be re-run.

### 4. API

```bash
npm --prefix backend run dev       # watch mode
npm --prefix backend run build     # compile to dist/
npm --prefix backend run start     # run the compiled build
```

The API listens on `http://localhost:4000` and exposes `GET /health`.

### 5. Front end

```bash
npm --prefix frontend run dev
npm --prefix frontend run build
npm --prefix frontend run start
```

The front end listens on `http://localhost:3000`.

---

## Configuration

### `backend/.env`

| Variable                 | Default                    | Notes                                          |
| ------------------------ | -------------------------- | ---------------------------------------------- |
| `NODE_ENV`               | `development`              | `production` turns on `Secure` cookies         |
| `PORT`                   | `4000`                     |                                                |
| `HOST`                   | `0.0.0.0`                  |                                                |
| `DATABASE_URL`           | —                          | **Required.** A PostgreSQL connection string    |
| `JWT_SECRET`             | dev-only value             | **Required in production.** At least 32 chars  |
| `JWT_ACCESS_TTL`         | `15m`                      | Access-token lifetime                          |
| `JWT_REFRESH_TTL`        | `30d`                      | Refresh-token lifetime                         |
| `CORS_ORIGINS`           | `http://localhost:3000`    | Comma-separated allow-list                     |
| `PUBLIC_APP_URL`         | first `CORS_ORIGINS` entry | Address customers open for hosted checkout     |
| `AUTO_ACCEPT_CONFIDENCE` | `0.9`                      | Parser threshold, 0–1                          |
| `LOG_LEVEL`              | `info`                     |                                                |

### `frontend/.env.local`

| Variable             | Default                 | Notes                                   |
| -------------------- | ----------------------- | --------------------------------------- |
| `API_URL`            | `http://localhost:4000` | Where the API lives. Server-side only   |
| `NEXT_PUBLIC_API_URL`| `http://localhost:4000` | Fallback for `API_URL`                  |

Both are optional in development — the defaults point at the local API. Set
`API_URL` in production.

### `db/.env`

| Variable       | Default                                                       |
| -------------- | ------------------------------------------------------------- |
| `DATABASE_URL` | `postgresql://zevapay:zevapay@localhost:5432/zevapay?schema=public` |

---

## Seeded accounts

Every seeded account uses the password `ZevaPay#2026`.

| Email                     | Role              | Merchant                | Status         |
| ------------------------- | ----------------- | ----------------------- | -------------- |
| `owner@dhanmondi.test`    | `MERCHANT_OWNER`  | Dhanmondi Electronics   | `ACTIVE`       |
| `owner@gulshan.test`      | `MERCHANT_OWNER`  | Gulshan Fresh Market    | `ACTIVE`       |
| `owner@banani.test`       | `MERCHANT_OWNER`  | Banani Textiles         | `PENDING_REVIEW` |
| `owner@mirpur.test`       | `MERCHANT_OWNER`  | Mirpur Wholesale Hub    | `SUSPENDED`    |
| `operator@dhanmondi.test` | `MERCHANT_MANAGER` | Dhanmondi Electronics | `ACTIVE`       |
| `viewer@dhanmondi.test`   | `MERCHANT_VIEWER`  | Dhanmondi Electronics  | `ACTIVE`       |
| `admin@gulshan.test`      | `MERCHANT_ADMIN`  | Gulshan Fresh Market    | `ACTIVE`       |
| `admin@zevapay.test`      | `SUPER_ADMIN`  | —                       | —              |

A `PENDING_REVIEW` merchant can sign in and look at its data, but every write
is refused until an administrator approves it. A `SUSPENDED` merchant cannot
sign in at all. That is what the admin console's activate/suspend action is
for.

---

## The device simulator

The Android app is not part of this repository. The simulator stands in for it
and follows the same flow a real phone would.

```bash
npm --prefix backend run simulate -- \
  --email owner@dhanmondi.test \
  --password 'ZevaPay#2026' \
  --device ZP-SMS-SIM01 \
  --device-name "Counter Terminal 1" \
  --count 10 \
  --interval 3000
```

| Flag            | Default                | Meaning                                  |
| --------------- | ---------------------- | ---------------------------------------- |
| `--email`       | `owner@dhanmondi.test` | The merchant to sign in as               |
| `--password`    | `ZevaPay#2026`         |                                          |
| `--device`      | `ZP-SMS-SIM01`         | The device identifier                    |
| `--device-name` | `Simulated Counter Terminal` | Shown in the dashboard           |
| `--count`       | `10`                   | How many notifications to post           |
| `--interval`    | `3000`                 | Milliseconds between them                |
| `--pairing`     | —                      | Use an existing pairing code             |

The simulator requests its own pairing code, so it works without any manual
setup. Leave the dashboard open while it runs and the transactions appear
live.

---

## Verifying the installation

### The API is up

```bash
curl http://localhost:4000/health
```

```json
{ "status": "ok", "service": "zevapay-api", "env": "development", "time": "..." }
```

### The session flow works

```bash
npm --prefix backend exec tsx src/tools/check-cookies.ts
```

```
login status: 200
cookies set: zp_access, zp_refresh
overview status: 200
stats: {"totalTransactions":22,...}
no-auth status: 401
```

### The front end proxies to the API

```bash
curl -i http://localhost:3000/api/v1/auth/me
```

`401 UNAUTHORIZED` — the front end reached the API and the API correctly
refused an unauthenticated request.

```bash
curl -i http://localhost:3000/dashboard
```

`307` with `location: /login`.

### The parser is behaving

```bash
npm --prefix backend test
```

22 tests covering the four provider parsers, the confidence scoring and the
ambiguous-message fallback.

---

## Troubleshooting

### `API_UNREACHABLE` in the browser

The front end could not reach the API. Check that it is running:

```bash
curl http://localhost:4000/health
```

If `API_URL` is set to something other than `http://localhost:4000` in
`frontend/.env.local`, that is the address being used.

### `Can't reach database server`

The Postgres container is not up or not healthy:

```bash
docker compose ps
docker compose logs postgres
```

### Prisma says the schema is out of date

```bash
npm --prefix db run migrate
npm --prefix db run generate
```

`generate` writes the client into `backend/src/generated/prisma`, which is
where the backend imports it from.

### The dashboard says the API did not return any data

Usually a stale API process. The backend has to be restarted after changing
route code — `npm --prefix backend run dev` does that automatically, but a
manually started `tsx src/server.ts` does not.

### The live indicator stays on "Connecting"

The Server-Sent Events request is being blocked or is failing. Check that
`/api/v1/stream` responds:

```bash
curl -N -b jar.txt http://localhost:3000/api/v1/stream
```

A `200` with `content-type: text/event-stream` and a `connected` event means
the stream is healthy.

### A device shows as "already paired with another merchant"

Each device identifier belongs to exactly one merchant. Use a different
`--device` value, or disconnect the device from the dashboard first.

### Signing in returns 403 with the right password

The merchant is suspended. Sign in as `admin@zevapay.test` and reactivate it
from the admin console.

### Signing in returns 401 with the right password

The address may not be registered, or the password is wrong. The API returns
the same message either way, so it cannot be used to find out which addresses
have accounts.

### A write returns 403 "still being reviewed"

The merchant is `PENDING_REVIEW`. It can read its data but cannot change
anything until an administrator approves it.

---

## Housekeeping

Expired refresh-token rows are pruned once an hour by a timer in
`server.ts`. If the API is restarted frequently the timer restarts with it,
which is harmless.

Audit logs are append-only and are not pruned automatically. If they grow
faster than expected, add a retention job — nothing in the application
depends on them being kept forever.

## Webhooks

The API process sends queued webhooks itself, every 15 seconds. Run one API instance, or several: a delivery is claimed before it is sent, so it is not sent twice at once. If the process is stopped, queued events wait in the database and go out when it starts again.

Signing secrets are stored in the database as text, because signing needs the secret itself. Protect database backups accordingly. Outbound requests are refused when the address resolves to a private or local network, so the API server cannot be pointed at your internal services.
