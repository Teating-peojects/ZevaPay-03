# Advanced feature readiness (UI/UX audit, Phase 7)

Audit of what exists in the repository today, from reading `backend/src/routes/*`,
`db/prisma/schema.prisma` and `frontend/src/app/*`. Nothing here was built as part
of the visual polish task, and no module was faked in the UI.

"Schema only" means a Prisma model exists but no route or code in `backend/src`
reads or writes it.

| Module | Status | Existing backend support | Frontend today | Right phase |
|---|---|---|---|---|
| Webhooks (outbound) | Absent | Schema only (`WebhookEndpoint`, `WebhookDelivery`); no routes, no dispatcher | None | Backend first (CRUD, signing, delivery + retry), then UI |
| Payment links | Absent | Schema only (`PaymentLink`) | None | Backend first |
| Invoices | Absent | Schema only (`Invoice`, `InvoiceItem`) | None | Backend first |
| Refunds | Absent | `REFUNDED` status exists in the enum and the UI badge; no endpoint creates it | Badge only | Backend first; needs a decision on what a refund means for an SMS-recorded payment |
| Reconciliation / settlement | Absent | None; transactions are SMS records, not provider-verified | None | Needs a provider-side data source before any UI |
| Payment attempts / checkout | Absent | Schema only (`PaymentAttempt`) | None | Backend first |
| Merchant payments (manual) | Partial | `GET/POST /merchant/payments`, `PATCH .../:id/status` | `/dashboard/payments` list + new-payment modal | Polish only (Phase 2 leftover) |
| Customers | Implemented | Full CRUD | `/dashboard/customers` | Done |
| API keys | Implemented (create/list/revoke) | `/merchant/api-keys` | `/dashboard/developers` | Usage logs absent: `ApiRequestLog` is schema only |
| Team members | Partial | `GET/POST /merchant/team`; role/permission tables exist, `plugins/auth.ts` reads roles | `/dashboard/team` | Role editing, invite email, per-permission UI are not built |
| Audit logs | Implemented | `/admin/audit-logs`, `/merchant/audit-logs` | Both consoles (Phase 3) | Done |
| Device management | Implemented, with limits | Pair, rename, re-link, delete; heartbeat sets ONLINE but nothing sets OFFLINE | Phase 4 adds a client-side health label | Server-side offline sweep; `DeviceEvent` is schema only, so no event history |
| Notifications (in-app / email) | Absent | `Notification` model is schema only; no email delivery (password reset and verify-email tokens exist) | None | Backend first |
| Brand / custom domains | Absent | Schema only (`Brand`, `BrandDomain`) | None | Later |
| Plans / subscriptions / billing | Absent | Schema only (`Plan`, `Subscription`) | None | Later |
| Exports | Partial | Server CSV export ignores filters, newest 5,000 | Table exports the rows on screen | Server export that honours filters |
| 2FA | Absent | None | Security page has password change + sign-out-all only | Backend first |
| System status (admin) | Partial | `/admin/settings` returns record counts + environment | Settings page (shows retry on failure) | Real health data (queue, device freshness) |
| Live updates | Implemented | SSE `/stream` | `LiveIndicator`, auto-refresh | Done |

## Integrity points to preserve

- A `CONFIRMED` transaction means an SMS matched. It is not provider verification.
  Parser confidence must never be shown as independent verification.
- On manual ACCEPT the backend sets confidence to 1; the UI explains this in the
  review dialog. The stored value then no longer reflects parser confidence.
- The overview "recorded amount" sums all statuses. A confirmed-only revenue
  figure needs a backend change.

## Suggested order

1. Server-side offline marking + device event history (small, improves trust).
2. Outbound webhooks (models exist; highest value for integrators).
3. Refund semantics, then payment links and invoices.
4. Email delivery, notifications, then 2FA.
