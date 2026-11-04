import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Request a password reset link for your ZevaPay account.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email address on your account and we will show you what happens next."
      footer={
        <>
          Remembered your password?{" "}
          <Link
            href="/login"
            className="font-medium text-brand-link underline underline-offset-2 hover:text-brand-link-hover"
          >
            Back to login
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
