import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { statusDisplay } from "@/lib/payment-status";
import type {
  AccountStatus,
  DeviceStatus,
  MerchantStatus,
  TransactionStatus,
} from "@/types/api";

/**
 * Status badges. Every state the API can return has a label and a tone, so
 * a record can never render as an unknown value.
 */

/**
 * The status badge for a transaction read from the API.
 *
 * The wording comes from `@/lib/payment-status`, the same vocabulary the payments
 * screen uses, so a live transaction and a sample one read identically.
 * That matters for the rule this product depends on: a parser match is not
 * proof of payment, so a confirmed record reads "Confirmed from SMS" and
 * never "Success" or "Verified".
 */
export function TransactionStatusBadge({
  status,
}: {
  status: TransactionStatus;
}) {
  const display = statusDisplay(status);

  return (
    <Tooltip content={display.description}>
      <Badge tone={display.tone} dot>
        {display.label}
      </Badge>
    </Tooltip>
  );
}

const accountConfig: Record<
  AccountStatus,
  { label: string; tone: "success" | "warning" | "danger" }
> = {
  ACTIVE: { label: "Active", tone: "success" },
  PENDING: { label: "Pending", tone: "warning" },
  SUSPENDED: { label: "Suspended", tone: "danger" },
};

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const config = accountConfig[status];
  return (
    <Badge tone={config.tone} dot>
      {config.label}
    </Badge>
  );
}

const deviceConfig: Record<
  DeviceStatus,
  { label: string; tone: "success" | "neutral" | "warning" }
> = {
  ONLINE: { label: "Online", tone: "success" },
  OFFLINE: { label: "Offline", tone: "neutral" },
  PENDING: { label: "Pending", tone: "warning" },
};

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const config = deviceConfig[status];
  return (
    <Badge tone={config.tone} dot>
      {config.label}
    </Badge>
  );
}

const merchantConfig: Record<
  MerchantStatus,
  { label: string; tone: "success" | "warning" | "danger" }
> = {
  ACTIVE: { label: "Active", tone: "success" },
  PENDING_REVIEW: { label: "In Review", tone: "warning" },
  SUSPENDED: { label: "Suspended", tone: "danger" },
};

export function MerchantStatusBadge({ status }: { status: MerchantStatus }) {
  const config = merchantConfig[status];
  return (
    <Badge tone={config.tone} dot>
      {config.label}
    </Badge>
  );
}
