import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import { generateTransactionReference } from "../lib/hash.js";
import { recordAudit } from "../lib/audit.js";
import { canTransitionPaymentStatus } from "../lib/payment-state.js";
import { CHECKOUT_PROVIDERS } from "../lib/payment-matching.js";
import { submitTrxId } from "../lib/payment-attempts.js";
import { paymentStatusSchema, paginationSchema } from "../schemas/common.js";

const createSchema = z.object({
  amountMinor: z.number().int().positive().max(2_000_000_000),
  currency: z.string().trim().length(3).default("BDT").transform((v) => v.toUpperCase()),
  description: z.string().trim().max(500).optional(),
  customerId: z.string().optional(),
  expiresAt: z.coerce.date().optional(),
});

const attemptSchema = z.object({
  provider: z.enum(CHECKOUT_PROVIDERS),
  trxId: z.string().trim().min(4).max(40),
});

export async function registerPaymentRoutes(app: FastifyInstance): Promise<void> {
  const read = { preHandler: [app.authenticate, app.requirePermission("payments:read")] };
  const write = { preHandler: [app.authenticate, app.requirePermission("payments:write")] };

  app.get("/api/v1/merchant/payments", read, async (request) => {
    const query = paginationSchema.extend({ status: paymentStatusSchema.optional() }).parse(request.query);
    const merchantId = await app.resolveMerchantId(request);
    const where = { merchantId, deletedAt: null, ...(query.status ? { status: query.status } : {}) };
    const [rows, total] = await Promise.all([
      prisma.payment.findMany({ where, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      prisma.payment.count({ where }),
    ]);
    return { data: rows, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  });

  app.post("/api/v1/merchant/payments", write, async (request, reply) => {
    const body = createSchema.parse(request.body);
    const merchantId = await app.resolveMerchantId(request);
    if (body.customerId) {
      const customer = await prisma.customer.findFirst({ where: { id: body.customerId, merchantId }, select: { id: true } });
      if (!customer) throw new NotFoundError("That customer could not be found.");
    }
    const payment = await prisma.payment.create({ data: {
      reference: generateTransactionReference(), merchantId, createdById: request.auth!.userId,
      amountMinor: body.amountMinor, currency: body.currency, description: body.description,
      customerId: body.customerId, expiresAt: body.expiresAt, status: "CREATED",
    } });
    await recordAudit({ action: "PAYMENT_CREATED", actorId: request.auth!.userId, merchantId, metadata: { paymentId: payment.id }, ipAddress: request.ip });
    return reply.status(201).send({ data: payment });
  });

  app.get<{ Params: { id: string } }>("/api/v1/merchant/payments/:id", read, async (request) => {
    const merchantId = await app.resolveMerchantId(request);
    const payment = await prisma.payment.findFirst({ where: { id: request.params.id, merchantId, deletedAt: null }, include: { attempts: { orderBy: { createdAt: "desc" } }, customer: true } });
    if (!payment) throw new NotFoundError("That payment could not be found.");
    return { data: payment };
  });

  /**
   * Records the TrxID a customer gave for a payment, then looks for the SMS
   * that proves it. See `submitTrxId` for the outcomes and the rules.
   */
  app.post<{ Params: { id: string } }>(
    "/api/v1/merchant/payments/:id/attempts",
    { ...write, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const merchantId = await app.resolveMerchantId(request);
      const body = attemptSchema.parse(request.body);

      const result = await submitTrxId({
        paymentId: request.params.id,
        merchantId,
        provider: body.provider,
        trxId: body.trxId,
        actorId: request.auth!.userId,
        ipAddress: request.ip,
      });

      const fresh = await prisma.payment.findUnique({
        where: { id: request.params.id },
        include: { attempts: { orderBy: { createdAt: "desc" } } },
      });

      return reply.status(201).send({
        data: { payment: fresh, attemptId: result.attemptId, match: result.match },
      });
    },
  );

  app.patch<{ Params: { id: string } }>("/api/v1/merchant/payments/:id/status", write, async (request) => {
    const merchantId = await app.resolveMerchantId(request);
    const body = z.object({ status: paymentStatusSchema }).parse(request.body);
    if (body.status === "CONFIRMED" || body.status === "REFUNDED") throw new ConflictError("Payment confirmation and refunds require a verified workflow, which is not enabled.");
    const current = await prisma.payment.findFirst({ where: { id: request.params.id, merchantId, deletedAt: null }, select: { id: true, status: true } });
    if (!current) throw new NotFoundError("That payment could not be found.");
    if (!canTransitionPaymentStatus(current.status, body.status)) throw new ConflictError("That payment status transition is not allowed.");
    const changed = await prisma.payment.updateMany({ where: { id: current.id, merchantId }, data: { status: body.status } });
    if (changed.count !== 1) throw new NotFoundError("That payment could not be found.");
    const updated = await prisma.payment.findFirst({ where: { id: current.id, merchantId } });
    if (!updated) throw new NotFoundError("That payment could not be found.");
    await recordAudit({ action: "PAYMENT_STATUS_CHANGED", actorId: request.auth!.userId, merchantId, metadata: { paymentId: current.id, status: body.status }, ipAddress: request.ip });
    return { data: updated };
  });
}
