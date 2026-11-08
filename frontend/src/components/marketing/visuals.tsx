import * as React from "react";
import { Check, CircleCheck, Clock, TriangleAlert } from "lucide-react";
import { ZLoader } from "@/components/brand/z-loader";
import { cn } from "@/lib/utils";

/**
 * Small pieces of illustrated product UI for the home page. They are drawings
 * with sample data, not live screens, so they use fixed colours and look the
 * same in both themes.
 */

/** A browser-style window with a title bar. */
export function Window({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl bg-white text-slate-900 shadow-[0_24px_60px_-24px_rgba(3,8,74,0.55)] ring-1 ring-slate-900/10",
        className,
      )}
    >
      <div className="flex h-9 items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3.5">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 truncate text-[11px] text-slate-400">{title}</span>
      </div>
      {children}
    </div>
  );
}

/** A floating pill that sits over a visual. */
export function Bubble({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={cn(
        "zp-float absolute z-20 flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-2 text-[12px] font-semibold text-slate-800 shadow-[0_12px_30px_-10px_rgba(3,8,74,0.55)] ring-1 ring-slate-900/5 backdrop-blur",
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function StatusBadge({ tone, children }: { tone: "ok" | "review" | "wait"; children: React.ReactNode }) {
  const styles = {
    ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    review: "bg-amber-50 text-amber-700 ring-amber-200",
    wait: "bg-blue-50 text-blue-700 ring-blue-200",
  }[tone];
  const Icon = tone === "ok" ? CircleCheck : tone === "review" ? TriangleAlert : Clock;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", styles)}>
      <Icon className="size-3" aria-hidden="true" />
      {children}
    </span>
  );
}

/** Step 1: the customer's checkout page. */
export function CheckoutWindow() {
  return (
    <Window title="pay.zevapay.com">
      <div className="p-5">
        <p className="text-[11px] text-slate-500">Amount to pay</p>
        <p className="text-2xl font-bold tracking-tight">৳3,000</p>
        <div className="mt-3 flex gap-2">
          <span className="rounded-md border-2 border-[#E2136E] bg-[#FCE7F3] px-2.5 py-1 text-[12px] font-semibold text-[#9D174D]">bKash</span>
          <span className="rounded-md border border-slate-200 px-2.5 py-1 text-[12px] text-slate-500">Nagad</span>
        </div>
        <div className="mt-3 flex h-9 items-center rounded-md border-2 border-[#0A3CFF] px-2.5 font-mono text-[13px] tracking-wider">9G4K2L7P</div>
        <div className="mt-2.5 flex h-9 items-center justify-center rounded-md bg-[#0A3CFF] text-[13px] font-semibold text-white">I have paid</div>
      </div>
    </Window>
  );
}

/** Step 2: the shop phone getting the SMS and the ZevaPay app forwarding it. */
export function PhoneSms() {
  return (
    <div className="mx-auto w-[210px] rounded-[2rem] bg-slate-900 p-2 shadow-[0_24px_60px_-24px_rgba(3,8,74,0.7)] ring-1 ring-white/10">
      <div className="overflow-hidden rounded-[1.5rem] bg-slate-100">
        <div className="flex items-center justify-between px-4 pb-1 pt-3 text-[10px] font-semibold text-slate-500">
          <span>9:41</span>
          <span className="h-1.5 w-12 rounded-full bg-slate-300" />
          <span>5G</span>
        </div>
        <div className="space-y-2 px-3 pb-4 pt-2">
          <div className="rounded-xl bg-white p-2.5 shadow-sm">
            <p className="text-[10px] font-semibold text-[#E2136E]">bKash</p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-700">
              You have received Tk 3,000.00. TrxID 9G4K2L7P
            </p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-[#0A3CFF] to-[#0626b8] p-2.5 text-white shadow-sm">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold">
              {/* eslint-disable-next-line @next/next/no-img-element -- small fixed brand image */}
              <img src="/brand/zevapay-icon.png" alt="" className="size-4" />
              ZevaPay
            </p>
            <p className="mt-1 flex items-center gap-1 text-[11px]">
              <Check className="size-3 text-cyan-300" strokeWidth={3} />
              Sent. Matched.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Step 3: the merchant's own site getting told. */
export function SiteWindow() {
  return (
    <Window title="shop.example/admin/orders">
      <div className="space-y-2.5 p-5">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold">Order ORD-1182</p>
          <StatusBadge tone="ok">Paid</StatusBadge>
        </div>
        <div className="rounded-lg bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-blue-100">
          <span className="text-cyan-300">payment.confirmed</span>
          <br />
          amount 3000 · bKash
          <br />
          trxId 9G4K2L7P
        </div>
        <p className="text-[11px] text-slate-500">Signed with your webhook secret</p>
      </div>
    </Window>
  );
}

/** The three ways a payment can end. */
export function OutcomeCard({ kind }: { kind: "ok" | "review" | "wait" }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-900/5">
      {kind === "ok" ? (
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <div>
            <p className="font-semibold">bKash · 9G4K2L7P</p>
            <p className="text-slate-500">৳3,000 = ৳3,000</p>
          </div>
          <StatusBadge tone="ok">Matched</StatusBadge>
        </div>
      ) : null}
      {kind === "review" ? (
        <div className="text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">bKash · 7T2M9QXA</p>
              <p className="text-slate-500">৳2,900 paid, ৳3,000 due</p>
            </div>
            <StatusBadge tone="review">Review</StatusBadge>
          </div>
          <div className="mt-3 flex gap-2">
            <span className="flex-1 rounded-md bg-emerald-600 py-1.5 text-center text-[12px] font-semibold text-white">Accept</span>
            <span className="flex-1 rounded-md border border-slate-300 py-1.5 text-center text-[12px] font-semibold text-slate-700">Reject</span>
          </div>
        </div>
      ) : null}
      {kind === "wait" ? (
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <div>
            <p className="font-semibold">Nagad · 4K8P1ZRD</p>
            <p className="text-slate-500">Waiting for the SMS</p>
          </div>
          <ZLoader className="w-12" label="Waiting" />
        </div>
      ) : null}
    </div>
  );
}

const ROWS = [
  { p: "bKash", c: "#E2136E", t: "9G4K2L7P", a: "৳3,000", s: "ok" as const, l: "Matched" },
  { p: "Nagad", c: "#EE1C25", t: "4K8P1ZRD", a: "৳1,250", s: "wait" as const, l: "Waiting" },
  { p: "bKash", c: "#E2136E", t: "7T2M9QXA", a: "৳2,900", s: "review" as const, l: "Review" },
  { p: "Nagad", c: "#EE1C25", t: "1B6C3VNE", a: "৳850", s: "ok" as const, l: "Matched" },
  { p: "bKash", c: "#E2136E", t: "5X0R7HKS", a: "৳4,400", s: "ok" as const, l: "Matched" },
];

/** A picture of the merchant dashboard, with sample rows. */
export function DashboardWindow() {
  return (
    <Window title="zevapay.com/dashboard" className="w-full">
      <div className="flex min-h-[340px]">
        <div className="hidden w-44 shrink-0 border-r border-slate-100 bg-slate-50 p-3 sm:block">
          <div className="flex items-center gap-2 px-1.5 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- small fixed brand image */}
            <img src="/brand/zevapay-icon.png" alt="" className="size-6" />
            <span className="text-[13px] font-bold">ZevaPay</span>
          </div>
          <ul className="mt-3 space-y-0.5 text-[12px] text-slate-600">
            {["Overview", "Payments", "Devices", "Developers", "Plan"].map((item, i) => (
              <li key={item} className={cn("rounded-md px-2.5 py-1.5", i === 1 && "bg-[#0A3CFF]/10 font-semibold text-[#0A3CFF]")}>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0 flex-1 p-4">
          <div className="grid grid-cols-3 gap-2.5">
            {[
              ["Today", "৳48,500"],
              ["Matched", "37"],
              ["To review", "2"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-900/5">
                <p className="text-[11px] text-slate-500">{label}</p>
                <p className="mt-0.5 text-lg font-bold tracking-tight">{value}</p>
              </div>
            ))}
          </div>
          <table className="mt-4 w-full text-left text-[12px]">
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.t} className="border-t border-slate-100">
                  <td className="py-2.5 pr-2">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <span className="size-2 rounded-full" style={{ background: row.c }} />
                      {row.p}
                    </span>
                  </td>
                  <td className="hidden py-2.5 pr-2 font-mono text-slate-500 sm:table-cell">{row.t}</td>
                  <td className="py-2.5 pr-2 font-semibold">{row.a}</td>
                  <td className="py-2.5 text-right">
                    <StatusBadge tone={row.s}>{row.l}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Window>
  );
}
