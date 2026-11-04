import type { Metadata } from "next";
import { StaticPage } from "@/components/marketing/static-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How ZevaPay handles the information it collects.",
};

export default function PrivacyPage() {
  return (
    <StaticPage
      title="Privacy Policy"
      intro="This page explains the kinds of information ZevaPay would handle and why, in the shape the product is intended to work."
      sections={[
        {
          heading: "Information we collect",
          body: "Account information you provide directly, such as your name, business name, and email address. Payment account details you add, limited to the provider, account number, account type, and label you enter. And notification content collected by the Android app from the messages your provider sends.",
        },
        {
          heading: "What we never collect",
          body: "ZevaPay does not ask for, store, or transmit your mobile financial services PIN, OTP, or full banking credentials. We do not log into your provider account. Masked account numbers are shown in the interface so that you can identify an account without exposing the full number.",
        },
        {
          heading: "How records are used",
          body: "Transaction records are used to present your dashboard: totals, transaction lists, filters, and search results. They are not used to make payment decisions, and ZevaPay does not move or hold your funds.",
        },
        {
          heading: "Storage and retention",
          body: "Records are stored on the ZevaPay server. A merchant's records belong to that merchant, and a platform administrator can see across merchants only for support and platform administration. Every sign-in, pairing, and record change is written to an audit log so that the history of an account can be reviewed.",
        },
        {
          heading: "Your choices",
          body: "You can remove a payment account or disconnect a device from the dashboard at any time, and those entries are deleted from your account. You can revoke an API key at any time, which immediately stops it being accepted. A merchant whose account is suspended by an administrator can no longer sign in.",
        },
      ]}
    />
  );
}
