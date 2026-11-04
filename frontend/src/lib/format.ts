/** Formatting helpers shared across the ZevaPay frontend. */

const bdtFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "BDT",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-US");

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Formats an amount in Bangladeshi Taka, e.g. "৳2,450". */
export function formatBDT(value: number): string {
  return bdtFormatter.format(value).replace("BDT", "৳");
}

/** Compact currency for stat cards, e.g. "৳1.2M". */
export function formatCompactBDT(value: number): string {
  if (Math.abs(value) < 1000) return formatBDT(value);
  if (Math.abs(value) < 1_000_000) {
    return `৳${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`;
  }
  return `৳${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

/** Formats an ISO timestamp as "Nov 2, 2026". */
export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/** Formats an ISO timestamp as "Nov 2, 2026, 5:41 PM". */
export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

/** Formats an ISO timestamp as "Nov 2, 5:41 PM" for compact tables. */
export function formatDateTimeShort(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Relative time from now, e.g. "4 min ago". */
export function formatRelativeTime(
  iso: string,
  now: number = Date.now(),
): string {
  const diffMs = now - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

/**
 * Masks a phone/account number for display, keeping the last four digits.
 * e.g. "01712345678" -> "•••••••5678"
 */
export function maskNumber(value: string): string {
  const visible = value.slice(-4);
  const hidden = "•".repeat(Math.max(value.length - 4, 0));
  return `${hidden}${visible}`;
}

/** Masks an API key, keeping the first four and last four characters. */
export function maskApiKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 4)}${"•".repeat(16)}${key.slice(-4)}`;
}
