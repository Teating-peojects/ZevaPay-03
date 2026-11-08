import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, CircleCheck, Clock, Eye, Lock, ShieldCheck } from "lucide-react";
import { PlanCards } from "@/components/billing/plan-cards";
import { Faq } from "@/components/marketing/faq";
import { HeroDemo } from "@/components/marketing/hero-demo";
import { PublicLayout } from "@/components/marketing/public-layout";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { ButtonLink } from "@/components/ui/button";
import { PROVIDERS } from "@/data/providers";
import { PUBLIC_PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "ZevaPay: know the moment a bKash or Nagad payment lands",
  description:
    "ZevaPay reads the payment SMS on your phone, matches the TrxID and amount, and tells your website the order is paid. Free for 30 days.",
};

const steps = [
  {
    title: "The customer pays",
    body: "Your website sends them to a ZevaPay checkout page. They pay with bKash or Nagad and type in the TrxID.",
  },
  {
    title: "Your phone hears about it",
    body: "The ZevaPay app on your shop phone forwards the payment SMS. It only reads messages from payment providers.",
  },
  {
    title: "Your website is told",
    body: "ZevaPay matches provider, TrxID and amount. On a match the order is confirmed and your website gets a signed notice.",
  },
];

const outcomes = [
  {
    icon: CircleCheck,
    tone: "text-success-fg",
    title: "Confirmed",
    body: "The SMS agrees on provider, TrxID and amount. The order is approved with no one lifting a finger.",
  },
  {
    icon: Eye,
    tone: "text-warning-fg",
    title: "Needs your review",
    body: "A TrxID was found but something does not agree, such as the amount. You see both sides and decide to accept or reject.",
  },
  {
    icon: Clock,
    tone: "text-info-fg",
    title: "Waiting",
    body: "No matching SMS yet. The customer sees a waiting screen, and it confirms the moment the message arrives.",
  },
];

const CODE = `POST /api/v1/checkout/payments
Authorization: Bearer zp_live_...

{ "amountMinor": 300000, "orderId": "ORD-1182",
  "returnUrl": "https://shop.example/thanks" }

-> { "id": "...", "checkoutUrl": "https://.../pay/..." }`;

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
    <PublicLayout>
      {/* Hero */}
      <section className="zp-hero zp-speedlines relative overflow-hidden text-white">
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pb-24 lg:pt-20">
          <div>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl xl:text-[3.5rem]">
              Your customer pays.
              <br />
              Your order confirms itself.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-blue-100">
              ZevaPay reads the payment SMS on your phone, matches the TrxID and
              amount, and tells your website the order is paid. No more
              checking the bKash app by hand.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink
                href="/register"
                size="lg"
                className="w-full bg-white text-[#06196f] hover:bg-blue-50 sm:w-auto"
              >
                Start free for 30 days
              </ButtonLink>
              <ButtonLink
                href="#how-it-works"
                size="lg"
                variant="outline"
                className="w-full border-white/40 bg-transparent text-white hover:bg-white/10 sm:w-auto"
              >
                See how it works
              </ButtonLink>
            </div>
            <ul className="mt-8 flex flex-wrap gap-2 text-[13px]">
              {["No PIN or OTP, ever", "Never touches your money", "Free for 30 days"].map((item) => (
                <li key={item} className="flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 ring-1 ring-white/20">
                  <Check className="size-3.5 text-cyan-300" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <HeroDemo />
        </div>
      </section>

      {/* Providers */}
      <section id="supported" className="scroll-mt-20 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-10 gap-y-4 px-4 py-6 sm:px-6">
          <p className="text-sm text-ink-muted">Works with</p>
          {([PROVIDERS.BKASH, PROVIDERS.NAGAD] as const).map((provider) => (
            <span key={provider.id} className="flex items-center gap-2.5">
              <ProviderLogo provider={provider.id} size="md" />
              <span className="text-[15px] font-semibold text-ink">{provider.name}</span>
            </span>
          ))}
          <p className="text-sm text-ink-muted">Rocket and Upay are coming next.</p>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            From checkout to confirmed in under a minute.
          </h2>
          <ol className="relative mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            <span
              aria-hidden="true"
              className="absolute left-[16.6%] right-[16.6%] top-5 hidden h-0.5 bg-gradient-to-r from-[#0A3CFF] via-[#00B8FF] to-[#00D4FF] md:block"
            />
            {steps.map((step, index) => (
              <li key={step.title} className="relative">
                <span className="relative flex size-10 items-center justify-center rounded-full bg-[#0A3CFF] text-[15px] font-bold text-white ring-8 ring-canvas">
                  {index + 1}
                </span>
                <h3 className="mt-5 text-lg font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Outcomes */}
      <section className="border-b border-line bg-elevated">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Every payment ends one of three ways.
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {outcomes.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-line bg-surface p-6">
                  <Icon className={`size-7 ${item.tone}`} aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-semibold text-ink">{item.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{item.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Developers */}
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Connect your website with one request.
            </h2>
            <p className="mt-4 max-w-md text-[17px] leading-relaxed text-ink-soft">
              Create a payment, send the customer to the link you get back, and
              we post a signed notice to your server when it is confirmed. You
              can also ask for the status at any time.
            </p>
            <Link
              href="/features"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-link hover:text-brand-link-hover"
            >
              Read what ZevaPay can do
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <pre className="overflow-x-auto rounded-2xl bg-[#03084a] p-5 font-mono text-[13px] leading-relaxed text-blue-100 shadow-lg">
            <code>{CODE}</code>
          </pre>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="scroll-mt-20 bg-[#03084a] text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            ZevaPay never asks for your PIN.
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: Lock,
                title: "No PIN, no OTP, no money moved",
                body: "It only reads the SMS your provider already sends to your phone. Your money stays in your own account.",
              },
              {
                icon: ShieldCheck,
                title: "Keys stay on your server",
                body: "API keys are shown once. The phone app uses a separate key that cannot create payments, and you can remove it any time.",
              },
              {
                icon: Eye,
                title: "Honest about what confirmed means",
                body: "Confirmed means the SMS on your phone matched. It is not a check with bKash or Nagad, so for a large order, look in the provider app first.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title}>
                  <Icon className="size-6 text-cyan-300" aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-blue-100">{item.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Free for 30 days. Then pay for the time you want.
          </h2>
          <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink-soft">
            Every plan has everything. The longer you pay for, the less each month costs.
          </p>
          <div className="mt-10">
            <PlanCards
              plans={PUBLIC_PLANS}
              ctaFor={(plan) => ({
                label: plan.months === 0 ? "Start free" : "Choose plan",
                href: "/register",
              })}
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-b border-line bg-elevated">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Questions shop owners ask
          </h2>
          <Faq items={faqItems} className="mt-10 max-w-3xl" />
        </div>
      </section>

      {/* Closing */}
      <section className="zp-hero text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
          <h2 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
            Try it on your next order.
          </h2>
          <ButtonLink
            href="/register"
            size="lg"
            className="bg-white text-[#06196f] hover:bg-blue-50"
          >
            Start free for 30 days
          </ButtonLink>
        </div>
      </section>
    </PublicLayout>
  );
}
