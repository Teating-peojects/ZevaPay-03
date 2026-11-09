import type { Metadata } from "next";
import {
  Bell,
  ClipboardCheck,
  Code2,
  CreditCard,
  FileClock,
  HeartHandshake,
  LayoutDashboard,
  MonitorSmartphone,
  ScanSearch,
  Users,
  Webhook,
  Wallet,
} from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { PublicLayout } from "@/components/marketing/public-layout";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Hosted checkout, automatic TrxID matching, a phone app, webhooks and a dashboard. Everything ZevaPay does.",
};

const FEATURES = [
  { icon: CreditCard, title: "Hosted checkout", body: "A payment page for each order. Send the customer to the link." },
  { icon: ScanSearch, title: "TrxID matching", body: "Provider, TrxID and amount are matched from the SMS." },
  { icon: ClipboardCheck, title: "Review queue", body: "Anything that does not match waits for you to accept or reject." },
  { icon: MonitorSmartphone, title: "Phone app", body: "An Android app on your shop phone forwards payment SMS." },
  { icon: Webhook, title: "Webhooks", body: "Signed notices to your server, retried if it is down." },
  { icon: Code2, title: "API keys", body: "Create payments and read their status from your site." },
  { icon: LayoutDashboard, title: "Dashboard", body: "Every payment, device and plan in one place." },
  { icon: Wallet, title: "Payment accounts", body: "Keep your bKash and Nagad accounts, masked, in one list." },
  { icon: Users, title: "Team", body: "Invite people and decide what each can do." },
  { icon: Bell, title: "Alerts", body: "Know when a phone goes quiet or a payment needs you." },
  { icon: HeartHandshake, title: "Support links", body: "WhatsApp, Telegram, Facebook or Instagram shown on checkout." },
  { icon: FileClock, title: "Audit log", body: "Who changed what, and when." },
];

export default function FeaturesPage() {
  return (
    <PublicLayout>
      <PageHero title="Everything for a confirmed payment." lead="From the checkout page to the order status on your site.">
        <ButtonLink href="/register" size="lg" className="w-full bg-white text-[#06196f] hover:bg-blue-50 sm:w-auto">
          Start free for 30 days
        </ButtonLink>
      </PageHero>

      <section className="zp-light-sheen border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="group rounded-2xl border border-line bg-surface p-5 transition-shadow hover:shadow-[0_18px_40px_-24px_rgba(10,60,255,0.5)]"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#0A3CFF] to-[#00B8FF] shadow-sm">
                  <Icon className="size-5 text-white" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-[15px] font-semibold text-ink">{title}</h2>
                <p className="mt-1.5 text-sm leading-snug text-ink-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="zp-hero relative overflow-hidden text-white">
        <div className="zp-grid absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Try it on your next order.</h2>
          <ButtonLink href="/register" size="lg" className="bg-white text-[#06196f] hover:bg-blue-50">
            Start free for 30 days
          </ButtonLink>
        </div>
      </section>
    </PublicLayout>
  );
}
