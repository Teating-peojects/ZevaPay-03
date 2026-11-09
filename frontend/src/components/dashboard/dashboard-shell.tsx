"use client";

import * as React from "react";
import { Sidebar, type NavSection } from "@/components/dashboard/sidebar";
import { TopNav } from "@/components/dashboard/top-nav";

export interface DashboardUser {
  name: string;
  email: string;
  organization: string;
}

/**
 * Shared dashboard shell. Renders a fixed sidebar on large screens and an
 * off-canvas drawer on small screens, with a sticky top navigation bar.
 *
 * The desktop sidebar can collapse to an icon rail; the sidebar owns that
 * state and remembers it between visits.
 */
export function DashboardShell({
  sections,
  variant,
  user,
  workspaceName,
  children,
}: {
  sections: NavSection[];
  variant: "merchant" | "admin";
  user: DashboardUser;
  workspaceName: string;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // Close the drawer when the viewport grows past the mobile breakpoint.
  React.useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileNavOpen(false);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // Escape closes the drawer, as it does for every other overlay.
  React.useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileNavOpen]);

  // Lock body scroll while the drawer is open.
  React.useEffect(() => {
    if (!mobileNavOpen) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [mobileNavOpen]);

  return (
    <div className="zp-app-bg flex min-h-full">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <div className="sticky top-0 hidden h-screen lg:block">
        <Sidebar
          sections={sections}
          variant={variant}
          user={user}
          workspaceName={workspaceName}
        />
      </div>

      {/* Mobile drawer */}
      {mobileNavOpen ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div
            className="absolute inset-0 bg-overlay"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <Sidebar
            mobile
            open={mobileNavOpen}
            onNavigate={() => setMobileNavOpen(false)}
            sections={sections}
            variant={variant}
            user={user}
            workspaceName={workspaceName}
          />
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav
          onMenuClick={() => setMobileNavOpen(true)}
          user={user}
          variant={variant}
        />

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 py-5 focus:outline-none sm:px-6 sm:py-6"
        >
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
