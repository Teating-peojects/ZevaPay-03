"use client";

import { PageHeader } from "@/components/layout/page-header";
import { ApiKeysPanel } from "./api-keys-panel";
import { WebhooksPanel } from "./webhooks-panel";
import { CheckoutGuide } from "./checkout-guide";

export default function DevelopersPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="API keys"
        description="Keys let your own server create payments and check their status. A secret is shown once, when you create the key."
      />
      <ApiKeysPanel />
      <WebhooksPanel />
      <CheckoutGuide />
    </div>
  );
}
