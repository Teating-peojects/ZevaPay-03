"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { CopyableValue } from "@/components/shared/copyable-value";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";
import type { ApiAppDownload } from "@/types/api";

const STEPS = [
  "Open this page on the Android phone that receives your payment SMS, and tap Download.",
  "When the download finishes, open the file. Android will ask you to allow installs from your browser. Allow it for this one install.",
  "Open ZevaPay SMS and tap Allow SMS. Also allow it to run in the background, so no payment is missed.",
  "In the dashboard open Devices, choose a payment account and create a pairing code.",
  "In the app enter your ZevaPay address (shown below) and the pairing code, then tap Connect.",
];

export default function PhoneAppPage() {
  const [info, setInfo] = React.useState<ApiAppDownload["android"] | null>(null);
  const [failed, setFailed] = React.useState(false);
  // The address of this site, read in the browser only.
  const origin = React.useSyncExternalStore(
    () => () => undefined,
    () => window.location.origin,
    () => "",
  );

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await apiFetch<ApiAppDownload>("/api/v1/merchant/app");
        if (!cancelled) setInfo(response.android);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Phone app"
        description="Install the ZevaPay SMS app on the phone that receives your bKash, Nagad, Rocket and Upay messages."
      />

      {failed ? <Alert tone="danger">We could not load the download. Please try again.</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>ZevaPay SMS for Android</CardTitle>
          <CardDescription>
            It sends only payment SMS from bKash, Nagad, Rocket (16216) and Upay to your account. Other
            messages never leave the phone. ZevaPay decides whether a payment matches, not the app.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {info === null && !failed ? <div className="h-11 w-48 animate-pulse rounded-lg bg-elevated" /> : null}

          {info?.available && info.url ? (
            <div className="flex flex-col gap-2">
              <a
                href={info.url}
                download
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-solid px-5 text-[15px] font-medium text-white shadow-sm transition-colors hover:bg-brand-solid-hover sm:w-fit"
              >
                <Download className="size-4" aria-hidden="true" />
                Download for Android
              </a>
              {info.version ? <p className="text-[12px] text-ink-muted">Version {info.version}</p> : null}
            </div>
          ) : null}

          {info && !info.available ? (
            <Alert tone="info" title="The app is not available yet">
              The download will appear here as soon as it is ready. Nothing else needs to be done now.
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How to set it up</CardTitle>
          <CardDescription>It takes about two minutes.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ol className="flex flex-col gap-3 text-sm text-ink-soft">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[12px] font-semibold text-brand-ink"
                >
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          {origin ? (
            <div className="flex max-w-md flex-col gap-1.5">
              <p className="text-[13px] font-medium text-ink">Your ZevaPay address</p>
              <CopyableValue value={origin} label="ZevaPay address" />
            </div>
          ) : null}
          <Alert tone="warning" title="Install it only from this page">
            Android shows a warning for apps that do not come from the Play Store. That is expected here.
            Do not install a copy that someone sends you in a chat or from another site.
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
