import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma as fakePrisma, resetStore, store } from "./helpers/fake-prisma.js";

vi.mock("../src/db.js", async () => ({
  prisma: (await import("./helpers/fake-prisma.js")).prisma,
}));

import { readApiKey, resolveApiKey } from "../src/lib/api-key-auth.js";
import { ForbiddenError, UnauthorizedError } from "../src/lib/errors.js";
import { generateApiKeySecret, looksLikeApiKey, sha256 } from "../src/lib/hash.js";

const SECRET = generateApiKeySecret();
const NOW = new Date("2026-11-06T10:00:00Z");

function seed(overrides: { key?: object; merchant?: object } = {}) {
  resetStore();
  store.merchants = [{ id: "m1", status: "ACTIVE", ...overrides.merchant }];
  store.apiKeys = [
    {
      id: "k1",
      merchantId: "m1",
      keyHash: sha256(SECRET),
      revokedAt: null,
      expiresAt: null,
      lastUsedAt: null,
      ...overrides.key,
    },
  ];
}

beforeEach(() => seed());

describe("API key secrets", () => {
  it("are unguessable and have a recognisable shape", () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateApiKeySecret()));
    expect(keys.size).toBe(50);
    for (const key of keys) {
      expect(key).toMatch(/^zp_live_[A-Za-z0-9_-]{32}$/);
      expect(looksLikeApiKey(key)).toBe(true);
    }
  });

  it("do not accept the old Math.random shape", () => {
    expect(looksLikeApiKey("zp_live_k3j9x0abc1d2e3f4g5h6")).toBe(false);
    expect(looksLikeApiKey("zp_live_")).toBe(false);
    expect(looksLikeApiKey("")).toBe(false);
  });
});

describe("readApiKey", () => {
  it("reads a bearer token", () => {
    expect(readApiKey({ authorization: `Bearer ${SECRET}` })).toBe(SECRET);
    expect(readApiKey({ authorization: `bearer   ${SECRET}  ` })).toBe(SECRET);
  });

  it("reads x-api-key", () => {
    expect(readApiKey({ "x-api-key": SECRET })).toBe(SECRET);
  });

  it("returns null when nothing was sent", () => {
    expect(readApiKey({})).toBeNull();
    expect(readApiKey({ authorization: "Basic abc" })).toBe(null);
  });
});

describe("resolveApiKey", () => {
  it("identifies the merchant behind a valid key", async () => {
    await expect(resolveApiKey({ authorization: `Bearer ${SECRET}` }, NOW)).resolves.toEqual({
      id: "k1",
      merchantId: "m1",
    });
  });

  it("records when the key was last used", async () => {
    await resolveApiKey({ authorization: `Bearer ${SECRET}` }, NOW);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.apiKeys[0].lastUsedAt).toEqual(NOW);
  });

  it("does not write again within a minute", async () => {
    const recent = new Date(NOW.getTime() - 10_000);
    seed({ key: { lastUsedAt: recent } });
    await resolveApiKey({ authorization: `Bearer ${SECRET}` }, NOW);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.apiKeys[0].lastUsedAt).toEqual(recent);
  });

  it("refuses unknown, malformed and missing keys with one message", async () => {
    const messages = new Set<string>();
    for (const headers of [
      {},
      { authorization: "Bearer nonsense" },
      { authorization: `Bearer ${generateApiKeySecret()}` },
    ]) {
      const error = await resolveApiKey(headers, NOW).catch((caught) => caught);
      expect(error).toBeInstanceOf(UnauthorizedError);
      messages.add(error.message);
    }
    expect(messages.size).toBe(1);
  });

  it("refuses a revoked key", async () => {
    seed({ key: { revokedAt: new Date("2026-11-01T00:00:00Z") } });
    await expect(resolveApiKey({ authorization: `Bearer ${SECRET}` }, NOW)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("refuses an expired key", async () => {
    seed({ key: { expiresAt: new Date("2026-11-05T00:00:00Z") } });
    await expect(resolveApiKey({ authorization: `Bearer ${SECRET}` }, NOW)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("stops working when the merchant is suspended", async () => {
    seed({ merchant: { status: "SUSPENDED" } });
    await expect(resolveApiKey({ authorization: `Bearer ${SECRET}` }, NOW)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("stops working for a merchant still under review", async () => {
    seed({ merchant: { status: "PENDING_REVIEW" } });
    await expect(resolveApiKey({ authorization: `Bearer ${SECRET}` }, NOW)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

void fakePrisma;
