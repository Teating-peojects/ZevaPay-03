import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Set a new password for your ZevaPay account.",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Pick a password you have not used before. You will be signed out of other devices."
      footer={
        <>
          Remembered it after all?{" "}
          <Link
            href="/login"
            className="font-medium text-brand-link underline underline-offset-2 hover:text-brand-link-hover"
          >
            Back to login
          </Link>
        </>
      }
    >
      <React.Suspense fallback={null}>
        <ResetPasswordForm />
      </React.Suspense>
    </AuthShell>
  );
}
