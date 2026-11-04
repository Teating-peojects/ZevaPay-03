import type { AuditAction, Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db.js";

interface AuditInput {
  action: AuditAction;
  actorId?: string | null;
  merchantId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

/**
 * Writes an audit entry. Audit failures never break the request that caused
 * them — they are logged and swallowed.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        actorId: input.actorId ?? null,
        merchantId: input.merchantId ?? null,
        metadata: input.metadata ?? undefined,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] failed to write audit log", error);
  }
}
