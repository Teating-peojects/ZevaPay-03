-- How a merchant's customers can reach them (shown on the checkout page).
ALTER TABLE "Merchant"
  ADD COLUMN "supportWhatsapp" TEXT,
  ADD COLUMN "supportTelegram" TEXT,
  ADD COLUMN "supportFacebook" TEXT,
  ADD COLUMN "supportInstagram" TEXT;
