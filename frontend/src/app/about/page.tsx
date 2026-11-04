import type { Metadata } from "next";
import { StaticPage } from "@/components/marketing/static-page";

export const metadata: Metadata = {
  title: "About",
  description: "What ZevaPay is and who it is built for.",
};

export default function AboutPage() {
  return (
    <StaticPage
      title="About ZevaPay"
      intro="ZevaPay is a payment management tool for Bangladeshi merchants who receive money through mobile financial services."
      sections={[
        {
          heading: "The problem",
          body: "Most small merchants collect payments over bKash, Nagad, Rocket, and Upay without a reliable way to record them. The record lives in a phone's message thread, which is hard to search, hard to reconcile, and impossible to hand to an accountant at the end of the month.",
        },
        {
          heading: "What ZevaPay does",
          body: "A merchant connects the payment accounts they receive money into, pairs an Android device running the ZevaPay SMS Bridge app, and lets that app record the payment notifications the provider sends. The dashboard then turns those records into a searchable list with amounts, customers, providers, and statuses.",
        },
        {
          heading: "What ZevaPay does not do",
          body: "ZevaPay never asks for your provider PIN or OTP, never logs into your mobile financial services account on your behalf, and never moves your money. It reads the notifications you already receive so you can keep them organised.",
        },
        {
          heading: "How records are read",
          body: "Each notification is parsed to extract the amount, the sender, the provider reference, and any timestamp in the message. A confidence score decides whether the record is accepted automatically or sent to a review queue, where you accept or reject it yourself. A provider-reported failure and an outgoing debit are always accepted immediately, because there is nothing to decide about them.",
        },
        {
          heading: "What a confirmed record means",
          body: "A record that parsed cleanly is labelled as confirmed from SMS. The message matched, but it was not checked against the provider's own system, so it is not a settlement confirmation and it is not presented as one. Records that do not match cleanly stay in the review queue instead of being counted as paid.",
        },
        {
          heading: "Where records live",
          body: "Records are stored on the ZevaPay server, not in your browser. A merchant sees only the records belonging to their own business, and a platform administrator sees the whole picture across merchants.",
        },
        {
          heading: "What ZevaPay is not",
          body: "ZevaPay is not a payment service provider, it does not hold or transmit funds, and it does not claim regulatory approval it does not have. Providers set their own fees and terms for the accounts you connect, and those are separate from anything on a ZevaPay plan.",
        },
      ]}
    />
  );
}
