# Hosted checkout: integrating a merchant's site

A merchant's server creates a payment, sends the customer to the link it gets
back, and later asks ZevaPay whether the payment was confirmed.

```
 Merchant's server           ZevaPay                      Customer
        │  POST /checkout/payments  │                          │
        │ ─────────────────────────▶│                          │
        │◀───────── checkoutUrl ────│                          │
        │  redirect the customer ──────────────────────────────▶│
        │                           │◀── opens link, pays in    │
        │                           │    bKash/Nagad, enters    │
        │                           │    the TrxID              │
        │                           │   SMS on the merchant's   │
        │                           │   phone matches it        │
        │  GET /checkout/payments/:id (when the customer returns)│
        │ ─────────────────────────▶│                          │
        │◀──── status: CONFIRMED ───│                          │
```

## What "confirmed" means

`CONFIRMED` means a notification recorded on the merchant's own phone agreed
with the customer on the **provider, the TrxID and the amount**. It is not a
check with bKash or Nagad. Anyone who can send an SMS to that phone can imitate
a notification, so a merchant who needs certainty should confirm large
payments in the provider's own app before releasing goods.

## 1. Get an API key

Create a key under **Developers** in the dashboard. It is shown once; store it
on your server and never in a web page or mobile app. Keys created before this
feature existed were generated with weak randomness and cannot be used: revoke
them and create new ones.

## 2. Create a payment

```
POST /api/v1/checkout/payments
Authorization: Bearer zp_live_…
Content-Type: application/json

{
  "amountMinor": 300000,
  "description": "Panjabi set",
  "orderId": "ORD-1182",
  "returnUrl": "https://shop.example/thanks",
  "expiresInMinutes": 30
}
```

| Field | Notes |
| ----- | ----- |
| `amountMinor` | Required. Poisha: `300000` is Tk 3,000.00. Minimum 100. |
| `description` | Optional, up to 200 characters. Shown to the customer. |
| `orderId` | Optional. Your own order number, returned when you read the payment. |
| `returnUrl` | Optional. Must be `https://` (or `http://localhost` while developing) and must not contain a username or password. |
| `expiresInMinutes` | Optional, 5 to 1440. Default 30. |

Response `201`:

```json
{
  "data": {
    "id": "clx…",
    "reference": "TXN-591589",
    "status": "CREATED",
    "amountMinor": 300000,
    "currency": "BDT",
    "expiresAt": "2026-11-06T10:30:00.000Z",
    "orderId": "ORD-1182",
    "checkoutUrl": "https://pay.example/pay/…"
  }
}
```

Save `id`, then send the customer to `checkoutUrl`. The link is the customer's
only credential and is returned **once**: only a hash of it is stored.

## 3. Send the customer back and read the result

When the customer presses "Back to the shop" they land on your `returnUrl` with
`?zp_payment=<id>` added. That parameter only tells you which payment to look
up. **Never treat a visit to your return page as proof of payment**: ask the API.

```
GET /api/v1/checkout/payments/:id
Authorization: Bearer zp_live_…
```

```json
{
  "data": {
    "id": "clx…",
    "reference": "TXN-591589",
    "status": "CONFIRMED",
    "amountMinor": 300000,
    "currency": "BDT",
    "expired": false,
    "expiresAt": "2026-11-06T10:30:00.000Z",
    "confirmedAt": "2026-11-06T10:12:44.000Z",
    "orderId": "ORD-1182"
  }
}
```

| `status` | What to do |
| -------- | ---------- |
| `CREATED` | The customer has not entered a TrxID yet. |
| `PENDING` | A TrxID was entered. Waiting for its SMS. |
| `REVIEW` | The TrxID matched but something disagreed (usually the amount). The merchant decides in the dashboard. Do not release goods yet. |
| `CONFIRMED` | Matched. |
| `CANCELLED`, `FAILED`, `EXPIRED` | Will not complete. Create a new payment. |

`expired: true` on a `CREATED` or `PENDING` payment means its time ran out.

Poll no faster than every few seconds; webhooks are not available yet.

## Errors

`401` missing, wrong, revoked or expired key. `403` the merchant is not
active. `404` payment not found (or belongs to another merchant). `400`
validation, with a message saying which field.

## Running it

- `PUBLIC_APP_URL` must be the address customers open. Checkout links are built from it.
- The web app must sit behind a reverse proxy that sets `X-Forwarded-For`.
  Without it every customer appears to come from the web server, and they share
  one rate limit.
- A merchant needs at least one **active** payment account (bKash or Nagad) or
  the checkout page says it cannot take payments. If a merchant has several
  accounts for one provider, the oldest active one is shown.
