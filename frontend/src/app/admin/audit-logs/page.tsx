"use client";

import { AuditLogView } from "@/components/shared/audit-log-view";

/** The platform audit trail: `GET /api/v1/admin/audit-logs`. */
export default function AdminAuditLogsPage() {
  return (
    <AuditLogView
      path="/api/v1/admin/audit-logs"
      showMerchant
      description="Every sensitive action taken on the platform, in the order it happened."
      totalHint="Across the whole platform"
    />
  );
}
