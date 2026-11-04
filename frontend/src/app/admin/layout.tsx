import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { adminNav } from "@/lib/nav-config";
import { isPlatformRole } from "@/lib/roles";
import { getSession } from "@/lib/server-api";

/**
 * The console reads the session cookie on every request, so it cannot be
 * prerendered.
 */
export const instant = false;

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) redirect("/login");

  // Only platform administrators may open the admin console.
  if (!isPlatformRole(session.user.role)) redirect("/dashboard");

  return (
    <DashboardShell
      variant="admin"
      sections={adminNav}
      workspaceName="ZevaPay Platform"
      user={{
        name: session.user.fullName,
        email: session.user.email,
        organization: "ZevaPay Platform",
      }}
    >
      {children}
    </DashboardShell>
  );
}
