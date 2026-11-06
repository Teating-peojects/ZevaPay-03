-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "checkoutTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_checkoutTokenHash_key" ON "Payment"("checkoutTokenHash");
