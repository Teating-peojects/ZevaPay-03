-- Phone keys: a second kind of key that only lets a phone connect to the SMS
-- app (together with the merchant's email and password). Existing keys are
-- integration keys.
CREATE TYPE "ApiKeyKind" AS ENUM ('INTEGRATION', 'DEVICE');
ALTER TABLE "ApiKey" ADD COLUMN "kind" "ApiKeyKind" NOT NULL DEFAULT 'INTEGRATION';
