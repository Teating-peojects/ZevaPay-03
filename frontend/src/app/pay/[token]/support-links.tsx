import { MessageCircle } from "lucide-react";
import type { CheckoutView } from "@/types/api";

const LABEL = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  facebook: "Facebook",
  instagram: "Instagram",
} as const;

/** True when the merchant has set at least one way to be reached. */
export function hasSupport(support: CheckoutView["support"]): boolean {
  return Object.values(support).some(Boolean);
}

/**
 * The merchant's own contact links. The server builds each link to a fixed
 * address for that service, so these can only open WhatsApp, Telegram,
 * Facebook or Instagram.
 */
export function SupportLinks({
  support,
  merchantName,
}: {
  support: CheckoutView["support"];
  merchantName: string;
}) {
  if (!hasSupport(support)) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] font-medium text-ink">Need help? Message {merchantName}</p>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(LABEL) as (keyof typeof LABEL)[]).map((key) => {
          const href = support[key];
          if (!href) return null;
          return (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-elevated"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              {LABEL[key]}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
