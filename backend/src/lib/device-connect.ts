import { prisma } from "../db.js";
import { AppError, ForbiddenError } from "./errors.js";
import { generateDeviceToken, looksLikeDeviceKey, sha256 } from "./hash.js";
import { verifyPassword } from "./password.js";

export interface ConnectInput {
  email: string;
  password: string;
  deviceKey: string;
  deviceId: string;
  deviceName?: string | undefined;
  androidVersion?: string | undefined;
}

/** The phone shows a different message for each, so they have their own codes. */
export class InvalidCredentialsError extends AppError {
  constructor() {
    super(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }
}
export class InvalidDeviceKeyError extends AppError {
  constructor() {
    super(
      401,
      "INVALID_DEVICE_KEY",
      "That phone key is not valid. Make a new one on the ZevaPay website.",
    );
  }
}

/**
 * Connects a phone to a merchant and issues the device's own token.
 *
 * Three things must all be right: the merchant's email and password, and a
 * phone key that belongs to that same merchant and has not been revoked. The
 * email and password say who is connecting; the phone key says the merchant
 * meant to. The token is returned once and only its hash is kept; connecting
 * the same phone again replaces its token, so the old one stops working.
 */
export async function connectDevice(input: ConnectInput, now: Date = new Date()) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    include: { merchant: true },
  });

  // The same answer whether the email is unknown or the password is wrong.
  const passwordOk =
    !!user && user.isActive && (await verifyPassword(input.password, user.passwordHash));
  if (!user || !passwordOk || !user.merchantId || !user.merchant) {
    throw new InvalidCredentialsError();
  }
  if (user.merchant.status !== "ACTIVE") {
    throw new ForbiddenError("This merchant account is not active.");
  }
  const merchantId = user.merchantId;

  const key = looksLikeDeviceKey(input.deviceKey)
    ? await prisma.apiKey.findUnique({ where: { keyHash: sha256(input.deviceKey) } })
    : null;
  if (
    !key ||
    key.kind !== "DEVICE" ||
    key.merchantId !== merchantId ||
    key.revokedAt ||
    (key.expiresAt && key.expiresAt <= now)
  ) {
    throw new InvalidDeviceKeyError();
  }

  const existing = await prisma.device.findUnique({
    where: { deviceId: input.deviceId },
    select: { id: true, merchantId: true, name: true },
  });
  if (existing && existing.merchantId !== merchantId) {
    throw new ForbiddenError("That phone is already connected to another merchant.");
  }

  const token = generateDeviceToken();
  const tokenHash = sha256(token);

  const device = existing
    ? await prisma.device.update({
        where: { id: existing.id },
        data: {
          tokenHash,
          status: "ONLINE",
          lastActiveAt: now,
          androidVersion: input.androidVersion,
          name: input.deviceName ?? existing.name,
        },
      })
    : await prisma.device.create({
        data: {
          merchantId,
          name: input.deviceName ?? input.deviceId,
          deviceId: input.deviceId,
          tokenHash,
          status: "ONLINE",
          androidVersion: input.androidVersion,
          lastActiveAt: now,
        },
      });

  await prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: now } })
    .catch(() => undefined);

  return { device, token, userId: user.id, merchantId, keyId: key.id };
}
