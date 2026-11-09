import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Bubble, StatusBadge, Window } from "@/components/marketing/visuals";

/**
 * Split layout used by the login and register pages: form on the right,
 * brand panel on the left (hidden on small screens).
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="zp-hero relative hidden overflow-hidden text-white lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:p-12 xl:w-[50%]">
        <div className="zp-grid absolute inset-0" aria-hidden="true" />
        <div className="zp-glow -right-20 top-1/4 size-80 bg-cyan-400/30" aria-hidden="true" />
        <div className="zp-glow -left-20 bottom-0 size-72 bg-blue-600/50" aria-hidden="true" />

        <div className="relative z-10">
          <Logo href="/" variant="light" />
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-bold leading-[1.1] tracking-tight">
            Your customer pays.
            <br />
            Your order confirms itself.
          </h2>

          <div className="relative mt-10">
            <Bubble className="-right-3 -top-5" delay={600}>
              <span className="size-2 rounded-full bg-emerald-500" /> order.paid sent
            </Bubble>
            <Window title="Payments">
              <div className="space-y-2.5 p-4 text-[13px]">
                {[
                  ["bKash", "9G4K2L7P", "৳3,000", "ok", "Matched"],
                  ["Nagad", "4K8P1ZRD", "৳1,250", "wait", "Waiting"],
                  ["bKash", "7T2M9QXA", "৳2,900", "review", "Review"],
                ].map(([provider, trx, amount, tone, label]) => (
                  <div key={trx} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-900/5">
                    <div>
                      <p className="font-semibold">{provider} · {amount}</p>
                      <p className="font-mono text-[11px] text-slate-500">{trx}</p>
                    </div>
                    <StatusBadge tone={tone as "ok" | "wait" | "review"}>{label}</StatusBadge>
                  </div>
                ))}
              </div>
            </Window>
          </div>
        </div>

        <p className="relative z-10 text-[13px] text-blue-200">© 2026 ZevaPay</p>
      </div>

      {/* Form panel */}
      <div className="zp-light-sheen flex flex-1 flex-col bg-surface">
        <header className="flex items-center justify-between px-6 py-6 sm:px-10 lg:justify-end">
          <div className="lg:hidden">
            <Logo href="/" />
          </div>
          <Link
            href="/"
            className="text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Back to home
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 py-8 sm:px-10">
          <div className="w-full max-w-sm">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {subtitle}
            </p>

            <div className="mt-8">{children}</div>

            {footer ? (
              <div className="mt-8 border-t border-line pt-6 text-center text-sm text-ink-muted">
                {footer}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
