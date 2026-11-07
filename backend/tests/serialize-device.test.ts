import { describe, expect, it } from "vitest";
import { serializeDevice } from "../src/lib/serializers.js";

const base = {
  id: "d1", merchantId: "m1", name: "Counter", deviceId: "ZP-SMS-1", status: "ONLINE" as const,
  lastActiveAt: new Date(), connectedAt: new Date(), connectedAccountId: null, androidVersion: null,
};

describe("serializeDevice", () => {
  it("flags a device with no token as needing to pair again", () => {
    expect(serializeDevice({ ...base, tokenHash: null }).needsPairing).toBe(true);
  });

  it("does not flag a paired device, and never exposes the hash", () => {
    const dto = serializeDevice({ ...base, tokenHash: "abc123hash" });
    expect(dto.needsPairing).toBe(false);
    expect(JSON.stringify(dto)).not.toContain("abc123hash");
    expect(dto).not.toHaveProperty("tokenHash");
  });
});
