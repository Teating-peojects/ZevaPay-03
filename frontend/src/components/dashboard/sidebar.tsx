"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { navIcons } from "@/components/dashboard/nav-icons";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import type { NavSection } from "@/lib/nav-config";
import {
  readStored,
  subscribeToStored,
  writeStored,
} from "@/lib/stored-state";
import { cn } from "@/lib/utils";

export type { NavItem, NavSection } from "@/lib/nav-config";

/** Where the collapsed state of the desktop rail is remembered. */
const STORAGE_KEY = "zp-sidebar-collapsed";

export interface SidebarUser {
  name: string;
  email: string;
  /** Merchant or organization name shown under the avatar. */
  organization: string;
}

/**
 * Responsive dashboard sidebar.
 *
 * On large screens it can be collapsed to a narrow icon rail, which is
 * remembered in `localStorage`. On small screens it becomes an off-canvas
 * drawer controlled by the parent shell.
 */
/** Subscribes to changes of the stored collapsed state. */
function subscribeCollapsed(listener: () => void): () => void {
  return subscribeToStored(STORAGE_KEY, listener);
}

/** Whether the rail is collapsed right now. */
function getCollapsedSnapshot(): boolean {
  return readStored(STORAGE_KEY, "0") === "1";
}

/** The rail starts expanded on the server render. */
function getCollapsedServerSnapshot(): boolean {
  return false;
}

export function Sidebar({
  sections,
  variant,
  user,
  workspaceName,
  onNavigate,
  onCollapseChange,
  mobile = false,
  open = false,
}: {
  sections: NavSection[];
  variant: "merchant" | "admin";
  user: SidebarUser;
  workspaceName: string;
  onNavigate?: () => void;
  /** Lets the shell widen the content column when the rail collapses. */
  onCollapseChange?: (collapsed: boolean) => void;
  mobile?: boolean;
  open?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const root = variant === "admin" ? "/admin" : "/dashboard";

  // The collapsed state lives in localStorage, so it is read through an
  // external store rather than copied into state inside an effect.
  const collapsed = React.useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot,
  );

  function toggleCollapsed() {
    const next = !collapsed;
    writeStored(STORAGE_KEY, next ? "1" : "0");
    onCollapseChange?.(next);
  }

  function isActive(href: string) {
    if (href === root) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function handleLogout() {
    setMenuOpen(false);
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // The session cookie is cleared by the API. A failed request still
      // means the user should land on the sign-in page.
    }
    toast({
      title: "Signed out",
      description: "Your session has ended.",
      tone: "info",
    });
    router.push("/login");
    router.refresh();
  }

  const showLabels = mobile || !collapsed;

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r border-line bg-surface transition-[width] duration-200",
        mobile
          ? cn(
              "fixed inset-y-0 left-0 z-50 w-72 transition-transform duration-200",
              open ? "translate-x-0" : "-translate-x-full",
            )
          : cn("shrink-0", collapsed ? "w-[68px]" : "w-64"),
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-line px-4",
          showLabels ? "justify-between" : "justify-center",
        )}
      >
        {showLabels ? (
          <Logo href="/" showTagline={!mobile} />
        ) : (
          <Logo href="/" />
        )}

        {mobile ? (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Close navigation"
            className="inline-flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-pressed={collapsed}
            className="inline-flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Workspace */}
      {showLabels ? (
        <div className="border-b border-line px-3 py-3">
          <div
            className={cn(
              "rounded-lg px-3 py-2",
              variant === "admin" ? "bg-brand-solid" : "bg-sunken",
            )}
          >
            <p
              className={cn(
                "text-[11px] font-medium tracking-wide uppercase",
                variant === "admin" ? "text-on-brand-muted" : "text-ink-muted",
              )}
            >
              {variant === "admin" ? "Admin console" : "Merchant"}
            </p>
            <p
              className={cn(
                "mt-0.5 truncate text-sm font-semibold",
                variant === "admin" ? "text-white" : "text-ink",
              )}
            >
              {workspaceName}
            </p>
          </div>
        </div>
      ) : null}

      {/* Navigation */}
      <nav
        className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin"
        aria-label="Dashboard navigation"
      >
        {sections.map((section, sectionIndex) => (
          <div key={section.title ?? sectionIndex} className="mb-6 last:mb-0">
            {section.title && showLabels ? (
              <p className="mb-2 px-3 text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
                {section.title}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                const Icon = navIcons[item.icon];

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      title={showLabels ? undefined : item.label}
                      className={cn(
                        "flex items-center rounded-lg py-2 text-sm font-medium transition-colors",
                        showLabels ? "gap-2.5 px-3" : "justify-center px-0",
                        active
                          ? "bg-brand-tint text-brand-ink"
                          : "text-ink-soft hover:bg-elevated hover:text-ink",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-brand-link" : "text-ink-muted",
                        )}
                        aria-hidden="true"
                      />
                      {showLabels ? (
                        <span className="truncate">{item.label}</span>
                      ) : (
                        <span className="sr-only">{item.label}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-line p-3">
        <div className="relative">
          {menuOpen ? (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute bottom-full left-0 z-20 mb-2 w-full overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-overlay">
                <div className="border-b border-line px-2.5 py-2">
                  <p className="truncate text-[13px] font-semibold text-ink">
                    {user.name}
                  </p>
                  <p className="truncate text-[12px] text-ink-muted">
                    {user.email}
                  </p>
                </div>
                <Link
                  href={
                    variant === "admin"
                      ? "/admin/settings"
                      : "/dashboard/settings"
                  }
                  onClick={() => {
                    setMenuOpen(false);
                    onNavigate?.();
                  }}
                  className="block rounded-md px-2.5 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:bg-elevated"
                >
                  Account settings
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-danger-fg transition-colors hover:bg-danger-tint"
                >
                  <LogOut className="size-3.5" aria-hidden="true" />
                  Logout
                </button>
              </div>
            </>
          ) : null}

          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className={cn(
              "flex w-full items-center rounded-lg py-2 text-left transition-colors hover:bg-elevated",
              showLabels ? "gap-2.5 px-2" : "justify-center px-0",
            )}
          >
            <Avatar name={user.name} size="sm" />
            {showLabels ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink">
                    {user.name}
                  </p>
                  <p className="truncate text-[12px] text-ink-muted">
                    {user.organization}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "size-3.5 shrink-0 text-ink-faint transition-transform",
                    menuOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </>
            ) : null}
          </button>
        </div>
      </div>
    </div>
  );
}
