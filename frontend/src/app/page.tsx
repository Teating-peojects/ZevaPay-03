import type { Metadata } from "next";
import { ArrowRight, ChevronRight, Eye, Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { PlanCards } from "@/components/billing/plan-cards";
import { Faq } from "@/components/marketing/faq";
import { HeroDemo } from "@/components/marketing/hero-demo";
import { PublicLayout } from "@/components/marketing/public-layout";
import {
  Bubble,
  CheckoutWindow,
  DashboardWindow,
  OutcomeCard,
  PhoneSms,
  SiteWindow,
  Window,
} from "@/components/marketing/visuals";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { ButtonLink } from "@/components/ui/button";
import { PUBLIC_PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "ZevaPay: know the moment a bKash or Nagad payment lands",
  description:
    "ZevaPay reads the payment SMS on your phone, matches the TrxID and amount, and tells your website the order is paid. Free for 30 days.",
};

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



function Arrow() {
  return (
    <span className="hidden size-9 shrink-0 items-center justify-center self-center rounded-full bg-white text-[#0A3CFF] shadow-md ring-1 ring-slate-900/5 md:flex">
      <ChevronRight className="size-4" aria-hidden="true" />
    </span>
  );
}

export default function HomePage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="zp-hero zp-speedlines relative overflow-hidden text-white">
        <div className="zp-grid absolute inset-0" aria-hidden="true" />
        <div className="zp-glow -right-24 top-10 size-96 bg-cyan-400/30" aria-hidden="true" />
        <div className="zp-glow -left-24 bottom-0 size-80 bg-blue-600/50" aria-hidden="true" />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-12 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:pb-20 lg:pt-16">
          <div>
            <h1 className="text-4xl font-bold leading-[1.06] tracking-tight sm:text-5xl xl:text-[3.2rem]">
              Your customer pays.
              <br />
              Your order confirms itself.
            </h1>
            <p className="mt-5 max-w-md text-lg leading-snug text-blue-100">
              bKash and Nagad payments, matched from your phone&rsquo;s SMS.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/register" size="lg" className="w-full bg-white text-[#06196f] hover:bg-blue-50 sm:w-auto">
                Start free for 30 days
              </ButtonLink>
              <ButtonLink href="#how-it-works" size="lg" variant="outline" className="w-full border-white/40 bg-transparent text-white hover:bg-white/10 sm:w-auto">
                See how it works
              </ButtonLink>
            </div>
          </div>

          <div id="supported" className="relative scroll-mt-24">
            <Bubble className="-left-2 top-6 hidden sm:flex lg:-left-10">
              <ProviderLogo provider="BKASH" size="sm" /> bKash ৳3,000
            </Bubble>
            <Bubble className="-right-2 top-24 hidden sm:flex lg:-right-6" delay={900}>
              <span className="size-2 rounded-full bg-emerald-500" /> order.paid sent
            </Bubble>
            <Bubble className="-left-4 bottom-10 hidden sm:flex lg:-left-12" delay={1700}>
              <ProviderLogo provider="NAGAD" size="sm" /> Nagad ৳1,250
            </Bubble>
            <HeroDemo />
          </div>
        </div>
      </section>

      {/* Flow */}
      <section id="how-it-works" className="zp-light-sheen scroll-mt-20 border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Pay. Match. Confirm.</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
            <div>
              <CheckoutWindow />
              <p className="mt-3 text-center text-sm font-semibold text-ink">Customer pays</p>
            </div>
            <Arrow />
            <div>
              <PhoneSms />
              <p className="mt-3 text-center text-sm font-semibold text-ink">Phone forwards the SMS</p>
            </div>
            <Arrow />
            <div>
              <SiteWindow />
              <p className="mt-3 text-center text-sm font-semibold text-ink">Your site is told</p>
            </div>
          </div>
        </div>
      </section>

      {/* Outcomes */}
      <section className="border-b border-line bg-elevated">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Every payment ends clearly.</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {([
              ["ok", "Matches: approved."],
              ["review", "Differs: you decide."],
              ["wait", "No SMS yet: it waits."],
            ] as const).map(([kind, caption]) => (
              <div key={kind} className="rounded-2xl bg-white p-3 shadow-[0_18px_40px_-24px_rgba(3,8,74,0.4)] ring-1 ring-slate-900/5">
                <OutcomeCard kind={kind} />
                <p className="px-1 pb-1 pt-3 text-sm font-semibold text-slate-800">{caption}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard */}
      <section className="relative overflow-hidden border-b border-line bg-[#03084a] text-white">
        <div className="zp-glow left-1/3 top-0 size-96 bg-blue-600/40" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Every payment in one place.</h2>
          <div className="relative mt-8">
            <DashboardWindow />
            <Bubble className="-right-2 -top-4 hidden sm:flex lg:-right-6">
              <span className="size-2 rounded-full bg-amber-500" /> 1 to review
            </Bubble>
          </div>
          <p className="mt-3 text-xs text-blue-200/70">Sample data.</p>
        </div>
      </section>

      {/* Developers */}
      <section className="zp-light-sheen border-b border-line">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:px-6 sm:py-14 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">One request to connect.</h2>
            <Link href="/features" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-link hover:text-brand-link-hover">
              See what ZevaPay can do
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Window title="POST /checkout/payments">
              <pre className="overflow-x-auto bg-[#03084a] p-4 font-mono text-[12px] leading-relaxed text-blue-100">
                <code>{`{
  "amountMinor": 300000,
  "orderId": "ORD-1182",
  "returnUrl": "https://shop.example/thanks"
}`}</code>
              </pre>
            </Window>
            <Window title="Response">
              <pre className="overflow-x-auto bg-[#03084a] p-4 font-mono text-[12px] leading-relaxed text-blue-100">
                <code>{`{
  "id": "clx9...",
  "status": "PENDING",
  "checkoutUrl": "https://.../pay/..."
}`}</code>
              </pre>
            </Window>
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="scroll-mt-20 border-b border-white/10 bg-[#03084a] text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">No PIN. No OTP. No money moved.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { icon: Lock, text: "Reads only the SMS your provider sends." },
              { icon: ShieldCheck, text: "Phone key can’t create payments." },
              { icon: Eye, text: "Confirmed means the SMS matched." },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-4 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0A3CFF] to-[#00B8FF]">
                  <Icon className="size-5 text-white" aria-hidden="true" />
                </span>
                <p className="text-[15px] font-medium leading-snug">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="zp-light-sheen scroll-mt-20 border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Free for 30 days.</h2>
          <div className="mt-8">
            <PlanCards
              plans={PUBLIC_PLANS}
              ctaFor={(plan) => ({ label: plan.months === 0 ? "Start free" : "Choose plan", href: "/register" })}
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-b border-line bg-elevated">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Questions</h2>
          <Faq items={faqItems} className="mt-8 max-w-3xl" />
        </div>
      </section>

      {/* Closing */}
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
