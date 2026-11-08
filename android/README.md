# ZevaPay SMS (Android)

Forwards payment SMS from **bKash, Nagad, Rocket (16216) and Upay** to ZevaPay.
It does nothing else: the server matches the TrxID and amount, and the app only
shows the server's answer (Matched, Needs review, or Recorded). Read
`docs/android-app.md` for the full contract.

> **Not yet built or run.** This code was written where no Android SDK was
> available. It has never been compiled. Expect to fix small build errors the
> first time.

## What it does

- Receives each SMS (`RECEIVE_SMS` only) and keeps it **only if** the sender is
  exactly one of `bKash`, `NAGAD`, `16216`, `upay` (case ignored). Anything else
  never leaves the phone and is not stored.
- Drops PIN and one-time-code messages.
- Writes each kept message to a local queue first, then sends it with
  `Authorization: Bearer <device token>` to `POST /api/v1/device/notifications`.
  It retries with a growing delay when there is no network.
- Checks in every 15 minutes (`/api/v1/device/heartbeat`).
- Stores the device token in encrypted storage. If the server answers 401 (the
  device was removed in the dashboard), it stops sending, keeps the queue, and
  asks to connect again.

## Build and run

1. Open the `android/` folder in Android Studio (Koala or newer, JDK 17).
2. Let Gradle sync. Run on a phone (SMS cannot be received on most emulators; an
   emulator can fake one with `adb emu sms send bKash "…"`).
3. In the dashboard open **Devices**, choose a payment account, create a pairing
   code. In the app enter your ZevaPay address and the code.
4. Tap **Allow SMS**, and allow running in the background.

Debug builds accept a plain `http://` address (for a server on your network).
Release builds accept `https://` only.

Unit tests (sender filter, address rules, server-answer mapping):

```
cd android && gradle :app:testDebugUnitTest
```

## Checklist before trusting it

- Connect (email, password, phone key), kill the app, reboot the phone: a new SMS still reaches the server.
- Airplane mode: a message queues, then arrives in order on reconnect.
- The same SMS posted twice shows "Already sent" and no second transaction.
- Remove the device in the dashboard: the next send gives "connect again".
- An SMS from any other number is never sent.
- A real bKash receive SMS matches a checkout payment end to end.

## Known limits

- English only. No settings for the sender list: edit `Senders.kt`.
- Rocket and Upay SMS are forwarded, but the server's checkout only matches bKash and
  Nagad until their real SMS formats are added to the parser.
- One phone is one device. Two SIMs in one phone work if both SMS reach the app.
