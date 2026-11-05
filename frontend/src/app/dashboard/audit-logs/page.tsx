"use client";

import { AuditLogView, ACTION_OPTIONS } from "@/components/shared/audit-log-view";

/** Actions only a platform admin takes, so a merchant never sees them. */
const MERCHANT_ACTION_OPTIONS = ACTION_OPTIONS.filter(
  (option) => option.value !== "MERCHANT_STATUS_CHANGED",
);

/** The merchant's own audit trail: `GET /api/v1/merchant/audit-logs`. */
export default function MerchantAuditLogsPage() {
  return (
    <AuditLogView
      path="/api/v1/merchant/audit-logs"
      showMerchant={false}
      description="Sensitive actions taken in your business, such as sign-ins, API keys, devices and payment reviews."
      totalHint="Across your business"
      actionOptions={MERCHANT_ACTION_OPTIONS}
    />
  );
}
