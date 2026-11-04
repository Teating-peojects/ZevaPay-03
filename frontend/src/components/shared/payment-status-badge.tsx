import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { statusDisplay, type PaymentStatus } from "@/lib/payment-status";

/**
 * The status badge for the eight product statuses.
 *
 * The wording comes from `@/lib/payment-status`, the single place that decides
 * each status's label and tone. The most important rule it enforces:
 * `CONFIRMED` reads "Confirmed from SMS", never "Verified" — a parser match
 * is not proof of payment.
 */
export function PaymentStatusBadge({
  status,
  showTooltip = true,
}: {
  status: PaymentStatus;
  showTooltip?: boolean;
}) {
  const display = statusDisplay(status);

  const badge = (
    <Badge tone={display.tone} dot>
      {display.label}
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <Tooltip content={display.description}>{badge}</Tooltip>
  );
}
