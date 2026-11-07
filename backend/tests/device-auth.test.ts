import { beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "./helpers/fake-prisma.js";

vi.mock("../src/db.js", async () => ({
  prisma: (await import("./helpers/fake-prisma.js")).prisma,
}));

import { authenticateDevice, readDeviceToken } from "../src/lib/device-auth.js";
import { pairDevice } from "../src/lib/device-pairing.js";
import { generateDeviceToken, generatePairingCode, looksLikeDeviceToken, sha256 } from "../src/lib/hash.js";

const FUTURE = new Date(Date.now() + 10 * 60_000);

function seed() {
  store.devices = [];
  store.accounts = [{ id: "acc1", merchantId: "m1", provider: "BKASH", label: "bKash shop" }];
  store.pairingCodes = [
    { id: "c1", code: "ZP-AAAA-BB", merchantId: "m1", connectedAccountId: "acc1", expiresAt: FUTURE, usedAt: null, createdAt: new Date() },
    { id: "c2", code: "ZP-CCCC-DD", merchantId: "m1", connectedAccountId: null, expiresAt: FUTURE, usedAt: null, createdAt: new Date() },
    { id: "c3", code: "ZP-EEEE-FF", merchantId: "m2", connectedAccountId: null, expiresAt: FUTURE, usedAt: null, createdAt: new Date() },
  ];
}
beforeEach(seed);

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

describe("tokens", () => {
  it("are random, prefixed and recognisable", () => {
    const a = generateDeviceToken();
    expect(a).toMatch(/^zpd_[A-Za-z0-9_-]{32}$/);
    expect(looksLikeDeviceToken(a)).toBe(true);
    expect(generateDeviceToken()).not.toBe(a);
    expect(looksLikeDeviceToken("zp_live_" + "a".repeat(32))).toBe(false);
  });

  it("pairing codes use the readable alphabet", () => {
    for (let i = 0; i < 50; i++) expect(generatePairingCode()).toMatch(/^ZP-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{2}$/);
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

describe("pairing", () => {
  it("issues a token once and stores only its hash", async () => {
    const { device, token } = await pairDevice({ code: "zp-aaaa-bb", deviceId: "ZP-SMS-1", deviceName: "Counter" });
    expect(looksLikeDeviceToken(token)).toBe(true);
    expect(device).toMatchObject({ merchantId: "m1", deviceId: "ZP-SMS-1", connectedAccountId: "acc1", tokenHash: sha256(token) });
    expect(JSON.stringify(store)).not.toContain(token);
    expect(store.pairingCodes[0]).toMatchObject({ usedAt: expect.any(Date), deviceId: device.id });
  });

  it("refuses an unknown, used or expired code", async () => {
    await expect(pairDevice({ code: "ZP-NOPE-00", deviceId: "d1x" })).rejects.toThrow(/not recognised/);
    await pairDevice({ code: "ZP-AAAA-BB", deviceId: "ZP-SMS-1" });
    await expect(pairDevice({ code: "ZP-AAAA-BB", deviceId: "ZP-SMS-2" })).rejects.toThrow(/already been used/);
    store.pairingCodes[1]!.expiresAt = new Date(Date.now() - 1000);
    await expect(pairDevice({ code: "ZP-CCCC-DD", deviceId: "ZP-SMS-3" })).rejects.toThrow(/expired/);
    expect(store.devices).toHaveLength(1);
  });

  it("will not take over another merchant's device", async () => {
    await pairDevice({ code: "ZP-AAAA-BB", deviceId: "ZP-SMS-1" });
    await expect(pairDevice({ code: "ZP-EEEE-FF", deviceId: "ZP-SMS-1" })).rejects.toThrow(/another merchant/);
    expect(store.devices[0]!.merchantId).toBe("m1");
    expect(store.pairingCodes[2]!.usedAt).toBeNull();
  });

  it("pairing again replaces the token, so the old one stops working", async () => {
    const first = await pairDevice({ code: "ZP-AAAA-BB", deviceId: "ZP-SMS-1" });
    const second = await pairDevice({ code: "ZP-CCCC-DD", deviceId: "ZP-SMS-1" });
    expect(store.devices).toHaveLength(1);
    await expect(authenticateDevice(bearer(first.token))).rejects.toThrow();
    await expect(authenticateDevice(bearer(second.token))).resolves.toMatchObject({ deviceId: "ZP-SMS-1" });
  });

  it("lets only one of two devices racing on a code succeed", async () => {
    const results = await Promise.allSettled([
      pairDevice({ code: "ZP-AAAA-BB", deviceId: "ZP-SMS-1" }),
      pairDevice({ code: "ZP-AAAA-BB", deviceId: "ZP-SMS-2" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
});

describe("authenticating a device", () => {
  async function paired() {
    return pairDevice({ code: "ZP-AAAA-BB", deviceId: "ZP-SMS-1" });
  }

  it("finds the device from its own token", async () => {
    const { token } = await paired();
    const device = await authenticateDevice(bearer(token));
    expect(device).toMatchObject({ deviceId: "ZP-SMS-1", merchantId: "m1" });
    expect(device.connectedAccount).toMatchObject({ provider: "BKASH" });
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
