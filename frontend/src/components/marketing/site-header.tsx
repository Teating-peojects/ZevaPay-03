"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/features" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Security", href: "/#security" },
  { label: "FAQ", href: "/#faq" },
];

export function SiteHeader() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const [activeHref, setActiveHref] = React.useState("/");
  const desktopNavRef = React.useRef<HTMLElement>(null);
  const linkRefs = React.useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicator, setIndicator] = React.useState({ x: 0, width: 0 });

  React.useEffect(() => {
    const updateActive = () => {
      const hash = window.location.hash;
      const hashLink = navLinks.find((link) => link.href === `/${hash}`);
      const pathLink = navLinks.find((link) => link.href === pathname);
      setActiveHref(hashLink?.href ?? pathLink?.href ?? (pathname === "/" ? "/" : ""));
    };

    updateActive();
    window.addEventListener("hashchange", updateActive);
    return () => window.removeEventListener("hashchange", updateActive);
  }, [pathname]);

  React.useLayoutEffect(() => {
    const activeLink = linkRefs.current[activeHref];
    const nav = desktopNavRef.current;
    if (!activeLink || !nav) {
      setIndicator((value) => ({ ...value, width: 0 }));
      return;
    }

    setIndicator({ x: activeLink.offsetLeft, width: activeLink.offsetWidth });
  }, [activeHref, pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo href="/" />

        <nav ref={desktopNavRef} className="relative hidden h-full items-center gap-6 lg:flex" aria-label="Main">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              ref={(node) => { linkRefs.current[link.href] = node; }}
              onClick={() => setActiveHref(link.href)}
              aria-current={activeHref === link.href ? "page" : undefined}
              className={`relative inline-flex h-full items-center text-sm font-medium transition-colors hover:text-ink ${activeHref === link.href ? "text-ink" : "text-ink-soft"}`}
            >
              {link.label}
            </Link>
          ))}
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-0 h-0.5 rounded-full bg-brand-solid transition-[width,transform,opacity] duration-300 ease-out"
            style={{ width: indicator.width, transform: `translateX(${indicator.x}px)`, opacity: indicator.width ? 1 : 0 }}
          />
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          <Link href="/login">
            <Button variant="ghost" size="md">
              Login
            </Button>
          </Link>
          <Link href="/register">
            <Button size="md">Get started</Button>
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="inline-flex size-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-elevated lg:hidden"
        >
          {open ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Menu className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {open ? (
        <div className="public-menu-enter border-t border-line bg-surface lg:hidden">
          <nav
            className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 sm:px-6"
            aria-label="Mobile"
          >
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-elevated hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-line pt-4">
              <ThemeToggle className="self-start" />
              <Link href="/login" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full">
                  Login
                </Button>
              </Link>
              <Link href="/register" onClick={() => setOpen(false)}>
                <Button className="w-full">Get started</Button>
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
