# Backend and database foundation (Phase 2)

## Existing stack

The implementation extends the installed Fastify 5.12.8 API and Prisma 7.10.1 client, using PostgreSQL through Prisma's `@prisma/adapter-pg`. Zod 4.6.7 validates request input, Argon2 0.45.1 hashes passwords, and sessions are held in HttpOnly cookies. No backend framework or frontend stack was replaced.

## Database design

IDs follow the existing CUID convention. Every merchant-owned aggregate stores a `merchantId` foreign key; related child records inherit ownership through a required parent foreign key. Merchant query handlers derive the tenant from the signed-in user and include it in database filters. Payment and transaction values use integer `amountMinor` plus ISO currency code; BDT 100.50 is stored as 10050. Existing transaction data is converted from decimal BDT to minor units by the migration.

Models cover users and verification/session tokens; merchants, business profiles, members and RBAC roles/permissions; payments, transactions, accounts and attempts; customers, links, invoices and items; brands/domains; devices/events; API keys/logs; webhooks/deliveries; plans/subscriptions; notifications and audit logs. Payment/transaction state values are `CREATED`, `PENDING`, `REVIEW`, `CONFIRMED`, `FAILED`, `EXPIRED`, `CANCELLED`, `REFUNDED`.

The forward migration maps old platform/operator roles to `SUPER_ADMIN` / `MERCHANT_MANAGER`. Legacy parser-derived `SUCCESS` transactions become `PENDING`; a notification match is not proof of settlement. Amount conversion preserves cents. Review approval is an explicit staff action. The new payment status endpoint does not allow `CONFIRMED` or `REFUNDED` without a future verified workflow.

## Environment

Copy `backend/.env.example` to `backend/.env`; copy `db/.env.example` to `db/.env` if Prisma CLI does not inherit the backend environment. Configure `DATABASE_URL` to a local PostgreSQL database. `JWT_SECRET` has a development-only default; it is required and must be a strong value in production. (`DEVICE_INGEST_SECRET` no longer exists: each device has its own token.) Never reuse the sample secrets in a deployed environment.

## Database commands

From the repository root:

```powershell
npm run db:up
npm run db:migrate
npm run db:seed
npm run db:studio
```

For production migration application use `npm --prefix db run migrate:deploy`; do not run the development seed against production. Seed credentials are synthetic development credentials printed by the seed command. The seed exits when `NODE_ENV=production`.

## Authentication and permissions

`POST /api/v1/auth/register` and `/login` issue short-lived access and refresh cookies. Refresh tokens are stored as SHA-256 hashes and rotated on refresh. Logout revokes the refresh session. Passwords use Argon2id. Forgot/reset-password uses a hashed, expiring, single-use `VerificationToken` row; reset requests remain enumeration-safe. There is no email delivery provider configured, so reset and verification delivery require a later mail integration.

System roles are `SUPER_ADMIN`, `ADMIN`, `SUPPORT`, `MERCHANT_OWNER`, `MERCHANT_ADMIN`, `MERCHANT_MANAGER`, `MERCHANT_SUPPORT`, and `MERCHANT_VIEWER`. Role, permission, role-permission and member-role tables are seeded. Existing routes enforce authenticated role gates; the foundation does not yet wire every permission key into every business route. Admin staff and merchant members should be limited to the route-level role checks until the permission middleware rollout is complete.

## API routes

All endpoints use `/api/v1` and JSON errors shaped as `{ error: { code, message, details?, requestId? } }`.

- Auth: register, login, refresh, logout, logout-all, forgot-password, reset-password, email verification request/verify, current user, profile, password change, sessions.
- Merchant: overview, accounts, devices, transactions, API keys, team, settings and audit logs (existing routes).
- Payments: `GET/POST /merchant/payments`, `GET /merchant/payments/:id`, `PATCH /merchant/payments/:id/status`. List responses include pagination metadata. All queries are scoped to the authenticated merchant.
- Admin, device pairing/notification, and event-stream routes remain in the existing modules.

The API does not connect to bKash, Nagad, Rocket or Upay and does not perform real verification, settlement, refunds, webhooks or notification delivery. Other newly modeled modules are database foundations, not complete API modules yet.

## Validation and tests

Run `npm --prefix db run generate`, `npx --prefix db prisma validate`, `npm --prefix backend run typecheck`, `npm --prefix backend run build`, and `npm --prefix backend test`. Database migration and seed execution require a running PostgreSQL instance and a configured `DATABASE_URL`.

## Current limitations and next steps

- The current environment had no Docker or local PostgreSQL service, so the new SQL migration and seed could not be executed against a database here.
- Password reset token delivery and email verification delivery need an email transport; tokens are persisted hashed and never logged.
- Role permission records are seeded, but granular permission middleware is not yet applied across all routes.
- Customer, invoice, link, webhook, API-log, notification, report, billing, and full admin operations still need route/service implementations.
- Add database-backed tenant-isolation tests and run migrations/seeding against a clean PostgreSQL 16 instance before treating Phase 2 as deployable.

Recommended next phase: complete database-backed authorization and ownership tests, then implement customer/invoice/link/API-key/webhook services in separate modules, and add email delivery integration before enabling account recovery in a deployment.
