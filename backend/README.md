# ZevaPay — Backend

The ZevaPay API: authentication, the merchant and admin domains, device
notification ingest, the SMS parser engine, and the live event stream.

## Stack

- Fastify 5
- Prisma 7 with the `pg` driver adapter
- Zod 4 for request validation
- argon2id for password hashing
- pino for logging

## Getting started

From the repository root:

```bash
npm run setup   # Postgres + migrations + seed
npm run dev     # API and front end together
```

Or just the API:

```bash
npm install
cp .env.example .env
npm run dev
```

The API listens on `http://localhost:4000` and exposes `GET /health`.

## Configuration

See `.env.example` for the full list. The values that matter most:

| Variable                 | Default                    |
| ------------------------ | -------------------------- |
| `DATABASE_URL`           | **required**               |
| `JWT_SECRET`             | **required in production** |
| `JWT_ACCESS_TTL`         | `15m`                      |
| `JWT_REFRESH_TTL`        | `30d`                      |
| `DEVICE_INGEST_SECRET`   | `dev-device-ingest-secret` |
| `AUTO_ACCEPT_CONFIDENCE` | `0.9`                      |

The environment is validated at boot by a Zod schema. A misconfigured
deployment fails immediately with a readable message rather than surfacing as
a confusing runtime error.

## Scripts

| Script            | What it does                        |
| ----------------- | ----------------------------------- |
| `npm run dev`     | Watch mode                          |
| `npm run build`   | Compile to `dist/`                  |
| `npm run start`   | Run the compiled build              |
| `npm run typecheck` | Type-check                        |
| `npm test`        | Run the test suite                  |
| `npm run seed`    | Load the demo data                  |
| `npm run simulate`| Run the device simulator            |

## Layout

```
src/
  app.ts                # Fastify setup: plugins, error handling, routes
  server.ts             # Process bootstrap and graceful shutdown
  config.ts             # Validated environment configuration
  db.ts                 # Prisma client
  routes/
    auth.ts             # Registration, sessions, password reset
    merchant.ts         # The merchant's own records
    admin.ts            # Platform-wide operations
    device.ts           # Device pairing and notification ingest
    stream.ts           # Server-Sent Events
  parser/
    index.ts            # Provider detection and dispatch
    providers.ts        # One parser per provider, plus the confidence model
    common.ts           # Shared field extraction
    samples.ts          # Realistic sample notifications
    types.ts
  lib/
    auth / events / hash / password / tokens / errors / http
  tools/
    simulate.ts         # Stands in for the Android app
    check-cookies.ts    # Verifies the session flow
  generated/prisma/     # The generated Prisma client (git-ignored)
```

## The device simulator

The Android app is out of scope. The simulator stands in for it and follows
the same flow a real phone would: sign in, request a pairing code, exchange it
for a device binding, then post notifications.

```bash
npm run simulate -- --email owner@dhanmondi.test --count 10
```

Run the backend and the simulator at the same time, with the dashboard open,
and the transactions appear live.

## The parser

`src/parser/` holds one parser per provider. Each extracts the amount, the
sender, the provider reference and any embedded timestamp, then scores the
result.

| Field              | Weight |
| ------------------ | ------ |
| Provider reference | 0.40   |
| Amount             | 0.35   |
| Sender name        | 0.15   |
| Sender phone       | 0.05   |
| Embedded date      | 0.05   |

At or above `AUTO_ACCEPT_CONFIDENCE` (default `0.9`) the notification is
recorded as `SUCCESS` — or `FAILED` if the provider reported a failure.
Below it, the notification is recorded as `REVIEW` and waits for a human.

A provider-reported failure and an outgoing debit score 1.0 automatically:
there is nothing for a human to decide about them.

## API reference

See [`../docs/api.md`](../docs/api.md) for every endpoint, and
[`../docs/architecture.md`](../docs/architecture.md) for how the pieces fit
together.
