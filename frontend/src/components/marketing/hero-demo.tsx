"use client";

import * as React from "react";
import { Check, MessageSquareText } from "lucide-react";
import { ZLoader } from "@/components/brand/z-loader";
import { cn } from "@/lib/utils";

/**
 * The hero: a customer's checkout page going through the three moments that
 * matter, over and over. The customer enters a TrxID, waits while the shop's
 * phone receives the payment SMS, then sees "confirmed". It is the product's
 * whole story in eight seconds, built from the real checkout wording.
 * With reduced motion it holds still on the confirmed screen.
 */
const TRX = "9G4K2L7P";
const LOOP = 8200;
const TYPE_START = 600;
const TYPE_STEP = 110;
const WAIT_AT = 2600;
const DONE_AT = 5200;

export function HeroDemo() {
  const [t, setT] = React.useState(0);

  React.useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const start = performance.now();
    const id = window.setInterval(() => {
      setT(reduced.matches ? DONE_AT + 1000 : (performance.now() - start) % LOOP);
    }, 90);
    return () => window.clearInterval(id);
  }, []);

  const phase = t < WAIT_AT ? "enter" : t < DONE_AT ? "wait" : "done";
  const typed = Math.max(0, Math.min(TRX.length, Math.floor((t - TYPE_START) / TYPE_STEP)));

  return (
    <div className="relative mx-auto mt-10 w-full max-w-[340px] lg:mt-0">
      {/* The SMS the shop's phone receives while the customer waits. */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute -top-14 right-2 z-10 w-60 rounded-xl bg-white p-3 text-slate-800 shadow-xl ring-1 ring-slate-200 transition-all duration-500",
          phase === "wait" ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0",
        )}
      >
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          <MessageSquareText className="size-3.5" />
          Shop phone · bKash
        </p>
        <p className="mt-1 text-[12px] leading-snug">
          You have received Tk 3,000.00. TrxID {TRX}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white text-slate-900 shadow-[0_30px_80px_-20px_rgba(0,20,120,0.6)] ring-1 ring-white/20">
        <div className="flex items-center justify-between bg-slate-50 px-5 py-3 text-[12px] text-slate-500">
          <span>Pay Your Shop</span>
          <span>Order ORD-1182</span>
        </div>

        <div className="px-5 pb-6 pt-5" aria-live="polite">
          <p className="text-[13px] text-slate-500">Amount to pay</p>
          <p className="text-3xl font-bold tracking-tight">৳3,000</p>

          <div className="mt-5 min-h-[168px]">
            {phase === "enter" ? (
              <div>
                <div className="flex gap-2">
                  <span className="rounded-lg border-2 border-[#E2136E] bg-[#FCE7F3] px-3 py-1.5 text-[13px] font-semibold text-[#9D174D]">
                    bKash
                  </span>
                  <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] text-slate-500">
                    Nagad
                  </span>
                </div>
                <p className="mt-4 text-[12px] font-medium text-slate-500">Transaction ID (TrxID)</p>
                <div className="mt-1 flex h-11 items-center rounded-lg border-2 border-[#0A3CFF] px-3 font-mono text-[15px] tracking-wider">
                  {TRX.slice(0, typed)}
                  <span className="ml-px h-5 w-px animate-pulse bg-slate-900" />
                </div>
                <div className="mt-3 flex h-11 items-center justify-center rounded-lg bg-[#0A3CFF] text-[14px] font-semibold text-white">
                  I have paid
                </div>
              </div>
            ) : null}

            {phase === "wait" ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 pt-4 text-center">
                <ZLoader className="w-20" label="Waiting for your payment" />
                <p className="text-[15px] font-semibold">Waiting for your payment</p>
                <p className="text-[12px] text-slate-500">
                  We have your TrxID. This usually takes under a minute.
                </p>
              </div>
            ) : null}

            {phase === "done" ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 pt-4 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-emerald-100">
                  <Check className="size-7 text-emerald-700" strokeWidth={3} />
                </span>
                <p className="text-[17px] font-semibold">Payment confirmed</p>
                <p className="text-[12px] text-slate-500">Your order ORD-1182 is paid. Thank you.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
