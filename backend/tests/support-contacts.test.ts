import { describe, expect, it, vi } from "vitest";

vi.mock("../src/db.js", async () => ({ prisma: (await import("./helpers/fake-prisma.js")).prisma }));
vi.mock("../src/config.js", () => ({ config: { publicAppUrl: "https://pay.example.test" } }));

import { buildCheckoutView, type CheckoutRecord } from "../src/lib/checkout.js";
import { parseSupport, supportLinks } from "../src/lib/support-contacts.js";

const ok = (channel: Parameters<typeof parseSupport>[0], input: string) => {
  const r = parseSupport(channel, input);
  if (!r.ok) throw new Error(r.reason);
  return r.value;
};
const bad = (channel: Parameters<typeof parseSupport>[0], input: string) =>
  expect(parseSupport(channel, input).ok, `${channel}: ${input}`).toBe(false);

describe("WhatsApp", () => {
  it("turns a Bangladeshi number into an international one", () => {
    expect(ok("whatsapp", "01712345678")).toBe("8801712345678");
    expect(ok("whatsapp", "01712-345 678")).toBe("8801712345678");
    expect(ok("whatsapp", "+8801712345678")).toBe("8801712345678");
    expect(ok("whatsapp", "008801712345678")).toBe("8801712345678");
  });
  it("accepts another country's number and a wa.me link", () => {
    expect(ok("whatsapp", "+44 7911 123456")).toBe("447911123456");
    expect(ok("whatsapp", "https://wa.me/8801712345678")).toBe("8801712345678");
  });
  it("refuses text and short or malformed numbers", () => {
    for (const v of ["call me", "0171", "123", "01212345678", "+0123456789", "1".repeat(16), "https://evil.example/8801712345678"]) bad("whatsapp", v);
  });
});

describe("Telegram, Instagram, Facebook", () => {
  it("accept a handle, an @handle or the service's own link", () => {
    expect(ok("telegram", "@myshop_bd")).toBe("myshop_bd");
    expect(ok("telegram", "https://t.me/myshop_bd")).toBe("myshop_bd");
    expect(ok("telegram", "t.me/myshop_bd?start=1")).toBe("myshop_bd");
    expect(ok("instagram", "@my.shop")).toBe("my.shop");
    expect(ok("instagram", "https://www.instagram.com/my.shop/")).toBe("my.shop");
    expect(ok("facebook", "myshop.bd")).toBe("myshop.bd");
    expect(ok("facebook", "https://www.facebook.com/myshop.bd/")).toBe("myshop.bd");
    expect(ok("facebook", "fb.com/myshop.bd")).toBe("myshop.bd");
  });
  it("refuse links to anything else and unsafe characters", () => {
    for (const v of ["https://evil.example/myshop", "my shop", "ab", "@my-shop", "x".repeat(40), "my/shop", "javascript:alert(1)"]) bad("telegram", v);
    for (const v of ["https://evil.example/myshop", "my shop", "a".repeat(31), "bad..name", "javascript:alert(1)"]) bad("instagram", v);
    for (const v of ["https://evil.example/myshop", "my shop", "abc", "profile.php", "https://facebook.com/profile.php?id=1", "https://facebook.com/groups/123"]) bad("facebook", v);
  });
});

describe("clearing", () => {
  it("treats empty input as 'remove it'", () => {
    for (const c of ["whatsapp", "telegram", "facebook", "instagram"] as const) {
      expect(ok(c, "")).toBeNull();
      expect(ok(c, "   ")).toBeNull();
      expect(parseSupport(c, null)).toEqual({ ok: true, value: null });
    }
  });
});

describe("links", () => {
  it("point only at the named service", () => {
    expect(supportLinks({
      supportWhatsapp: "8801712345678", supportTelegram: "myshop_bd",
      supportFacebook: "myshop.bd", supportInstagram: "my.shop",
    })).toEqual({
      whatsapp: "https://wa.me/8801712345678",
      telegram: "https://t.me/myshop_bd",
      facebook: "https://www.facebook.com/myshop.bd",
      instagram: "https://www.instagram.com/my.shop",
    });
  });
  it("leave unset contacts null", () => {
    expect(supportLinks({ supportTelegram: "myshop_bd" })).toEqual({
      whatsapp: null, telegram: "https://t.me/myshop_bd", facebook: null, instagram: null,
    });
    expect(supportLinks({})).toEqual({ whatsapp: null, telegram: null, facebook: null, instagram: null });
  });
  it("encode a handle that slipped past, rather than trusting it", () => {
    expect(supportLinks({ supportTelegram: "a/../b?x=1" }).telegram).toBe("https://t.me/a%2F..%2Fb%3Fx%3D1");
  });
});

describe("checkout view", () => {
  const record = (extra: object): CheckoutRecord => ({
    id: "p1", reference: "TXN-1", status: "PENDING", amountMinor: 300000, currency: "BDT",
    description: null, expiresAt: new Date(Date.now() + 60_000), metadata: {}, merchantId: "m1",
    merchant: { businessName: "Fahmida's Fashion", status: "ACTIVE", paymentAccounts: [], ...extra },
    _count: { attempts: 0 },
  }) as unknown as CheckoutRecord;

  it("carries the merchant's links and nothing else about their contacts", () => {
    const view = buildCheckoutView(record({ supportWhatsapp: "8801712345678", supportTelegram: null }));
    expect(view.support).toEqual({ whatsapp: "https://wa.me/8801712345678", telegram: null, facebook: null, instagram: null });
    expect(JSON.stringify(view)).not.toContain("merchantId");
  });
  it("has no links when none were set", () => {
    expect(buildCheckoutView(record({})).support).toEqual({ whatsapp: null, telegram: null, facebook: null, instagram: null });
  });
});
