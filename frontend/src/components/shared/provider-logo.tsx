import Image from "next/image";
import type { PaymentProvider } from "@/types/api";
import { getProvider } from "@/data/providers";
import { cn } from "@/lib/utils";

/** Official or source-attributed provider artwork, displayed without recoloring. */
export function ProviderLogo({
  provider,
  size = "md",
  className,
}: {
  provider: PaymentProvider;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const meta = getProvider(provider);
  const dimensions = {
    sm: { width: 38, height: 24 },
    md: { width: 46, height: 28 },
    lg: { width: 56, height: 36 },
  }[size];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-white px-1 ring-1 ring-black/5",
        className,
      )}
      style={{ width: dimensions.width, height: dimensions.height }}
      aria-hidden="true"
    >
      <Image
        src={meta.logo}
        alt=""
        width={dimensions.width - 8}
        height={dimensions.height - 6}
        unoptimized
        className="max-h-full max-w-full object-contain"
      />
    </span>
  );
}
