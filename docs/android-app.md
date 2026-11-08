# Android SMS bridge: what to build

This is the contract for the phone app. It does not exist yet. The server side
it talks to is finished and tested (`docs/api.md`, "Device ingest").

> **Status:** a first version of this app is in `android/`. It was written without
> being compiled or run (the build environment had no Android SDK), so build
> it in Android Studio and test on a phone before relying on it. See
> `android/README.md`.

## What the app is for

A merchant installs it on the phone that receives their bKash or Nagad
payment SMS. The app **forwards those SMS to ZevaPay and does nothing else**.
The server decides whether a payment matches. The app never approves,
rejects, or even parses an amount.

Why it is built this way: the phone is the least trusted part of the system. If
the app decided, a modified app could approve anything.

## Flow

1. **Connect.** In two steps. Step 1: the merchant types the ZevaPay address,
   email and password (kept in memory only). Step 2: they paste a phone key
   made on the website (Devices → Connect). The app then calls
   `POST /api/v1/device/connect` with the email, password, key, a stable `deviceId` it generates once (`ZP-SMS-` + 6 hex), a name and
   the Android version. The reply carries `deviceToken` **once**. Save it in
   encrypted storage (Android Keystore + EncryptedSharedPreferences).
2. **Listen.** A manifest-declared `SMS_RECEIVED` receiver gets each incoming
   SMS. No always-on service is needed.
3. **Filter.** Keep only messages from these senders, and drop everything else
   on the phone. **Personal SMS never leave the device.**

   | Provider | Sender the SMS comes from |
   | --- | --- |
   | bKash | `bKash` |
   | Nagad | `NAGAD` |
   | Rocket | `16216` (a number, not a name) |
   | Upay | `upay` |

   Match the sender exactly (ignoring case), not "contains". The list is fixed in
   the code in version 1 (`Senders.kt`); change it there if a provider changes
   its sender.
4. **Queue.** Write the message to a local database first (Room), with the
   time it arrived. Never send straight from the receiver.
5. **Send.** A background job (WorkManager) posts queued messages in order to
   `POST /api/v1/device/notifications` with `Authorization: Bearer <token>`:
   `{ "message": "<exact SMS text>", "receivedAt": "<ISO time>", "provider": "BKASH" }`.
6. **Heartbeat.** `POST /api/v1/device/heartbeat` about every 15 minutes (the fastest Android allows for background work), so the
   dashboard shows the phone online.

## Handling replies

| Reply | Meaning | App does |
| --- | --- | --- |
| `201` / `200` with `duplicate: true` | Stored (or already stored) | Delete from the queue. Safe to send twice. |
| `401 UNAUTHORIZED_DEVICE` | Token wrong, or device removed in the dashboard | Stop sending. Show "Connect this phone again". Keep the queue. |
| `400` / `422` | The server will never accept this message | Mark it failed, keep it visible to the user, do not retry forever. |
| `429` | Too many requests | Wait, then retry with backoff. |
| `5xx`, no network | Try later | Retry with growing delay (30 s, 1 m, 5 m … capped at 1 h). |

The `autoAccepted` and `status` fields in the reply are for display only
("matched a payment" / "recorded"). The app must not treat them as proof of
anything.

## Screens

- **Connect**: step 1 address, email, password; step 2 phone key; error text
  from the server. A wrong email or password returns to step 1.
- **Status**: paired as *name*, last heartbeat, messages waiting, last sent,
  and a clear red state when SMS permission is missing, battery optimisation
  is killing the app, or the token was rejected.
- **Recent**: the last forwarded messages with their result. The message body
  is shown only here, on the phone.
- **Settings**: provider sender names, "Pair again", "Remove this phone".

## Permissions and rules

- `RECEIVE_SMS` only. Do not ask for `READ_SMS` or contacts.
- Ask the user to exempt the app from battery optimisation, and explain why.
- Do not log message bodies, tokens, or phone numbers.
- Over HTTPS only. Do not trust user-installed certificates.
- Do not forward a message that looks like a PIN or one-time code request.
  Only forward messages that say money was received.

## Distribution: decide before building

Google Play treats SMS permissions as restricted and approves them only for a
narrow set of app types. An app that forwards SMS to a server is unlikely to
qualify. The realistic choices are to hand the merchant an APK directly (they
allow "install unknown apps"), or to apply to Play with a Permissions
Declaration and be prepared for a refusal. Decide this first, because it
changes how updates and trust work.

## How to test without a phone

`npm run simulate` in `backend/` plays the same flow (sign in, get a code, pair,
store the token, post sample SMS). The app's HTTP layer should behave exactly like
`src/tools/simulate.ts`.

Checks before calling the app done:

- pair, then kill the app, reboot, and confirm it still sends
- airplane mode: messages queue, then arrive in order on reconnect
- the same SMS sent twice shows `duplicate: true` and no second transaction
- remove the device in the dashboard: the next send gives 401 and the app shows
  "Pair again"
- an SMS from a number that is not a provider is never sent
- a real bKash receive SMS, end to end, matches a checkout payment

## Open questions for the owner

1. Distribution: direct APK or Play Store attempt?
2. One provider per phone, or may one phone carry both bKash and Nagad SIMs?
   (The server binds a device to one payment account today.)
3. Who builds it: Kotlin in a new repository is the simplest fit.
