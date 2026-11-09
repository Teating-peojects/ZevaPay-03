"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, Search, Settings, User } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/form";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";

/**
 * Top navigation bar for dashboards: page title, breadcrumb, search, and the
 * account menu.
 */
export function TopNav({
  onMenuClick,
  user,
  variant,
}: {
  onMenuClick: () => void;
  user: { name: string; email: string };
  variant: "merchant" | "admin";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const root = variant === "admin" ? "/admin" : "/dashboard";
  const settingsHref =
    variant === "admin" ? "/admin/settings" : "/dashboard/settings";
  const searchHref =
    variant === "admin" ? "/admin/transactions" : "/dashboard/transactions";

  const [search, setSearch] = React.useState("");

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    if (!query) {
      toast({
        title: "Nothing to search for",
        description: "Type something first, then press Enter.",
        tone: "info",
      });
      return;
    }
    router.push(`${searchHref}?q=${encodeURIComponent(query)}`);
  }

  // Derive the current page title from the route segment.
  const segment = pathname.split("/").filter(Boolean).pop() ?? "";
  const title = segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const isRoot = pathname === root;

  async function handleLogout() {
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

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 zp-topbar border-b border-line px-4 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-elevated lg:hidden"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      {/* Page title + breadcrumb */}
      <div className="min-w-0 flex-1">
        <nav aria-label="Breadcrumb" className="hidden sm:block">
          <ol className="flex items-center gap-1.5 text-[12px] text-ink-muted">
            <li>
              <Link
                href={root}
                className="transition-colors hover:text-ink"
              >
                {variant === "admin" ? "Admin" : "Dashboard"}
              </Link>
            </li>
            {!isRoot ? (
              <>
                <li aria-hidden="true" className="text-ink-faint">
                  /
                </li>
                <li className="font-medium text-ink-soft">{title}</li>
              </>
            ) : null}
          </ol>
        </nav>
        <p className="truncate text-[15px] font-semibold text-ink sm:mt-0.5">
          {isRoot ? (variant === "admin" ? "Platform Overview" : "Overview") : title}
        </p>
      </div>

      {/* Search */}
      <form
        onSubmit={handleSearchSubmit}
        className="relative hidden max-w-xs flex-1 md:block"
        role="search"
      >
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search transactions…"
          aria-label="Search transactions"
          className="h-9 pl-9"
        />
      </form>

      <div className="flex shrink-0 items-center gap-1.5">
        <ThemeToggle />

        {/* Profile menu */}
        <Dropdown
          align="right"
          triggerClassName="rounded-lg p-1 pr-1.5 hover:bg-elevated"
          trigger={
            <>
              <Avatar name={user.name} size="sm" />
              <span className="hidden text-sm font-medium text-ink lg:block">
                {user.name}
              </span>
            </>
          }
          items={[
            {
              label: user.email,
              disabled: true,
              icon: User,
            },
            {
              label: "Account settings",
              icon: Settings,
              onSelect: () => router.push(settingsHref),
            },
            {
              label: "Log out",
              icon: LogOut,
              variant: "danger",
              onSelect: () => void handleLogout(),
            },
          ]}
        />
      </div>
    </header>
  );
}
