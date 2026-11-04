import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

/**
 * The shell every public page shares: a sticky header, the page body, and
 * the footer.
 *
 * The public site is deliberately separate from the dashboard shell — it
 * has its own navigation, its own footer and no sign-in state.
 */
export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-canvas">
      <SiteHeader />
      <main className="public-page-enter flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
