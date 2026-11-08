import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "./helpers/fake-prisma.js";

vi.mock("../src/db.js", async () => ({
  prisma: (await import("./helpers/fake-prisma.js")).prisma,
}));

import { authenticateDevice, readDeviceToken } from "../src/lib/device-auth.js";
import { connectDevice } from "../src/lib/device-connect.js";
import { hashPassword } from "../src/lib/password.js";
import { generateDeviceToken, generateDeviceKeySecret, looksLikeDeviceKey, looksLikeDeviceToken, sha256 } from "../src/lib/hash.js";

const KEY = generateDeviceKeySecret();
const OTHER_KEY = generateDeviceKeySecret();
let passwordHash = "";

function seed() {
  store.devices = [];
  store.merchants = [
    { id: "m1", status: "ACTIVE" },
    { id: "m2", status: "ACTIVE" },
    { id: "m3", status: "SUSPENDED" },
  ];
  store.users = [
    { id: "u1", email: "owner@shop.test", merchantId: "m1", isActive: true, passwordHash },
    { id: "u2", email: "other@shop.test", merchantId: "m2", isActive: true, passwordHash },
    { id: "u3", email: "susp@shop.test", merchantId: "m3", isActive: true, passwordHash },
    { id: "u4", email: "off@shop.test", merchantId: "m1", passwordHash, isActive: false },
  ];
  store.apiKeys = [
    { id: "k1", merchantId: "m1", kind: "DEVICE", keyHash: sha256(KEY), revokedAt: null, expiresAt: null },
    { id: "k2", merchantId: "m2", kind: "DEVICE", keyHash: sha256(OTHER_KEY), revokedAt: null, expiresAt: null },
  ];
}
beforeAll(async () => {
  passwordHash = await hashPassword("correct horse");
});
beforeEach(seed);

const ok = { email: "owner@shop.test", password: "correct horse", deviceKey: KEY };

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

describe("tokens", () => {
  it("are random, prefixed and recognisable", () => {
    const a = generateDeviceToken();
    expect(a).toMatch(/^zpd_[A-Za-z0-9_-]{32}$/);
    expect(looksLikeDeviceToken(a)).toBe(true);
    expect(generateDeviceToken()).not.toBe(a);
    expect(looksLikeDeviceToken("zp_live_" + "a".repeat(32))).toBe(false);
  });

  it("phone keys are random, prefixed and not accepted as API keys", () => {
    const k = generateDeviceKeySecret();
    expect(k).toMatch(/^zp_phone_[A-Za-z0-9_-]{32}$/);
    expect(looksLikeDeviceKey(k)).toBe(true);
    expect(looksLikeDeviceKey("zp_live_" + "a".repeat(32))).toBe(false);
  });

  it("readDeviceToken accepts only a well-formed bearer token", () => {
    const t = generateDeviceToken();
    expect(readDeviceToken(bearer(t))).toBe(t);
    expect(readDeviceToken({ authorization: `bearer ${t}` })).toBe(t);
    expect(readDeviceToken({})).toBeNull();
    expect(readDeviceToken({ authorization: t })).toBeNull();
    expect(readDeviceToken({ authorization: "Bearer nope" })).toBeNull();
    expect(readDeviceToken({ "x-device-secret": "whatever" })).toBeNull();
  });
});

