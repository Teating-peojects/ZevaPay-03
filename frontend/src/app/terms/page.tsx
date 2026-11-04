import type { Metadata } from "next";
import { StaticPage } from "@/components/marketing/static-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that apply when you use ZevaPay.",
};

export default function TermsPage() {
  return (
    <StaticPage
      title="Terms of Service"
      intro="These are the terms that would apply to your use of ZevaPay, written for the product as it is intended to behave."
      sections={[
        {
          heading: "Using ZevaPay",
          body: "You may use ZevaPay to record and review payments received through your own mobile financial services accounts. You are responsible for the accuracy of the information you enter, including account numbers and labels, and for keeping access to your account secure.",
        },
        {
          heading: "Your devices",
          body: "You are responsible for the Android devices running the ZevaPay SMS Bridge app. Keep them physically secure, and disconnect a device from the dashboard if you lose access to it. A disconnected device stops contributing records but remains your responsibility.",
        },
        {
          heading: "No payment processing",
          body: "ZevaPay is a record-keeping tool. It does not process, hold, or transfer money, does not verify that a payment was settled, and is not a substitute for the records your provider gives you. Confirmations shown in the interface reflect the notification that was recorded, not a settlement guarantee.",
        },
        {
          heading: "Availability",
          body: "The service is provided as-is. Features described in the interface may change or be unavailable while the product is being built, and an administrator may suspend a merchant account that is under review or that breaks these terms.",
        },
        {
          heading: "Changes to these terms",
          body: "These terms may be updated as the service changes. Material changes will be notified to account holders before they take effect.",
        },
      ]}
    />
  );
}
