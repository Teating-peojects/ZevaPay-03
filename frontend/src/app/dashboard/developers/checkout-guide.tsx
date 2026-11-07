"use client";

import { Check, Copy } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

const CREATE = `curl -X POST https://YOUR-DOMAIN/api/v1/checkout/payments \\
  -H "Authorization: Bearer zp_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amountMinor": 300000,
    "currency": "BDT",
    "description": "Order #1182",
    "orderId": "1182",
    "returnUrl": "https://your-shop.example/thanks"
  }'`;

const STATUS = `curl https://YOUR-DOMAIN/api/v1/checkout/payments/PAYMENT_ID \\
  -H "Authorization: Bearer zp_live_YOUR_KEY"`;

function Snippet({ label, code }: { label: string; code: string }) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{label}</h3>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void copy(code)}
        >
          {copied ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-lg border border-line bg-surface-muted p-3 font-mono text-[12px] leading-relaxed text-ink">
        {code}
      </pre>
    </div>
  );
}

/** How a merchant's own site takes a payment through hosted checkout. */
export function CheckoutGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Accept payments on your site</CardTitle>
        <CardDescription>
          Your server creates a payment, then sends the customer to the link it
          returns. The customer pays with bKash or Nagad and enters the TrxID.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-soft">
          <li>Create a key above and keep it on your server only.</li>
          <li>Create a payment and redirect the customer to checkoutUrl.</li>
          <li>
            When they come back, ask the status call below before you mark the
            order paid. The link they return on is not proof of payment.
          </li>
        </ol>
        <Snippet label="1. Create a payment" code={CREATE} />
        <Snippet label="2. Check its status" code={STATUS} />
        <Alert tone="info">
          Amounts are in paisa: 300000 is ৳3,000. Confirmed means a recorded
          SMS matched the TrxID and amount. It is not verification by bKash or
          Nagad.
        </Alert>
      </CardContent>
    </Card>
  );
}
