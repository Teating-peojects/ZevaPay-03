import type { NavIconName } from "@/components/dashboard/nav-icons";

export interface NavItem {
  label: string;
  href: string;
  icon: NavIconName;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

/** Sidebar navigation for the merchant dashboard. */
export const merchantNav: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Overview", href: "/dashboard", icon: "dashboard" },
      { label: "Payments", href: "/dashboard/payments", icon: "payments" },
      { label: "Transactions", href: "/dashboard/transactions", icon: "transactions" },
      { label: "Customers", href: "/dashboard/customers", icon: "customers" },
    ],
  },
  {
    title: "Collection",
    items: [
      { label: "Payment Accounts", href: "/dashboard/accounts", icon: "paymentAccounts" },
      { label: "Devices", href: "/dashboard/devices", icon: "devices" },
      { label: "Phone app", href: "/dashboard/app", icon: "phoneApp" },
    ],
  },
  {
    title: "Developers",
    items: [{ label: "API Keys", href: "/dashboard/developers", icon: "api" }],
  },
  {
    title: "General",
    items: [
      { label: "Plan", href: "/dashboard/billing", icon: "billing" },
      { label: "Team", href: "/dashboard/team", icon: "team" },
      { label: "Settings", href: "/dashboard/settings", icon: "settings" },
      { label: "Security", href: "/dashboard/security", icon: "security" },
      { label: "Audit Logs", href: "/dashboard/audit-logs", icon: "auditLogs" },
      { label: "Help & Support", href: "/dashboard/support", icon: "support" },
    ],
  },
];

/**
 * Sidebar navigation for the admin console. A separate tree from the
 * merchant's on purpose: an administrator should not have to know a
 * merchant's vocabulary to do their job.
 */
export const adminNav: NavSection[] = [
  {
    title: "Overview",
    items: [{ label: "Overview", href: "/admin", icon: "dashboard" }],
  },
  {
    title: "Operations",
    items: [
      { label: "Merchants", href: "/admin/merchants", icon: "merchants" },
      { label: "Users", href: "/admin/users", icon: "users" },
      { label: "Payment Reviews", href: "/admin/reviews", icon: "review" },
      { label: "Transactions", href: "/admin/transactions", icon: "transactions" },
      { label: "Devices", href: "/admin/devices", icon: "devices" },
    ],
  },
  {
    title: "Management",
    items: [
      { label: "Audit Logs", href: "/admin/audit-logs", icon: "auditLogs" },
      { label: "Settings", href: "/admin/settings", icon: "settings" },
    ],
  },
];
