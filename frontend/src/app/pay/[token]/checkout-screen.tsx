"use client";

import * as React from "react";
import { CircleCheck, Clock, TriangleAlert } from "lucide-react";
import { ZLoader } from "@/components/brand/z-loader";
import { CopyableValue } from "@/components/shared/copyable-value";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatBDT } from "@/lib/format";
import { cleanTrxId, TRXID_HELP } from "@/lib/trxid";
import { cn } from "@/lib/utils";
import type { CheckoutView } from "@/types/api";
import { SupportLinks } from "./support-links";

const POLL_MS = 4000;
const PROVIDER_NAME = { BKASH: "bKash", NAGAD: "Nagad" } as const;

type Load =
  | { state: "loading" }
  | { state: "unavailable" }
  | { state: "error"; message: string }
  | { state: "ready"; view: CheckoutView };

function isFinal(view: CheckoutView): boolean {
  return !(view.status === "CREATED" || view.status === "PENDING") || view.expired;
}

/** The page a customer sees after following a merchant's payment link. */
export function CheckoutScreen({ token }: { token: string }) {
  const [load, setLoad] = React.useState<Load>({ state: "loading" });
  const path = `/api/v1/public/checkout/${encodeURIComponent(token)}`;

  const refresh = React.useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await apiFetch<{ data: CheckoutView }>(path, { signal, cache: "no-store" });
        setLoad({ state: "ready", view: response.data });
      } catch (caught) {
        if (signal?.aborted) return;
        if (caught instanceof ApiError && caught.status === 404) {
          setLoad({ state: "unavailable" });
        } else {
          // Keep showing what we have when a poll fails; only the first load reports it.
          setLoad((current) =>
            current.state === "ready"
              ? current
              : {
                  state: "error",
                  message:
                    caught instanceof ApiError && caught.status === 429
                      ? "Too many requests. Wait a minute and reload the page."
                      : "We could not load this payment. Check your connection and reload.",
                },
          );
        }
      }
    },
    [path],
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  // While a payment waits for its SMS, look again every few seconds.
  const view = load.state === "ready" ? load.view : null;
  const waiting = view !== null && !isFinal(view) && view.awaitingSms;
  React.useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [waiting, refresh]);

  if (load.state === "loading") {
    return (
      <div role="status" className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-ink-muted">
        Loading your payment…
      </div>
    );
  }
  if (load.state === "unavailable") {
    return (
      <Notice
        tone="warning"
        title="This payment link is not available"
        text="It may be mistyped, or the merchant may have closed it. Ask the merchant for a new link."
      />
    );
  }
  if (load.state === "error") {
    return <Notice tone="warning" title="Something went wrong" text={load.message} />;
  }

  return <Checkout view={load.view} token={token} onView={(next) => setLoad({ state: "ready", view: next })} />;
}

function Notice({
  tone,
  title,
  text,
}: {
  tone: "success" | "warning" | "info";
  title: string;
  text: string;
}) {
  return (
    <Alert tone={tone} title={title}>
      {text}
    </Alert>
  );
}

function Summary({ view }: { view: CheckoutView }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line pb-5">
      <p className="text-[13px] text-ink-muted">Pay {view.merchantName}</p>
      <p className="text-4xl font-semibold tracking-tight text-ink tabular-nums">
        {formatBDT(view.amountMinor / 100)}
      </p>
      {view.description ? <p className="text-sm text-ink-soft">{view.description}</p> : null}
      <p className="mt-1 text-[12px] text-ink-muted">Reference {view.reference}</p>
    </div>
  );
}

function BackLink({ view, label }: { view: CheckoutView; label?: string }) {
  if (!view.returnUrl) return null;
  return (
    <ButtonLink href={view.returnUrl} variant="outline" className="w-full">
      {label ?? `Back to ${view.merchantName}`}
    </ButtonLink>
  );
}

