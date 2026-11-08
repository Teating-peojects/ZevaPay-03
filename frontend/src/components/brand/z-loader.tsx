import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The ZevaPay Z as a loading mark. The Z stays put and the three speed lines
 * run left to right, over and over. It is built from separate images of the
 * logo (public/brand/loader) placed by percentage, so it scales to any size.
 *
 * With `prefers-reduced-motion` the lines hold still. `delayed` keeps it
 * invisible for the first moments, so a page that loads quickly never shows it.
 */
const PARTS = [
  { src: "z", left: 25.335, top: 0, width: 74.665, height: 100, flow: false },
  { src: "line1", left: 14.054, top: 28.092, width: 38.432, height: 9.771, flow: true },
  { src: "line2", left: 0, top: 43.969, width: 37.667, height: 9.771, flow: true },
  { src: "line3", left: 11.759, top: 60.763, width: 22.658, height: 9.618, flow: true },
] as const;

export function ZLoader({
  className,
  delayed = false,
  label = "Loading",
}: {
  className?: string;
  delayed?: boolean;
  label?: string;
}) {
  let lineIndex = 0;
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("zp-loader relative inline-block w-24", delayed && "zp-loader-delayed", className)}
      style={{ aspectRatio: "1.5969" }}
    >
      {PARTS.map((part) => {
        const index = part.flow ? lineIndex++ : 0;
        return (
          // eslint-disable-next-line @next/next/no-img-element -- small fixed brand pieces
          <img
            key={part.src}
            src={`/brand/loader/${part.src}.png`}
            alt=""
            aria-hidden="true"
            draggable={false}
            className={cn("absolute select-none", part.flow && "zp-loader-line")}
            style={{
              left: `${part.left}%`,
              top: `${part.top}%`,
              width: `${part.width}%`,
              height: `${part.height}%`,
              animationDelay: part.flow ? `${index * 90}ms` : undefined,
            }}
          />
        );
      })}
    </span>
  );
}

/** Centred in the space it is given, for a page that is still loading. */
export function PageLoader({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-[50vh] items-center justify-center", className)}>
      <ZLoader delayed className="w-28" />
    </div>
  );
}
