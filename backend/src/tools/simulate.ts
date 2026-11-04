import "dotenv/config";
import { SAMPLE_NOTIFICATIONS } from "../parser/samples.js";

/**
 * Device simulator.
 *
 * Stands in for the Android SMS Bridge app. It follows the same flow a real
 * phone would:
 *
 *   1. sign in to the merchant account
 *   2. request a pairing code
 *   3. exchange the code for a device binding
 *   4. post provider notifications at a realistic cadence
 *
 * This lets the dashboards be exercised end to end without a physical phone.
 *
 * Usage:
 *   npm run simulate -- --email owner@dhanmondi.test --password 'ZevaPay#2026' \
 *                      --device ZP-SMS-SIM01 --count 10
 */
const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4000";
const DEVICE_SECRET =
  process.env.DEVICE_INGEST_SECRET ?? "dev-device-ingest-secret";

interface Args {
  email: string;
  password: string;
  pairingCode?: string;
  deviceId: string;
  deviceName: string;
  count: number;
  intervalMs: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    email: process.env.SIM_EMAIL ?? "owner@dhanmondi.test",
    password: process.env.SIM_PASSWORD ?? "ZevaPay#2026",
    deviceId: "ZP-SMS-SIM01",
    deviceName: "Simulated Counter Terminal",
    count: 10,
    intervalMs: 3000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const value = argv[i + 1];
    switch (token) {
      case "--email":
        args.email = value;
        i += 1;
        break;
      case "--password":
        args.password = value;
        i += 1;
        break;
      case "--pairing":
        args.pairingCode = value;
        i += 1;
        break;
      case "--device":
        args.deviceId = value;
        i += 1;
        break;
      case "--name":
        args.deviceName = value;
        i += 1;
        break;
      case "--count":
        args.count = Number(value);
        i += 1;
        break;
      case "--interval":
        args.intervalMs = Number(value) * 1000;
        i += 1;
        break;
      default:
        break;
    }
  }

  return args;
}

/** Minimal cookie jar — the API sets httpOnly session cookies. */
const cookieJar = new Map<string, string>();

function cookieHeader(): string {
  return [...cookieJar.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function absorbCookies(response: Response): void {
  const raw = response.headers.getSetCookie?.() ?? [];
  for (const entry of raw) {
    const [pair] = entry.split(";");
    const index = pair.indexOf("=");
    if (index === -1) continue;
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (value === "") cookieJar.delete(name);
    else cookieJar.set(name, value);
  }
}

async function request(
  path: string,
  body: unknown,
  options: { asUser?: boolean } = {},
): Promise<{ ok: boolean; status: number; payload: any }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (options.asUser) {
    const cookies = cookieHeader();
    if (cookies) headers.cookie = cookies;
  } else {
    headers["x-device-secret"] = DEVICE_SECRET;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  absorbCookies(response);

  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // 1. Sign in as the merchant.
  const login = await request("/api/v1/auth/login", {
    email: args.email,
    password: args.password,
  });
  if (!login.ok) {
    console.error("Sign-in failed:", login.payload);
    process.exit(1);
  }
  console.log(`Signed in as ${login.payload.user.email}`);

  // 2. Obtain a pairing code — either one we were given, or a fresh one.
  //    The device is bound to the account that matches the provider the
  //    simulator will post for, so notifications land on a sensible account.
  let pairingCode = args.pairingCode;
  if (!pairingCode) {
    const targetProvider = SAMPLE_NOTIFICATIONS[0]!.provider;

    const accountsResponse = await fetch(
      `${API_BASE}/api/v1/merchant/accounts`,
      { headers: { cookie: cookieHeader() } },
    );
    const accountsPayload = (await accountsResponse.json()) as {
      accounts?: { id: string; provider: string; label: string }[];
    };
    const accounts: { id: string; provider: string; label: string }[] =
      accountsPayload.accounts ?? [];
    const match = accounts.find(
      (account) => account.provider === targetProvider,
    );
    const accountId = match?.id ?? accounts[0]?.id ?? null;

    const pairing = await request(
      "/api/v1/merchant/devices/pairing-codes",
      { connectedAccountId: accountId },
      { asUser: true },
    );
    if (!pairing.ok) {
      console.error("Could not create a pairing code:", pairing.payload);
      process.exit(1);
    }
    pairingCode = pairing.payload.pairingCode.code;
    console.log(
      `Pairing code: ${pairingCode} (account: ${match?.label ?? "none"})`,
    );
  }

  // 3. Pair the simulated device.
  console.log(`Pairing ${args.deviceId}…`);
  const pair = await request("/api/v1/device/pair", {
    code: pairingCode,
    deviceId: args.deviceId,
    deviceName: args.deviceName,
    androidVersion: "Android 14 (Simulator)",
  });
  if (!pair.ok) {
    console.error("Pairing failed:", pair.payload);
    process.exit(1);
  }
  console.log(`Paired: ${pair.payload.device.name} (${pair.payload.device.deviceId})\n`);

  // 4. Post notifications.
  console.log(
    `Posting ${args.count} notifications every ${args.intervalMs / 1000}s to ${API_BASE}\n`,
  );

  for (let i = 0; i < args.count; i += 1) {
    const sample = SAMPLE_NOTIFICATIONS[i % SAMPLE_NOTIFICATIONS.length]!;

    const response = await request("/api/v1/device/notifications", {
      deviceId: args.deviceId,
      message: sample.text,
      provider: sample.provider,
    });

    if (!response.ok) {
      console.error(`[${i + 1}] Failed:`, response.payload);
    } else if (response.payload.duplicate) {
      console.log(`[${i + 1}] Duplicate ignored (${response.payload.transactionId})`);
    } else {
      const route =
        response.payload.status === "PENDING"
          ? `awaiting verification (parser confidence ${response.payload.confidence})`
          : `needs review (parser confidence ${response.payload.confidence})`;
      console.log(
        `[${i + 1}] ${sample.provider} ${response.payload.reference} → ${response.payload.status} · ${route}`,
      );
      if (response.payload.missing?.length) {
        console.log(`      missing: ${response.payload.missing.join(", ")}`);
      }
    }

    if (i < args.count - 1) await sleep(args.intervalMs);
  }

  console.log("\nSimulation complete.");
}

main().catch((error) => {
  console.error("Simulator failed:", error);
  process.exit(1);
});
