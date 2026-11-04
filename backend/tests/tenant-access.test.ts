import { describe, expect, it } from "vitest";
import { canAccessMerchant } from "../src/lib/tenant-access.js";

describe("merchant tenant authorization", () => {
  it("limits merchant users to the tenant linked to their session", () => {
    expect(canAccessMerchant("MERCHANT_OWNER", "merchant-a", "merchant-a")).toBe(true);
    expect(canAccessMerchant("MERCHANT_OWNER", "merchant-a", "merchant-b")).toBe(false);
    expect(canAccessMerchant("MERCHANT_VIEWER", null, "merchant-a")).toBe(false);
  });

  it("requires a target merchant for platform staff", () => {
    expect(canAccessMerchant("SUPER_ADMIN", null, "merchant-b")).toBe(true);
  });
});
