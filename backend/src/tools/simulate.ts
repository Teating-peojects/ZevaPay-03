import "dotenv/config";
import { SAMPLE_NOTIFICATIONS } from "../parser/samples.js";

/**
 * Device simulator.
 *
 * Stands in for the Android SMS Bridge app. It follows the same flow a real
 * phone would:
 *
 *   1. sign in to the merchant account
 *   2. make a phone key
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
/** The device's own token, received when it pairs. */
let deviceToken: string | null = null;

interface Args {
  email: string;
  password: string;
  deviceKey?: string;
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
      case "--device-key":
        args.deviceKey = value;
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
    if (deviceToken) headers.authorization = `Bearer ${deviceToken}`;
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

  // 2. Make a phone key, unless we were given one. A phone key is the third
  //    thing the app asks for, after the email and password.
  let deviceKey = args.deviceKey;
  if (!deviceKey) {
    const made = await request(
      "/api/v1/merchant/device-keys",
      { name: `Simulator ${new Date().toISOString().slice(0, 16)}` },
      { asUser: true },
    );
    if (!made.ok) {
      console.error("Could not make a phone key:", made.payload);
      process.exit(1);
    }
    deviceKey = made.payload.secret;
    console.log("Made a phone key for this run.");
  }

  // 3. Connect the simulated phone, as the app does.
  console.log(`Connecting ${args.deviceId}…`);
  const pair = await request("/api/v1/device/connect", {
    email: args.email,
    password: args.password,
    deviceKey,
    deviceId: args.deviceId,
    deviceName: args.deviceName,
    androidVersion: "Android 14 (Simulator)",
  });
  if (!pair.ok) {
    console.error("Connecting failed:", pair.payload);
    process.exit(1);
  }
  deviceToken = pair.payload.deviceToken;
  console.log(`Connected: ${pair.payload.device.name} (${pair.payload.device.deviceId})\n`);

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
