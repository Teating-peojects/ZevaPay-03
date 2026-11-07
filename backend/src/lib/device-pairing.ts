import { prisma } from "../db.js";
import { BadRequestError, NotFoundError } from "./errors.js";
import { generateDeviceToken, sha256 } from "./hash.js";

export interface PairInput {
  code: string;
  deviceId: string;
  deviceName?: string | undefined;
  androidVersion?: string | undefined;
}

/**
 * Pairs a device with a merchant using a single-use code, and issues the
 * device's token. The token is returned here once and only its hash is kept.
 * Pairing the same device again replaces its token, so the old one stops
 * working.
 *
 * The code is claimed with a conditional update first, so two devices racing
 * with the same code cannot both succeed.
 */
export async function pairDevice(input: PairInput) {
  const now = new Date();
  const pairing = await prisma.pairingCode.findUnique({
    where: { code: input.code.toUpperCase() },
  });

  if (!pairing) throw new NotFoundError("That pairing code is not recognised.");
  if (pairing.usedAt) throw new BadRequestError("That pairing code has already been used.");
  if (pairing.expiresAt.getTime() < now.getTime()) {
    throw new BadRequestError("That pairing code has expired.");
  }

  const existing = await prisma.device.findUnique({
    where: { deviceId: input.deviceId },
    select: { id: true, merchantId: true, name: true },
  });
  if (existing && existing.merchantId !== pairing.merchantId) {
    throw new BadRequestError("That device is already paired with another merchant.");
  }

  const token = generateDeviceToken();
  const tokenHash = sha256(token);

  const device = await prisma.$transaction(async (tx) => {
    const claimed = await tx.pairingCode.updateMany({
      where: { id: pairing.id, usedAt: null },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) {
      throw new BadRequestError("That pairing code has already been used.");
    }

    const saved = existing
      ? await tx.device.update({
          where: { id: existing.id },
          data: {
            tokenHash,
            status: "ONLINE",
            lastActiveAt: now,
            androidVersion: input.androidVersion,
            name: input.deviceName ?? existing.name,
            connectedAccountId: pairing.connectedAccountId,
          },
        })
      : await tx.device.create({
          data: {
            merchantId: pairing.merchantId,
            name: input.deviceName ?? input.deviceId,
            deviceId: input.deviceId,
            tokenHash,
            status: "ONLINE",
            androidVersion: input.androidVersion,
            connectedAccountId: pairing.connectedAccountId,
            lastActiveAt: now,
          },
        });

    await tx.pairingCode.update({ where: { id: pairing.id }, data: { deviceId: saved.id } });
    return saved;
  });

  return { device, token };
}
