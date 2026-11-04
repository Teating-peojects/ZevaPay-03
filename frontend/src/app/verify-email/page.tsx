import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailForm } from "./verify-email-form";

export const metadata: Metadata = {
  title: "Verify your email",
  description: "Confirm the email address on your ZevaPay account.",
};

export default function VerifyEmailPage() {
  return (
    <AuthShell
      title="Verify your email"
      subtitle="Confirming the address on your account keeps your payment records and notifications reaching you."
      footer={
        <>
          Already verified?{" "}
          <Link
            href="/dashboard"
            className="font-medium text-brand-link underline underline-offset-2 hover:text-brand-link-hover"
          >
            Go to the dashboard
          </Link>
        </>
      }
    >
      <React.Suspense fallback={null}>
        <VerifyEmailForm />
      </React.Suspense>
    </AuthShell>
  );
}
