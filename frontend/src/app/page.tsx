import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Code2,
  FileText,
  LayoutDashboard,
  Link2,
  Lock,
  MonitorSmartphone,
  Receipt,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Faq } from "@/components/marketing/faq";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PROVIDER_LIST } from "@/data/providers";
import { ProviderLogo } from "@/components/shared/provider-logo";

export const metadata: Metadata = {
  title: "ZevaPay — Simple Payment Management",
  description:
    "Connect your bKash, Nagad, Rocket, and Upay accounts, pair an Android device, and keep every payment notification in one clear dashboard.",
};

const features = [
  {
    icon: Wallet,
    title: "Payment Management",
    description:
      "Keep every bKash, Nagad, Rocket, and Upay account in one list. See the masked number, account type, and status of each without hunting through separate apps.",
  },
  {
    icon: Receipt,
    title: "Transaction Tracking",
    description:
      "Search recorded payments by transaction ID, customer, or account. Filter by status, provider, and date to find the one record you actually need.",
  },
  {
    icon: MonitorSmartphone,
    title: "Device Connection",
    description:
      "Pair an Android SMS Bridge device with your merchant and watch its connection status from the dashboard. Disconnect a device whenever you need to.",
  },
  {
    icon: LayoutDashboard,
    title: "Merchant Dashboard",
    description:
      "A simple overview of totals, successful payments, pending items, and connected devices — clear enough for a shop owner to read at a glance.",
  },
  {
    icon: Code2,
    title: "Secure API Integration",
    description:
      "Issue scoped API keys from your settings and read your transaction history programmatically, from your own reporting scripts or systems.",
  },
  {
    icon: Link2,
    title: "Payment Links and Invoices",
    description:
      "Create a link or an invoice for a fixed amount, share it as a link or a QR code, and watch it move from sent to paid.",
  },
];

const steps = [
  {
    title: "Connect Payment Account",
    description:
      "Add the bKash, Nagad, Rocket, or Upay account you receive payments into, along with a label so you can tell your accounts apart.",
  },
  {
    title: "Connect Android Device",
    description:
      "Install the ZevaPay Android app on a phone or tablet at your counter and pair it using the pairing code shown in your dashboard.",
  },
  {
    title: "Receive Payment Notifications",
    description:
      "When a customer pays you, the app reads the provider's notification and records the details of that transaction.",
  },
  {
    title: "Process Transaction Information",
    description:
      "Open the dashboard to review the amount, customer, provider, and status of each record, then export or filter them for your records.",
  },
];

const security = [
  {
    icon: Lock,
    title: "No PIN, no OTP, no money movement",
    body: "ZevaPay reads the notification your provider already sends to your phone. It never asks for your PIN, never handles your OTP, and never moves your money.",
  },
  {
    icon: ShieldCheck,
    title: "Masked by default",
    body: "Account numbers are masked in the API response itself, so a full number is never sent to a browser. API keys show their value once and are masked afterwards.",
  },
  {
    icon: FileText,
    title: "Clear about what a record means",
    body: "A record parsed from a notification is a claim from the message, not a settlement confirmation. ZevaPay labels it as confirmed from SMS, never as provider-verified.",
  },
  {
    icon: Bell,
    title: "You decide what reaches you",
    body: "Choose which events notify you and where — email, dashboard, SMS, Telegram, Discord, Slack, or a webhook to your own endpoint.",
  },
];

