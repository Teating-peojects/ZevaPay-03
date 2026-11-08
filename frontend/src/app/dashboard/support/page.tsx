import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Help & Support" };

const TOPICS = [
  {
    title: "Pair a device",
    body: "Make a phone key on the Devices page, then sign in to the SMS app with your email and password and enter the key on the phone that receives your provider notifications.",
    href: "/dashboard/devices",
    action: "Open devices",
  },
  {
    title: "A notification needs review",
    body: "When ZevaPay is not confident about a message, it is held for you to accept or reject on the Transactions page.",
    href: "/dashboard/transactions",
    action: "Open transactions",
  },
  {
    title: "What a confirmed status means",
    body: "ZevaPay reads the notification a provider sent. It does not verify the payment with the provider, so check your provider account before you release goods.",
  },
];

export default function SupportPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Help & Support" description="Answers to common questions." />

      <div className="grid gap-4 md:grid-cols-3">
        {TOPICS.map((topic) => (
          <Card key={topic.title}>
            <CardHeader>
              <CardTitle>{topic.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-[13px] leading-relaxed text-ink-muted">{topic.body}</p>
              {topic.href ? (
                <Link href={topic.href} className="text-[13px] font-medium text-brand-link hover:text-brand-link-hover">
                  {topic.action}
                </Link>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
