import type { UserRole } from "@/types/api";

/** Roles that belong to the platform rather than to a merchant. */
export const PLATFORM_ROLES: readonly UserRole[] = ["SUPER_ADMIN", "ADMIN", "SUPPORT"];

export function isPlatformRole(role: UserRole): boolean {
  return PLATFORM_ROLES.includes(role);
}

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Platform admin",
  SUPPORT: "Platform support",
  MERCHANT_OWNER: "Owner",
  MERCHANT_ADMIN: "Admin",
  MERCHANT_MANAGER: "Manager",
  MERCHANT_SUPPORT: "Support",
  MERCHANT_VIEWER: "Viewer",
};

/** The roles a merchant can give a new team member. */
export const MEMBER_ROLES: { value: UserRole; label: string; description: string }[] = [
  {
    value: "MERCHANT_ADMIN",
    label: "Admin",
    description: "Manages the team, accounts, devices and payments.",
  },
  {
    value: "MERCHANT_MANAGER",
    label: "Manager",
    description: "Works with payments, customers and transactions.",
  },
  {
    value: "MERCHANT_VIEWER",
    label: "Viewer",
    description: "Can read records but not change them.",
  },
];
