import { describe, expect, it } from "vitest";
import { androidAppInfo, isValidAppUrl } from "../src/lib/app-download.js";

describe("app download address", () => {
  it("is unavailable until one is set", () => {
    for (const v of [undefined, "", "   "]) {
      expect(androidAppInfo(v, "1.0")).toEqual({ available: false, url: null, version: null });
    }
  });

  it("accepts an https address or a path on this site", () => {
    expect(androidAppInfo("https://files.example.com/zevapay-sms.apk", "0.1.0")).toEqual({
      available: true, url: "https://files.example.com/zevapay-sms.apk", version: "0.1.0",
    });
    expect(androidAppInfo("/downloads/zevapay-sms.apk", undefined)).toEqual({
      available: true, url: "/downloads/zevapay-sms.apk", version: null,
    });
  });

  it("refuses anything that could send a merchant somewhere unexpected", () => {
    for (const v of [
      "http://files.example.com/a.apk", "javascript:alert(1)", "//evil.example/a.apk", "/../etc/passwd",
      "https://user:pw@files.example.com/a.apk", "ftp://x.example/a.apk", "downloads/a.apk", "https://a.example/a b.apk", "data:text/html,hi",
    ]) {
      expect(isValidAppUrl(v), v).toBe(false);
      expect(androidAppInfo(v, "1").available, v).toBe(false);
    }
  });
});
