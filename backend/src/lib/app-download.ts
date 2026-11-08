/**
 * Where the phone app can be downloaded. The address comes from configuration
 * (`ANDROID_APP_URL`), so it can be added after deployment without a rebuild.
 */

export interface AppDownload {
  /** False until an address is configured. */
  available: boolean;
  url: string | null;
  version: string | null;
}

/** An https address, or a path on this site such as /downloads/zevapay-sms.apk. */
export function isValidAppUrl(value: string): boolean {
  if (/\s/.test(value)) return false;
  if (value.startsWith("/")) return !value.startsWith("//") && !value.includes("..");
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.hostname.length > 0;
  } catch {
    return false;
  }
}

export function androidAppInfo(url: string | undefined, version: string | undefined): AppDownload {
  const clean = url?.trim();
  if (!clean || !isValidAppUrl(clean)) return { available: false, url: null, version: null };
  return { available: true, url: clean, version: version?.trim() || null };
}
