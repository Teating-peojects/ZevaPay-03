"use client";

import {
  Bell,
  Building2,
  Code2,
  CreditCard,
  FileText,
  Flag,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  ListChecks,
  MonitorSmartphone,
  Receipt,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Users,
  Wallet,
  Webhook,
} from "lucide-react";

/**
 * Icon registry for dashboard navigation. Nav configuration is authored as
 * plain data (icon names) so it can cross the server/client boundary safely.
 */
export const navIcons = {
  dashboard: LayoutDashboard,
  paymentAccounts: CreditCard,
  devices: MonitorSmartphone,
  transactions: Receipt,
  settings: Settings,
  users: Users,

  /* Merchant — collection */
  payments: Wallet,
  customers: Users,
  paymentLinks: Link2,
  invoices: FileText,
  brands: Store,

  /* Merchant — automation */
  checkout: SlidersHorizontal,
  api: Code2,
  webhooks: Webhook,
  sandbox: FlaskConical,

  /* Merchant — business */
  reports: ListChecks,
  notifications: Bell,
  team: Users,
  billing: Receipt,

  /* Merchant — general */
  security: ShieldCheck,
  support: LifeBuoy,

  /* Admin */
  merchants: Building2,
  review: ListChecks,
  providers: Shield,
  apiLogs: Code2,
  plans: Flag,
  staff: Users,
  auditLogs: ListChecks,
  health: HeartPulse,
  featureFlags: Flag,
} as const;

export type NavIconName = keyof typeof navIcons;
