import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The navy banner at the top of every public page: the same grid, glow and
 * speed lines as the home page, with a title and, optionally, one short line
 * and some actions.
 */
export function PageHero({
  title,
  lead,
  children,
  className,
}: {
  title: string;
  lead?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("zp-hero zp-speedlines relative overflow-hidden text-white", className)}>
      <div className="zp-grid absolute inset-0" aria-hidden="true" />
      <div className="zp-glow -right-24 -top-10 size-80 bg-cyan-400/30" aria-hidden="true" />
      <div className="zp-glow -left-24 bottom-0 size-72 bg-blue-600/50" aria-hidden="true" />
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="max-w-3xl text-3xl font-bold leading-[1.1] tracking-tight sm:text-5xl">{title}</h1>
        {lead ? <p className="mt-4 max-w-xl text-lg leading-snug text-blue-100">{lead}</p> : null}
        {children ? <div className="mt-6 flex flex-col gap-3 sm:flex-row">{children}</div> : null}
      </div>
    </section>
  );
}
