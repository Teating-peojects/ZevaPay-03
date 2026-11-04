-- AlterTable
ALTER TABLE "PairingCode" ADD COLUMN     "connectedAccountId" TEXT;

-- AddForeignKey
ALTER TABLE "PairingCode" ADD CONSTRAINT "PairingCode_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "PaymentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
