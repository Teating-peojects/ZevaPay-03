import { prisma } from "../db.js";
import { UnauthorizedDeviceError } from "./errors.js";
import { looksLikeDeviceToken, sha256 } from "./hash.js";

/** Reads `Authorization: Bearer zpd_…`. Returns null for anything else. */
export function readDeviceToken(headers: Record<string, unknown>): string | null {
  const header = headers["authorization"];
  if (typeof header !== "string") return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  const token = match?.[1];
  return token && looksLikeDeviceToken(token) ? token : null;
}

/**
 * Finds the device a request belongs to from its own token. Anything wrong
 * (no token, an unknown token, a body naming another device) is the same
 * answer, so a caller learns nothing about which part failed.
 *
 * `claimedDeviceId` is the identifier the body names, if any. It is checked
 * against the device the token belongs to, never used to find the device.
 */
export async function authenticateDevice(
  headers: Record<string, unknown>,
  claimedDeviceId?: string,
) {
  const token = readDeviceToken(headers);
  if (!token) throw new UnauthorizedDeviceError();

  const device = await prisma.device.findUnique({
    where: { tokenHash: sha256(token) },
    include: { connectedAccount: true },
  });
  if (!device) throw new UnauthorizedDeviceError();
  if (claimedDeviceId !== undefined && claimedDeviceId !== device.deviceId) {
    throw new UnauthorizedDeviceError();
  }
  return device;
}
