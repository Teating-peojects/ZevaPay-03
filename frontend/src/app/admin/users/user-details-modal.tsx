"use client";

import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { isPlatformRole, ROLE_LABELS } from "@/lib/roles";
import type { ApiUser } from "@/types/api";

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <span className="text-[13px] text-ink-muted">{label}</span>
      <span className="text-[13px] font-medium text-ink sm:text-right">
        {children}
      </span>
    </div>
  );
}

/** Read-only account record for the admin user details dialog. */
export function UserDetailsModal({
  user,
  onClose,
}: {
  user: ApiUser | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={user !== null}
      onClose={onClose}
      title="User details"
      description={user?.fullName}
      size="md"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-elevated"
        >
          Close
        </button>
      }
    >
      {user ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 rounded-lg border border-line bg-elevated px-4 py-4">
            <span className="text-[13px] text-ink-muted">Name</span>
            <span className="text-lg font-semibold tracking-tight text-ink">
              {user.fullName}
            </span>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge tone={isPlatformRole(user.role) ? "brand" : "neutral"}>
                {ROLE_LABELS[user.role]}
              </Badge>
              <Badge tone={user.isActive ? "success" : "danger"} dot>
                {user.isActive ? "Active" : "Deactivated"}
              </Badge>
            </div>
          </div>

          <div className="flex flex-col">
            <DetailRow label="User ID">{user.id}</DetailRow>
            <DetailRow label="Email">{user.email}</DetailRow>
            <DetailRow label="Phone">{user.phone ?? "Not provided"}</DetailRow>
            <DetailRow label="Merchant">
              {user.merchantName ?? "ZevaPay Platform"}
            </DetailRow>
            <DetailRow label="Signed up">
              {formatDateTime(user.createdAt)}
            </DetailRow>
            <DetailRow label="Last sign-in">
              {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never"}
            </DetailRow>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
