# ZevaPay

**Simple Payment Management** for Bangladeshi merchants.

ZevaPay connects a merchant's mobile financial services accounts (bKash,
Nagad, Rocket, Upay) to an Android SMS Bridge device. The device reads the
provider's payment notifications and posts them to ZevaPay; the platform
parses them, records them as transactions, and flags anything it is not
confident about for human review.

ZevaPay **reads notifications**. It never settles a payment with a provider,
never asks for a PIN, and never asks for an OTP.

---

## What is in this repository

| Path       | What it is                                                            |
| ---------- | --------------------------------------------------------------------- |
| `frontend/`| Next.js 16 App Router front end — public site, merchant dashboard, admin console |
| `backend/` | Fastify 5 API — auth, merchant + admin domains, device ingest, live event stream |
| `db/`      | Prisma 7 schema, migrations and seed script                           |
| `docs/`    | Architecture, API reference and operations notes                      |

The system is three processes plus one database:

```
Browser ──► Next.js (frontend, :3000) ──► Fastify API (backend, :4000) ──► PostgreSQL (:5432)
                   │                              ▲
                   └──── Server-Sent Events ──────┘
```

---

## Prerequisites

- **Node.js 20+**
- **Docker** (for the PostgreSQL container), **or** an existing PostgreSQL 16+
  server. Without Docker, skip `npm run setup`: copy the `.env.example` files,
  set `DATABASE_URL` in `db/.env` and `backend/.env` to your server, then run
  `npm --prefix db run migrate` and `npm --prefix db run seed`.

## Quick start

```bash
# 1. Install dependencies
npm install
npm --prefix db install
npm --prefix backend install
npm --prefix frontend install

# 2. Start PostgreSQL, create the schema and load the demo data
npm run setup

# 3. Start the API and the front end together
npm run dev
```

Open <http://localhost:3000>.

`npm run setup` runs `docker compose up -d`, applies the migrations (which also
generates the Prisma client) and seeds the database. `npm run dev` starts the API on `:4000` and the front end on
`:3000` side by side.

### Seeded accounts

Every seeded account uses the password `ZevaPay#2026`.

| Email                        | Role                | Lands on      |
| ---------------------------- | ------------------- | ------------- |
| `owner@dhanmondi.test`       | Merchant owner      | `/dashboard`  |
| `owner@gulshan.test`         | Merchant owner      | `/dashboard`  |
| `operator@dhanmondi.test`    | Merchant operator   | `/dashboard`  |
| `viewer@dhanmondi.test`      | Merchant viewer     | `/dashboard`  |
| `admin@gulshan.test`         | Merchant admin      | `/dashboard`  |
| `admin@zevapay.test`         | Platform admin      | `/admin`      |

`owner@banani.test` is seeded in `PENDING_REVIEW` and `owner@mirpur.test` in
`SUSPENDED`, so the admin console has something to act on.

---

## The pieces

### Front end (`frontend/`)

Next.js 16 with the App Router, TypeScript in strict mode, Tailwind CSS v4 and
React Hook Form + Zod. Public pages are statically prerendered; the dashboards
render per request because they read the session cookie.

Browser code calls `/api/v1/...` on the app's own origin. A route handler at
`src/app/api/v1/[...path]/route.ts` proxies those calls to the API service.
This keeps the session cookie first-party — no CORS pre-flight, no cross-site
cookie rules — and lets the Server-Sent Events stream pipe straight through
without a buffering proxy in between.

`src/proxy.ts` refreshes the access token before it expires, so a 15-minute
token never interrupts a working session.

### API (`backend/`)

Fastify 5 with `@fastify/cookie`, `@fastify/jwt`, `@fastify/cors`,
`@fastify/helmet` and `@fastify/rate-limit`. Passwords are hashed with
argon2id.

Sessions are cookie-based: `zp_access` (15 minutes) and `zp_refresh`
(30 days), both `httpOnly` and `sameSite=lax`. Nothing sensitive is written to
`localStorage`.

### Database (`db/`)

PostgreSQL 16 through Prisma 7 with the `pg` driver adapter. The schema
covers users, merchants, payment accounts, devices, transactions, pairing
codes, sessions, API keys and the audit log.

### Device ingest

Devices are not users. A phone authenticates with a shared ingest secret plus
its own device identifier, never with a person's session.

```
POST /api/v1/device/connect         email + password + phone key → device token
POST /api/v1/device/notifications   post a raw provider notification
POST /api/v1/device/heartbeat       keep the device marked online
```

The Android app is out of scope for this repository. `backend/src/tools/simulate.ts`
stands in for it and follows the same flow a real phone would: make a phone
key, connect with email, password and the key, then post notifications at a realistic cadence.

```bash
npm --prefix backend run simulate -- --email owner@dhanmondi.test --count 10
```

### Parser engine

`backend/src/parser/` holds one parser per provider. Each returns the amount,
the sender, the provider reference and a **confidence score** between 0 and 1.

- Confidence **≥ 0.9** → recorded as `PENDING` until independently verified.
- Confidence **< 0.9** → recorded as `REVIEW` and routed to the review queue,
  where a merchant accepts or rejects it.

Parser confidence only routes records for review; it never confirms a payment.

### Live updates

The API publishes events on an in-process hub (`merchant:<id>` per merchant,
`platform` for administrators) and streams them over Server-Sent Events at
`GET /api/v1/stream`. The dashboards subscribe and refresh in place, so a
notification arriving on a counter phone appears on the overview without a
reload.

---

## Scripts

Run from the repository root:

| Script             | What it does                                        |
| ------------------ | --------------------------------------------------- |
| `npm run setup`    | Start Postgres, migrate and seed                     |
| `npm run dev`      | Run the API and the front end together               |
| `npm run build`    | Build both                                          |
| `npm run typecheck`| Type-check both                                      |
| `npm run lint`     | Lint the front end                                   |
| `npm test`         | Run the parser test suite                            |
| `npm run simulate` | Run the device simulator                             |
| `npm run db:studio`| Browse the data in Prisma Studio                     |

---

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — how the pieces fit together
- [`docs/api.md`](docs/api.md) — every endpoint
- [`docs/operations.md`](docs/operations.md) — running, seeding and troubleshooting
- [`docs/security.md`](docs/security.md) — the security model and its limits

---

## What this system does not do

It is worth being explicit, because the boundary is the point:

- It does **not** settle payments. It records what a provider's SMS said.
- It does **not** verify a payment with the provider. There is no API call to
  bKash, Nagad, Rocket or Upay.
- It does **not** collect PINs, OTPs or any credential from a provider.
- It does **not** move money.
- The shipped seed data is synthetic. The number of merchants, users,
  transactions and total amounts shown in a fresh install are exactly what the
  seed script wrote — nothing is invented at runtime.

---

## Licence

Unlicensed / private. All rights reserved.
