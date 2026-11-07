-- Each device gets its own token when it pairs. Devices paired before this
-- have none and must pair again.
ALTER TABLE "Device" ADD COLUMN "tokenHash" TEXT;
CREATE UNIQUE INDEX "Device_tokenHash_key" ON "Device"("tokenHash");
