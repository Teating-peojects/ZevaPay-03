"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api-client";

type State = "idle" | "verifying" | "verified" | "failed";

/** Confirms the email address using the token from the verification link. */
export function VerifyEmailForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = React.useState<State>(token ? "verifying" : "idle");
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiFetch("/api/v1/auth/verify-email", { method: "POST", body: { token } })
      .then(() => {
        if (!cancelled) setState("verified");
      })
      .catch((caught) => {
        if (cancelled) return;
        setMessage(
          caught instanceof ApiError
            ? caught.message
            : "We could not reach the server. Try again.",
        );
        setState("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "verified") {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center rounded-lg border border-success-line bg-success-tint px-6 py-8 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-surface">
            <CircleCheck className="size-5 text-success-fg" aria-hidden="true" />
          </span>
          <p className="mt-4 text-[15px] font-semibold text-ink">Email verified</p>
        </div>
        <Link href="/dashboard" className="w-full">
          <Button className="w-full">Continue to the dashboard</Button>
        </Link>
      </div>
    );
  }

  if (state === "failed") {
    return <Alert tone="danger" title="We could not verify your email">{message}</Alert>;
  }

  if (state === "verifying") {
    return <p className="text-sm text-ink-muted">Verifying your email…</p>;
  }

  return (
    <Alert tone="warning" title="This link is incomplete">
      Open the verification link from your email again.
    </Alert>
  );
}
