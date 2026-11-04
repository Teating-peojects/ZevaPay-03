"use client";

import { PageHeader } from "@/components/layout/page-header";
import { ApiKeysPanel } from "./api-keys-panel";

export default function DevelopersPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="API keys"
        description="Keys let your own systems read your recorded transactions. A secret is shown once, when you create the key."
      />
      <ApiKeysPanel />
    </div>
  );
}
