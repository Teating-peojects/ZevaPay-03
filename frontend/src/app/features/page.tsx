import type { Metadata } from "next";
import {
  Bell,
  Code2,
  CreditCard,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Link2,
  MonitorSmartphone,
  Receipt,
  ShieldCheck,
  Store,
  Users,
  Webhook,
} from "lucide-react";
import { PublicLayout } from "@/components/marketing/public-layout";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Everything ZevaPay does: payment accounts, devices, transaction review, payment links, invoices, reports, webhooks, and a developer API.",
};

const GROUPS = [
  {
    title: "Collection",
    summary:
      "Every way a customer can pay you, and one place to see what came in.",
    items: [
      {
        icon: CreditCard,
        title: "Payment accounts",
        body: "Add the bKash, Nagad, Rocket, and Upay accounts you receive money into. Account numbers stay masked, and each account carries a label, a type, a priority, and a daily limit.",
      },
      {
        icon: Link2,
        title: "Payment links",
        body: "Create a fixed or flexible-amount link, share it as a link or a QR code, and cap how many times it can be used. Disable it the moment you want it closed.",
      },
      {
        icon: FileText,
        title: "Invoices",
        body: "Write an invoice with line items, tax, and a discount, send it, and watch it move from draft to paid. Reminders are one click away.",
      },
      {
        icon: Store,
        title: "Brands and websites",
        body: "Run several storefronts under one account. Each brand carries its own logo, colour, checkout theme, and set of assigned payment accounts.",
      },
    ],
  },
  {
    title: "Automation",
    summary:
      "The parts that run by themselves once you set them up.",
    items: [
      {
        icon: MonitorSmartphone,
        title: "Connect a phone",
        body: "Pair an Android device with your merchant by signing in with your email, password and a phone key, then watch its connection status, health, and notification count from the dashboard.",
      },
      {
        icon: LayoutDashboard,
        title: "Checkout builder",
        body: "Set the logo, colours, theme, method order, instructions, and redirect for your checkout page, with a live preview of the result.",
      },
      {
        icon: Webhook,
        title: "Webhooks",
        body: "Point an endpoint at ZevaPay and choose the events you care about. Every delivery keeps its request and response body so you can debug it.",
      },
      {
        icon: Code2,
        title: "API and sandbox",
        body: "Issue scoped keys, read your transaction history programmatically, and rehearse success, failure, and pending flows in a sandbox that never touches live money.",
      },
    ],
  },
  {
    title: "Operations",
    summary:
      "What your team does every day, and what it needs to answer quickly.",
    items: [
      {
        icon: Receipt,
        title: "Transaction review",
        body: "Filter by status, provider, amount, and date. Records that need a decision are collected in one queue rather than scattered across a list.",
      },
      {
        icon: Users,
        title: "Customers",
        body: "A directory of the people who pay you, with their history, tags, and notes. Import and export a CSV whenever you need it.",
      },
      {
        icon: HeartPulse,
        title: "Reports",
        body: "Revenue, volume, payment methods, fees, success and failure rates, and a reconciliation view that shows where recorded and settled totals differ.",
      },
      {
        icon: Bell,
        title: "Notifications",
        body: "Choose which events reach you and how — email, dashboard, SMS, Telegram, Discord, Slack, or a webhook.",
      },
    ],
  },
  {
    title: "Governance",
    summary: "Who can do what, and how the account stays locked down.",
    items: [
      {
        icon: ShieldCheck,
        title: "Roles and permissions",
        body: "Owner, Admin, Manager, Support, and Viewer, each with a defined set of permissions. Add your own roles when the defaults do not fit.",
      },
      {
        icon: Code2,
        title: "Audit trail",
        body: "Who changed what, when, and from where. Recorded for sensitive actions so you can answer the question later.",
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <PublicLayout>
      <section className="border-b border-line bg-elevated">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <Badge tone="brand">Features</Badge>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl sm:leading-[1.15]">
            Everything a payment desk needs, in one workspace.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
            ZevaPay records the notifications your provider already sends to
            your phone and turns them into a ledger you can search, filter,
            export, and act on. It never asks for your PIN, never handles your
            OTP, and never moves your money.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/register" size="lg" className="w-full sm:w-auto">
                Create an account
              </ButtonLink>
          </div>
        </div>
      </section>

      {GROUPS.map((group) => (
        <section
          key={group.title}
          className="border-b border-line last:border-b-0"
        >
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                {group.title}
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                {group.summary}
              </p>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-xl border border-line bg-surface p-6"
                  >
                    <span className="flex size-10 items-center justify-center rounded-lg bg-brand-tint">
                      <Icon className="size-5 text-brand-link" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 text-[15px] font-semibold text-ink">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                      {item.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ))}

      {/* Security */}
      <section className="border-b border-line last:border-b-0">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Security
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              What ZevaPay touches, and — more importantly — what it never
              touches.
            </p>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {[
              {
                title: "It never handles your credentials",
                body: "No provider password, no PIN, no one-time passcode. ZevaPay reads the notification that arrives on the device you paired, and nothing else.",
              },
              {
                title: "It never moves your money",
                body: "Funds stay in the bKash, Nagad, Rocket, or Upay account you connected. ZevaPay is a record-keeping and automation tool, not a payment service.",
              },
              {
                title: "Account numbers are masked in the API",
                body: "The API returns a masked number, so a full account number is never sent to a browser. API keys show their value once at creation and are masked after that.",
              },
              {
                title: "Records say what they actually mean",
                body: "A record parsed from a notification is labelled as confirmed from SMS. It is never presented as a provider-side settlement check, because it is not one.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-line bg-surface p-6"
              >
                <h3 className="text-[15px] font-semibold text-ink">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <div className="rounded-xl border border-line bg-brand-solid px-6 py-12 text-center sm:px-14">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Start with one account and one device.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-on-brand-muted">
              The free plan covers a single payment account, so you can see the
              whole flow before you decide anything.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href="/register" size="lg" className="w-full bg-white text-brand-link hover:bg-brand-tint sm:w-auto">
                  Get started
                </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