function Checkout({
  view,
  token,
  onView,
}: {
  view: CheckoutView;
  token: string;
  onView: (view: CheckoutView) => void;
}) {
  let body: React.ReactNode;

  if (view.status === "CONFIRMED") {
    body = (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <CircleCheck className="size-12 text-success-600" aria-hidden="true" />
        <div>
          <h1 className="text-lg font-semibold text-ink">Payment received</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {view.merchantName} will see this payment as confirmed. You can close this page.
          </p>
        </div>
        <BackLink view={view} />
      </div>
    );
  } else if (view.status === "REVIEW") {
    body = (
      <div className="flex flex-col gap-4">
        <Alert tone="info" title="We are checking your payment">
          We received your TrxID, but something needs a quick check by {view.merchantName}. You do
          not need to pay again. If you have not heard back soon, contact them and quote the
          reference above.
        </Alert>
        <SupportLinks support={view.support} merchantName={view.merchantName} />
        <BackLink view={view} />
      </div>
    );
  } else if (view.status !== "CREATED" && view.status !== "PENDING") {
    body = (
      <div className="flex flex-col gap-4">
        <Alert tone="warning" title="This payment can no longer be completed">
          Ask {view.merchantName} for a new payment link. If you have already sent money, contact
          them and quote the reference above.
        </Alert>
        <SupportLinks support={view.support} merchantName={view.merchantName} />
        <BackLink view={view} />
      </div>
    );
  } else if (view.expired) {
    body = (
      <div className="flex flex-col gap-4">
        <Alert tone="warning" title="This payment has expired">
          Ask {view.merchantName} for a new payment link. If you have already sent money, contact
          them and quote the reference above.
        </Alert>
        <SupportLinks support={view.support} merchantName={view.merchantName} />
        <BackLink view={view} />
      </div>
    );
  } else if (view.awaitingSms) {
    body = (
      <div className="flex flex-col items-center gap-4 py-2 text-center" role="status" aria-live="polite">
        <ZLoader className="w-16" label="Waiting for your payment" />
        <div>
          <h1 className="text-lg font-semibold text-ink">Waiting for your payment</h1>
          <p className="mt-1 text-sm text-ink-soft">
            We have your TrxID. This usually takes under a minute once the money is sent. Keep this
            page open.
          </p>
        </div>
      </div>
    );
  } else if (view.providers.length === 0) {
    body = (
      <Alert tone="warning" title="This merchant cannot take payments right now">
        {view.merchantName} has not set up a bKash or Nagad account for payments. Please contact
        them.
      </Alert>
    );
  } else if (view.attemptsLeft === 0) {
    body = (
      <div className="flex flex-col gap-4">
        <Alert tone="warning" title="Too many TrxIDs were tried">
          Contact {view.merchantName} and quote the reference above.
        </Alert>
        <SupportLinks support={view.support} merchantName={view.merchantName} />
      </div>
    );
  } else {
    body = <PayForm view={view} token={token} onView={onView} />;
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
      <Summary view={view} />
      {body}
      {view.expiresAt && view.canSubmit ? (
        <p className="flex items-center justify-center gap-1.5 text-[12px] text-ink-muted">
          <Clock className="size-3.5" aria-hidden="true" />
          Pay before{" "}
          {new Date(view.expiresAt).toLocaleTimeString("en-BD", { hour: "numeric", minute: "2-digit" })}
        </p>
      ) : null}
    </div>
  );
}