const faqItems = [
  {
    question: "Does ZevaPay hold or move my money?",
    answer:
      "No. ZevaPay records payment notifications that your provider already sends to your phone. The money stays in your own bKash, Nagad, Rocket, or Upay account, exactly as it would without ZevaPay. ZevaPay is a record-keeping and automation tool, not a payment service.",
  },
  {
    question: "What does my Android device do?",
    answer:
      "It runs the ZevaPay SMS Bridge app, which reads payment notifications from your provider and sends them to your dashboard. The device stays at your counter or shop. You can disconnect it at any time, and you can run more than one.",
  },
  {
    question: "Is a recorded payment actually settled?",
    answer:
      "Not always, and ZevaPay does not pretend otherwise. When a notification is parsed successfully the record is labelled as confirmed from SMS — the message matched, but it was not checked against the provider's own system. Records that do not match cleanly are held for your review instead of being counted as paid.",
  },
  {
    question: "Do you need my bank or provider password?",
    answer:
      "No. ZevaPay never asks for a provider password, a PIN, or a one-time passcode. It only reads the notification that arrives on the device you paired.",
  },
  {
    question: "Can I use the API from my own website?",
    answer:
      "Yes. Issue a scoped API key from your developer page and read your transaction history from your own storefront or reporting scripts. Every key can be revoked on its own.",
  },
  {
    question: "Is ZevaPay approved by the Bangladesh Bank?",
    answer:
      "ZevaPay is a software tool for merchants. It is not a payment service provider, and it does not hold, transmit, or settle funds. Providers set their own fees and terms for the accounts you connect.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col bg-canvas">
      <SiteHeader />

      <main className="public-page-enter flex-1">
        {/* Hero */}
        <section className="border-b border-line bg-elevated">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="max-w-3xl">
              <Badge tone="brand">Simple Payment Management</Badge>

              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl sm:leading-[1.15]">
                Manage Your Payments. Simply.
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
                ZevaPay connects your mobile financial services accounts to an
                Android device, then records every payment notification so you
                can see what came in, when it arrived, and which account it
                belongs to.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href="/register">
                  <Button size="lg" className="w-full sm:w-auto">
                    Get started
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    Sign in
                  </Button>
                </Link>
              </div>

              <p className="mt-6 text-sm text-ink-muted">
                ZevaPay reads the notifications your provider already sends. It
                never asks for your PIN or OTP, and never moves your money.
              </p>
            </div>

            {/* Product preview */}
            <div className="mt-16 rounded-xl border border-line bg-surface p-1.5 shadow-overlay">
              <div className="overflow-hidden rounded-lg border border-line bg-elevated">
                <div className="flex items-center gap-1.5 border-b border-line bg-surface px-4 py-3">
                  <span className="size-2.5 rounded-full bg-line-strong" />
                  <span className="size-2.5 rounded-full bg-line-strong" />
                  <span className="size-2.5 rounded-full bg-line-strong" />
                  <span className="ml-3 text-[12px] font-medium text-ink-faint">
                    app.zevapay.com/dashboard/transactions
                  </span>
                </div>

                <div className="mx-4 my-4 overflow-hidden rounded-lg border border-line bg-surface">
                  {[
                    {
                      ref: "TXN-100245",
                      method: "bKash",
                      amount: "৳2,450",
                      status: "Confirmed from SMS",
                    },
                    {
                      ref: "TXN-100244",
                      method: "Nagad",
                      amount: "৳890",
                      status: "Awaiting verification",
                    },
                    {
                      ref: "TXN-100243",
                      method: "bKash",
                      amount: "৳12,750",
                      status: "Needs review",
                    },
                    {
                      ref: "TXN-100242",
                      method: "Rocket",
                      amount: "৳560",
                      status: "Verification failed",
                    },
                  ].map((row) => (
                    <div
                      key={row.ref}
                      className="flex items-center gap-4 border-b border-line px-4 py-2.5 last:border-b-0"
                    >
                      <span className="font-mono text-[12px] text-ink-muted">
                        {row.ref}
                      </span>
                      <span className="text-[12px] text-ink-muted">
                        {row.method}
                      </span>
                      <span className="ml-auto text-[13px] font-medium text-ink">
                        {row.amount}
                      </span>
                      <span className="text-[12px] text-ink-muted">
                        {row.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 border-b border-line">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Built around the six things you actually do.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-ink-soft">
                ZevaPay is deliberately focused. Each screen answers one clear
                question so you can move quickly without training.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="rounded-xl border border-line bg-surface p-6"
                  >
                    <span className="flex size-10 items-center justify-center rounded-lg bg-brand-tint">
                      <Icon
                        className="size-5 text-brand-link"
                        aria-hidden="true"
                      />
                    </span>
                    <h3 className="mt-4 text-[15px] font-semibold text-ink">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-10">
              <Link
                href="/features"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-link transition-colors hover:text-brand-link-hover"
              >
                See every feature
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="scroll-mt-20 border-b border-line bg-elevated"
        >
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Four steps from signup to a clear record.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-ink-soft">
                No implementation project and no sales call required to start.
              </p>
            </div>

            <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((item, index) => (
                <li
                  key={item.title}
                  className="flex flex-col rounded-xl border border-line bg-surface p-6"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-brand-tint text-[13px] font-semibold text-brand-link">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-[15px] font-semibold text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    {item.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Supported methods */}
        <section
          id="supported"
          className="scroll-mt-20 border-b border-line"
        >
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Works with the methods you already use.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-ink-soft">
                ZevaPay reads the payment notifications your provider sends to
                your phone. No PIN, no OTP, and no direct login to your provider
                account is ever requested.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PROVIDER_LIST.map((provider) => (
                <div
                  key={provider.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface px-5 py-5"
                >
                  <ProviderLogo provider={provider.id} size="lg" />
                  <span className="text-[15px] font-semibold text-ink">
                    {provider.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Security */}
        <section
          id="security"
          className="scroll-mt-20 border-b border-line bg-elevated"
        >
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Honest about what it can and cannot do.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-ink-soft">
                A payment tool should tell you plainly what it does with your
                money and your credentials. Here is exactly that.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {security.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex gap-4 rounded-xl border border-line bg-surface p-6"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
                      <Icon
                        className="size-5 text-accent-fg"
                        aria-hidden="true"
                      />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold text-ink">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                        {item.body}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 border-b border-line bg-elevated">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Questions worth answering plainly.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-ink-soft">
                The ones merchants ask first, answered without hedging.
              </p>
            </div>

            <Faq items={faqItems} className="mt-10 max-w-3xl" />
          </div>
        </section>

        {/* CTA */}
        <section>
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <div className="rounded-xl border border-line bg-brand-solid px-6 py-14 text-center sm:px-14">
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Start managing your payments today.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-brand-100">
                Create a ZevaPay account, connect your payment account and
                Android device, and see every notification in one place.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/register">
                  <Button
                    size="lg"
                    className="w-full bg-surface text-brand-link hover:bg-brand-tint sm:w-auto"
                  >
                    Get started
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full border-white/40 bg-transparent text-white hover:bg-white/10 sm:w-auto"
                  >
                    Login
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