describe("connecting a phone", () => {
  it("issues a token once and stores only its hash", async () => {
    const { device, token } = await connectDevice({ ...ok, deviceId: "ZP-SMS-1", deviceName: "Counter" });
    expect(looksLikeDeviceToken(token)).toBe(true);
    expect(device).toMatchObject({ merchantId: "m1", deviceId: "ZP-SMS-1", tokenHash: sha256(token) });
    expect(JSON.stringify(store.devices)).not.toContain(token);
    expect(store.apiKeys[0]!.lastUsedAt).toBeInstanceOf(Date);
  });

  it("accepts the email in any letter case", async () => {
    await expect(connectDevice({ ...ok, email: "OWNER@Shop.test", deviceId: "ZP-SMS-1" })).resolves.toBeTruthy();
  });

  it("refuses a wrong password, unknown email or disabled user with one answer", async () => {
    for (const bad of [{ password: "nope" }, { email: "nobody@shop.test" }, { email: "off@shop.test" }]) {
      await expect(connectDevice({ ...ok, ...bad, deviceId: "ZP-SMS-1" })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    }
    expect(store.devices).toHaveLength(0);
  });

  it("refuses a suspended merchant", async () => {
    await expect(
      connectDevice({ ...ok, email: "susp@shop.test", deviceId: "ZP-SMS-1" }),
    ).rejects.toThrow(/not active/);
  });

  it("refuses a missing, malformed, unknown, revoked or expired phone key", async () => {
    const attempts = [KEY.slice(0, -1), "zp_live_" + "a".repeat(32), generateDeviceKeySecret(), ""];
    for (const deviceKey of attempts) {
      await expect(connectDevice({ ...ok, deviceKey, deviceId: "ZP-SMS-1" })).rejects.toMatchObject({ code: "INVALID_DEVICE_KEY" });
    }
    store.apiKeys[0]!.revokedAt = new Date();
    await expect(connectDevice({ ...ok, deviceId: "ZP-SMS-1" })).rejects.toMatchObject({ code: "INVALID_DEVICE_KEY" });
    store.apiKeys[0]!.revokedAt = null;
    store.apiKeys[0]!.expiresAt = new Date(Date.now() - 1000);
    await expect(connectDevice({ ...ok, deviceId: "ZP-SMS-1" })).rejects.toMatchObject({ code: "INVALID_DEVICE_KEY" });
    expect(store.devices).toHaveLength(0);
  });

  it("refuses another merchant's phone key", async () => {
    await expect(connectDevice({ ...ok, deviceKey: OTHER_KEY, deviceId: "ZP-SMS-1" })).rejects.toMatchObject({ code: "INVALID_DEVICE_KEY" });
  });

  it("refuses an integration key used as a phone key", async () => {
    store.apiKeys[0]!.kind = "INTEGRATION";
    await expect(connectDevice({ ...ok, deviceId: "ZP-SMS-1" })).rejects.toMatchObject({ code: "INVALID_DEVICE_KEY" });
  });

  it("checks the password before telling anyone whether the key was right", async () => {
    await expect(
      connectDevice({ ...ok, password: "nope", deviceKey: "wrong", deviceId: "ZP-SMS-1" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("will not take over another merchant's device", async () => {
    await connectDevice({ ...ok, deviceId: "ZP-SMS-1" });
    await expect(
      connectDevice({ email: "other@shop.test", password: "correct horse", deviceKey: OTHER_KEY, deviceId: "ZP-SMS-1" }),
    ).rejects.toThrow(/another merchant/);
    expect(store.devices[0]!.merchantId).toBe("m1");
  });

  it("connecting again replaces the token, so the old one stops working", async () => {
    const first = await connectDevice({ ...ok, deviceId: "ZP-SMS-1" });
    const second = await connectDevice({ ...ok, deviceId: "ZP-SMS-1" });
    expect(store.devices).toHaveLength(1);
    await expect(authenticateDevice(bearer(first.token))).rejects.toThrow();
    await expect(authenticateDevice(bearer(second.token))).resolves.toMatchObject({ deviceId: "ZP-SMS-1" });
  });
});

describe("authenticating a device", () => {
  async function paired() {
    return connectDevice({ ...ok, deviceId: "ZP-SMS-1" });
  }

  it("finds the device from its own token", async () => {
    const { token } = await paired();
    const device = await authenticateDevice(bearer(token));
    expect(device).toMatchObject({ deviceId: "ZP-SMS-1", merchantId: "m1" });
  });

  it("accepts a body deviceId only if it is the token's own", async () => {
    const { token } = await paired();
    await expect(authenticateDevice(bearer(token), "ZP-SMS-1")).resolves.toBeTruthy();
    await expect(authenticateDevice(bearer(token), "ZP-SMS-OTHER")).rejects.toThrow(/not authorised/);
  });

  it("refuses a missing, malformed or unknown token", async () => {
    await paired();
    for (const headers of [{}, bearer("zpd_nope"), bearer(generateDeviceToken()), { authorization: "Basic abc" }]) {
      await expect(authenticateDevice(headers as never)).rejects.toThrow(/not authorised/);
    }
  });

  it("does not accept the old shared secret", async () => {
    await paired();
    await expect(
      authenticateDevice({ "x-device-secret": "dev-device-ingest-secret-change-me" }, "ZP-SMS-1"),
    ).rejects.toThrow(/not authorised/);
  });

  it("refuses a device that was paired before tokens existed", async () => {
    store.devices = [{ id: "old", merchantId: "m1", deviceId: "ZP-OLD", tokenHash: null }];
    await expect(authenticateDevice(bearer(generateDeviceToken()), "ZP-OLD")).rejects.toThrow();
  });

  it("stops working once the device is removed", async () => {
    const { token } = await paired();
    store.devices = [];
    await expect(authenticateDevice(bearer(token))).rejects.toThrow(/not authorised/);
  });
});
