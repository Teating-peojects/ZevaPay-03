import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";

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
      <div className="hidden bg-brand-solid lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:p-12 xl:w-[50%]">
        <div>
          <Logo href="/" variant="light" />
        </div>

        <div className="max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight text-white">
            Manage Your Payments. Simply.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-brand-100">
            ZevaPay brings payment accounts, devices, and transactions into a
            single workspace, so your team always knows what has been paid and
            what still needs attention.
          </p>

          <ul className="mt-10 space-y-3 border-t border-brand-solid pt-8">
            {[
              "Connect bKash, Nagad, Rocket, and Upay accounts.",
              "Pair an Android SMS Bridge device.",
              "Review every recorded payment notification.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[15px] text-brand-100">
                <span
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-300"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[13px] text-brand-200">
          © 2026 ZevaPay. All rights reserved.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col bg-surface">
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
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
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
