import { Suspense } from "react";
import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { CheckoutScreen } from "./checkout-screen";

/*
 * The link is a credential, so the page must not be indexed and must not send
 * the address on to the next site when the customer follows "Back to the shop".
 */
export const metadata: Metadata = {
  title: "Pay",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function CheckoutFallback() {
  return (
    <div
      role="status"
      className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-ink-muted"
    >
      Loading your payment…
    </div>
  );
}

async function CheckoutLoader({ params }: { params: PageProps<"/pay/[token]">["params"] }) {
  const { token } = await params;
  return <CheckoutScreen token={token} />;
}

export default function PayPage({ params }: PageProps<"/pay/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8 sm:py-12">
      <Logo />
      <Suspense fallback={<CheckoutFallback />}>
        <CheckoutLoader params={params} />
      </Suspense>
      <p className="text-center text-[12px] leading-relaxed text-ink-muted">
        Never share your PIN or an OTP with anyone. ZevaPay will not ask for them.
      </p>
    </main>
  );
}
