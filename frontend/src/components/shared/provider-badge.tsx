import { getProvider } from "@/data/providers";
import type { PaymentProvider } from "@/types/api";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { cn } from "@/lib/utils";

/**
 * Compact provider identifier using the provider's original logo artwork.
 */
export function ProviderBadge({
  provider,
  size = "md",
  className,
}: {
  provider: PaymentProvider;
  size?: "sm" | "md";
  className?: string;
}) {
  const meta = getProvider(provider);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md font-medium whitespace-nowrap",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs",
        className,
      )}
      style={{ backgroundColor: meta.tint, color: meta.textColor }}
    >
      <ProviderLogo provider={provider} size={size} />
      {meta.name}
    </span>
  );
}
