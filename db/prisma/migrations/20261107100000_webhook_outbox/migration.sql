-- Signed webhooks with a delivery queue.
ALTER TABLE "WebhookEndpoint" ADD COLUMN "secret" TEXT;

ALTER TABLE "WebhookDelivery"
  ADD COLUMN "paymentId" TEXT,
  ADD COLUMN "payload" JSONB,
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "lastError" TEXT,
  ADD COLUMN "deliveredAt" TIMESTAMP(3);

CREATE INDEX "WebhookDelivery_status_nextAttemptAt_idx" ON "WebhookDelivery"("status", "nextAttemptAt");
