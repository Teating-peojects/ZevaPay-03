import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { merchantNav } from "@/lib/nav-config";
import { isPlatformRole } from "@/lib/roles";
import { getSession } from "@/lib/server-api";

/**
 * The dashboard reads the session cookie on every request, so it cannot be
 * prerendered.
 */
export const instant = false;

export default async function MerchantDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) redirect("/login");

  // Platform administrators have their own console; send them there.
  if (isPlatformRole(session.user.role)) redirect("/admin");

  const merchantName =
    session.merchant?.businessName ?? session.user.merchantName ?? "Your business";

  return (
    <DashboardShell
      variant="merchant"
      sections={merchantNav}
      workspaceName={merchantName}
      user={{
        name: session.user.fullName,
        email: session.user.email,
        organization: merchantName,
      }}
    >
      {children}
    </DashboardShell>
  );
}