function PayForm({
  view,
  token,
  onView,
}: {
  view: CheckoutView;
  token: string;
  onView: (view: CheckoutView) => void;
}) {
  const [provider, setProvider] = React.useState(view.providers[0].provider);
  const [trxId, setTrxId] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState(false);
  const [usedOpen, setUsedOpen] = React.useState(false);
  const [failures, setFailures] = React.useState(0);

  // After two TrxIDs that did not work, point the customer to the merchant.
  const needsHelp = failures >= 2 || view.attemptsLeft <= 3;

  const account = view.providers.find((item) => item.provider === provider) ?? view.providers[0];
  const name = PROVIDER_NAME[account.provider];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const cleaned = cleanTrxId(trxId);
    if (!cleaned) {
      setError(TRXID_HELP);
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      const response = await apiFetch<{ data: { checkout: CheckoutView | null } }>(
        `/api/v1/public/checkout/${encodeURIComponent(token)}/trxid`,
        { method: "POST", body: { provider: account.provider, trxId: cleaned } },
      );
      if (response.data.checkout) onView(response.data.checkout);
    } catch (caught) {
      setFailures((count) => count + 1);
      if (caught instanceof ApiError && caught.code === "TRXID_ALREADY_USED") setUsedOpen(true);
      setError(
        caught instanceof ApiError
          ? caught.status === 429
            ? "Too many tries. Wait a minute and try again."
            : caught.message
          : "We could not send your TrxID. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5" noValidate>
      {view.providers.length > 1 ? (
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-soft" id="provider-label">
            Pay with
          </p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="provider-label">
            {view.providers.map((item) => {
              const selected = item.provider === provider;
              return (
                <button
                  key={item.provider}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setProvider(item.provider)}
                  className={cn(
                    "flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
                    selected
                      ? "border-brand-link bg-brand-tint text-brand-ink"
                      : "border-line-strong bg-surface text-ink hover:bg-elevated",
                  )}
                >
                  <ProviderLogo provider={item.provider} size="sm" />
                  {PROVIDER_NAME[item.provider]}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <ol className="flex flex-col gap-4 text-sm text-ink-soft">
        <li className="flex gap-3">
          <Step n={1} />
          <span className="pt-0.5">Open the {name} app.</span>
        </li>
        <li className="flex gap-3">
          <Step n={2} />
          <span className="pt-0.5">Choose <strong className="font-medium text-ink">Send Money</strong>.</span>
        </li>
        <li className="flex min-w-0 flex-1 gap-3">
          <Step n={3} />
          <div className="min-w-0 flex-1">
            <p className="pb-1.5 pt-0.5">Enter this number.</p>
            <CopyableValue value={account.accountNumber} label={`${name} number`} />
          </div>
        </li>
        <li className="flex min-w-0 flex-1 gap-3">
          <Step n={4} />
          <div className="min-w-0 flex-1">
            <p className="pb-1.5 pt-0.5">Send exactly this amount.</p>
            <CopyableValue
              value={(view.amountMinor / 100).toFixed(2)}
              label="Amount"
              className="[&_code]:text-sm [&_code]:font-semibold"
            />
          </div>
        </li>
        <li className="flex min-w-0 flex-1 gap-3">
          <Step n={5} />
          <div className="min-w-0 flex-1">
            <Label htmlFor="trxid" className="pt-0.5">
              Enter the TrxID from the confirmation message
            </Label>
            <Input
              id="trxid"
              value={trxId}
              onChange={(event) => setTrxId(event.target.value)}
              placeholder="e.g. DK3508MJ4R"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="font-mono uppercase"
              error={error}
            />
          </div>
        </li>
      </ol>

      {needsHelp ? <SupportLinks support={view.support} merchantName={view.merchantName} /> : null}

      <Modal
        open={usedOpen}
        onClose={() => setUsedOpen(false)}
        title="This TrxID has already been used"
        description="A payment has already been recorded with this TrxID."
        size="sm"
        footer={
          <Button type="button" onClick={() => setUsedOpen(false)}>
            Try another TrxID
          </Button>
        }
      >
        <div className="flex flex-col gap-4 text-sm text-ink-soft">
          <p>
            Check that you copied the TrxID from the confirmation message of the payment you just
            made. Each TrxID can be used only once.
          </p>
          <SupportLinks support={view.support} merchantName={view.merchantName} />
        </div>
      </Modal>

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" loading={busy} className="w-full">
          Confirm payment
        </Button>
        <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-ink-muted">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Press this only after you have sent the money. A different amount needs a manual check.
        </p>
      </div>
    </form>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[12px] font-semibold text-brand-ink"
    >
      {n}
    </span>
  );
}
