/**
 * Support contacts a merchant shows to their customers: WhatsApp, Telegram, a
 * Facebook page, Instagram. Each is stored as a clean handle and turned into a
 * link here, on the server, to a fixed address for that service. A merchant
 * cannot put any other web address on the checkout page.
 */

export const SUPPORT_CHANNELS = ["whatsapp", "telegram", "facebook", "instagram"] as const;
export type SupportChannel = (typeof SUPPORT_CHANNELS)[number];

export type SupportParse = { ok: true; value: string | null } | { ok: false; reason: string };

const NAMES: Record<SupportChannel, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  facebook: "Facebook",
  instagram: "Instagram",
};

/** The first path segment of a pasted link, or the text itself if it is not a link. */
function handleFromLink(text: string, hosts: RegExp): string {
  const withoutScheme = text.replace(/^https?:\/\//i, "");
  if (hosts.test(withoutScheme)) {
    const path = withoutScheme.replace(hosts, "");
    return (path.split(/[/?#]/)[0] ?? "").trim();
  }
  return text;
}

const FACEBOOK_RESERVED = new Set([
  "profile.php", "pages", "groups", "people", "sharer", "sharer.php", "share", "watch", "events",
  "marketplace", "login", "photo", "photo.php", "permalink.php", "story.php", "home.php",
]);

/** Cleans what a merchant typed. Empty input clears the contact. */
export function parseSupport(channel: SupportChannel, raw: string | null | undefined): SupportParse {
  const input = (raw ?? "").trim();
  if (input === "") return { ok: true, value: null };
  const name = NAMES[channel];

  switch (channel) {
    case "whatsapp": {
      const fromLink = handleFromLink(input, /^(wa\.me|api\.whatsapp\.com\/send\?phone=)\/?/i);
      let digits = fromLink.replace(/[\s\-().]/g, "").replace(/^\+/, "").replace(/^00/, "");
      if (!/^\d+$/.test(digits)) return { ok: false, reason: `Enter the ${name} number with digits only, for example 01712345678.` };
      // A Bangladeshi mobile number written the local way.
      if (/^01[3-9]\d{8}$/.test(digits)) digits = `880${digits.slice(1)}`;
      if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) {
        return { ok: false, reason: `That does not look like a ${name} number. Include the country code, or use a Bangladeshi number such as 01712345678.` };
      }
      return { ok: true, value: digits };
    }
    case "telegram": {
      const handle = handleFromLink(input, /^(t\.me|telegram\.me)\//i).replace(/^@/, "");
      if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(handle)) {
        return { ok: false, reason: `Enter your ${name} username, such as @myshop (5 to 32 letters, numbers or underscores).` };
      }
      return { ok: true, value: handle };
    }
    case "instagram": {
      const handle = handleFromLink(input, /^(www\.)?instagram\.com\//i).replace(/^@/, "");
      if (!/^[A-Za-z0-9._]{1,30}$/.test(handle) || handle.includes("..")) {
        return { ok: false, reason: `Enter your ${name} username, such as @myshop.` };
      }
      return { ok: true, value: handle };
    }
    case "facebook": {
      const handle = handleFromLink(input, /^(www\.|m\.|web\.)?(facebook\.com|fb\.com|fb\.me)\//i).replace(/^@/, "");
      if (!/^[A-Za-z0-9.]{5,50}$/.test(handle) || FACEBOOK_RESERVED.has(handle.toLowerCase())) {
        return { ok: false, reason: `Enter your ${name} page name, such as myshop, or paste the page link (facebook.com/myshop).` };
      }
      return { ok: true, value: handle };
    }
  }
}

export interface StoredSupport {
  supportWhatsapp?: string | null;
  supportTelegram?: string | null;
  supportFacebook?: string | null;
  supportInstagram?: string | null;
}

export type SupportLinks = Record<SupportChannel, string | null>;

/** Ready-to-open links, or null for a contact the merchant has not set. */
export function supportLinks(stored: StoredSupport): SupportLinks {
  const link = (value: string | null | undefined, make: (v: string) => string) =>
    value ? make(encodeURIComponent(value)) : null;
  return {
    whatsapp: link(stored.supportWhatsapp, (v) => `https://wa.me/${v}`),
    telegram: link(stored.supportTelegram, (v) => `https://t.me/${v}`),
    facebook: link(stored.supportFacebook, (v) => `https://www.facebook.com/${v}`),
    instagram: link(stored.supportInstagram, (v) => `https://www.instagram.com/${v}`),
  };
}

export function supportHandles(stored: StoredSupport): Record<SupportChannel, string | null> {
  return {
    whatsapp: stored.supportWhatsapp ?? null,
    telegram: stored.supportTelegram ?? null,
    facebook: stored.supportFacebook ?? null,
    instagram: stored.supportInstagram ?? null,
  };
}
