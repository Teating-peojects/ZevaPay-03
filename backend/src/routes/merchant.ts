import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { recordAudit } from "../lib/audit.js";
import { resolvePaymentAfterReview } from "../lib/payment-matching.js";
import { channels, eventHub } from "../lib/events.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../lib/errors.js";
import { generateApiKeySecret, generatePairingCode, sha256 } from "../lib/hash.js";
import {
  serializeAccount,
  serializeDevice,
  serializeTransaction,
  serializeUser,
} from "../lib/serializers.js";
import {
  accountStatusSchema,
  accountTypeSchema,
  deviceStatusSchema,
  paginationSchema,
  providerSchema,
  transactionStatusSchema,
} from "../schemas/common.js";

const MERCHANT_ROLES = [
  "MERCHANT_OWNER",
  "MERCHANT_ADMIN",
  "MERCHANT_MANAGER",
  "MERCHANT_VIEWER",
];
const MERCHANT_WRITE_ROLES = [
  "MERCHANT_OWNER",
  "MERCHANT_ADMIN",
  "MERCHANT_MANAGER",
];

const accountBodySchema = z.object({
  provider: providerSchema,
  accountNumber: z
    .string()
    .trim()
    .regex(/^01[3-9]\d{8}$/, "Enter a valid 11-digit Bangladeshi mobile number"),
  accountType: accountTypeSchema,
  label: z.string().trim().min(2, "A label is required").max(80),
});

const deviceBodySchema = z.object({
  name: z.string().trim().min(2, "A device name is required").max(80),
  connectedAccountId: z.string().trim().nullable().optional(),
});

export async function registerMerchantRoutes(app: FastifyInstance): Promise<void> {
  const auth = { preHandler: [app.authenticate] };
  const requireMerchant = { preHandler: [app.authenticate, app.requireRole(MERCHANT_ROLES)] };

  /**
   * Writes additionally require an approved merchant. A merchant that is
   * still under review can look at its data but cannot change anything.
   */
  const requireWrite = {
    preHandler: [
      app.authenticate,
      app.requireRole(MERCHANT_WRITE_ROLES),
      async (request: FastifyRequest) => {
        const merchantId = await app.resolveMerchantId(request);
        const merchant = await prisma.merchant.findUnique({
          where: { id: merchantId },
          select: { status: true },
        });

        if (!merchant) {
          throw new NotFoundError("This merchant could not be found.");
        }

        if (merchant.status === "SUSPENDED") {
          throw new ForbiddenError(
            "This account has been suspended. Contact ZevaPay support to restore access.",
          );
        }

        if (merchant.status !== "ACTIVE") {
          throw new ForbiddenError(
            "Your account is still being reviewed. You will be able to make changes once it is approved.",
          );
        }
      },
    ],
  };

  // ---------------------------------------------------------------------
  // GET /api/v1/merchant/overview
  // ---------------------------------------------------------------------
  app.get(
    "/api/v1/merchant/overview",
    requireMerchant,
    async (request, reply) => {
      const merchantId = await app.resolveMerchantId(request);

      const [merchant, totals, accounts, devices, reviewCount, recent] =
        await Promise.all([
          prisma.merchant.findUnique({ where: { id: merchantId } }),
          prisma.transaction.aggregate({
            where: { merchantId },
            _count: { _all: true },
            _sum: { amountMinor: true },
          }),
          prisma.paymentAccount.findMany({
            where: { merchantId },
            orderBy: { createdAt: "desc" },
          }),
          prisma.device.findMany({
            where: { merchantId },
            include: { connectedAccount: { select: { label: true } } },
            orderBy: { createdAt: "desc" },
          }),
          prisma.transaction.count({
            where: { merchantId, status: "REVIEW" },
          }),
          prisma.transaction.findMany({
            where: { merchantId },
            orderBy: { occurredAt: "desc" },
            take: 8,
            include: {
              account: { select: { label: true } },
              device: { select: { name: true } },
            },
          }),
        ]);

      if (!merchant) throw new NotFoundError("That merchant could not be found.");

      const byStatus = await prisma.transaction.groupBy({
        by: ["status"],
        where: { merchantId },
        _count: { _all: true },
      });

      const statusCounts = {
        success: 0,
        pending: 0,
        review: 0,
        failed: 0,
      };
      for (const row of byStatus) {
        if (row.status === "CONFIRMED") statusCounts.success = row._count._all;
        if (row.status === "PENDING") statusCounts.pending = row._count._all;
        if (row.status === "REVIEW") statusCounts.review = row._count._all;
        if (row.status === "FAILED") statusCounts.failed = row._count._all;
      }

      const totalAmount = (totals._sum.amountMinor ?? 0) / 100;
      const successRate =
        totals._count._all > 0
          ? Number(((statusCounts.success / totals._count._all) * 100).toFixed(1))
          : 0;

      // Daily activity for the last 7 days, used by the overview chart.
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      since.setDate(since.getDate() - 6);

      const rawActivity = await prisma.transaction.findMany({
        where: { merchantId, occurredAt: { gte: since } },
        select: { occurredAt: true, status: true },
      });

      const buckets = new Map<
        string,
        { success: number; pending: number; failed: number }
      >();
      for (let i = 0; i < 7; i += 1) {
        const day = new Date(since);
        day.setDate(since.getDate() + i);
        buckets.set(day.toISOString().slice(0, 10), {
          success: 0,
          pending: 0,
          failed: 0,
        });
      }
      for (const row of rawActivity) {
        const bucket = buckets.get(row.occurredAt.toISOString().slice(0, 10));
        if (!bucket) continue;
        if (row.status === "CONFIRMED") bucket.success += 1;
        else if (row.status === "FAILED") bucket.failed += 1;
        else bucket.pending += 1;
      }

      const activity = [...buckets.entries()].map(([date, value]) => ({
        label: date,
        success: value.success,
        pending: value.pending,
        failed: value.failed,
      }));

      const deviceCounts = { online: 0, offline: 0, pending: 0 };
      for (const device of devices) {
        if (device.status === "ONLINE") deviceCounts.online += 1;
        if (device.status === "OFFLINE") deviceCounts.offline += 1;
        if (device.status === "PENDING") deviceCounts.pending += 1;
      }

      return reply.send({
        merchant: {
          id: merchant.id,
          businessName: merchant.businessName,
          status: merchant.status,
          plan: merchant.plan,
          country: merchant.country,
        },
        stats: {
          totalTransactions: totals._count._all,
          successfulTransactions: statusCounts.success,
          pendingTransactions: statusCounts.pending,
          totalAmount,
          successRate,
          pendingReviews: reviewCount,
        },
        statusCounts,
        deviceCounts,
        activity,
        accounts: accounts.map(serializeAccount),
        devices: devices.map(serializeDevice),
        recentTransactions: recent.map(serializeTransaction),
      });
    },
  );

  // ---------------------------------------------------------------------
  // GET /api/v1/merchant/accounts
  // ---------------------------------------------------------------------
  app.get(
    "/api/v1/merchant/accounts",
    requireMerchant,
    async (request, reply) => {
      const merchantId = await app.resolveMerchantId(request);
      const query = z
        .object({
          q: z.string().trim().optional(),
          provider: providerSchema.optional(),
          status: accountStatusSchema.optional(),
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(50),
        })
        .parse(request.query);

      const where: Record<string, unknown> = { merchantId };
      if (query.provider) where.provider = query.provider;
      if (query.status) where.status = query.status;
      if (query.q) {
        where.OR = [
          { label: { contains: query.q, mode: "insensitive" } },
          { accountNumber: { contains: query.q } },
        ];
      }

      const [rows, total] = await Promise.all([
        prisma.paymentAccount.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        prisma.paymentAccount.count({ where }),
      ]);

      return reply.send({
        accounts: rows.map(serializeAccount),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        },
      });
    },
  );

  // ---------------------------------------------------------------------
  // POST /api/v1/merchant/accounts
  // ---------------------------------------------------------------------
  app.post(
    "/api/v1/merchant/accounts",
    requireWrite,
    async (request, reply) => {
      const merchantId = await app.resolveMerchantId(request);
      const body = accountBodySchema.parse(request.body);

      const existing = await prisma.paymentAccount.findFirst({
        where: {
          merchantId,
          provider: body.provider,
          accountNumber: body.accountNumber,
        },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictError(
          "That payment account is already connected for this provider.",
        );
      }

      const account = await prisma.paymentAccount.create({
        data: {
          merchantId,
          provider: body.provider,
          accountNumber: body.accountNumber,
          accountType: body.accountType,
          label: body.label,
          status: "ACTIVE",
        },
      });

      await recordAudit({
        action: "ACCOUNT_CREATED",
        actorId: request.auth!.userId,
        merchantId,
        metadata: { accountId: account.id, provider: body.provider },
        ipAddress: request.ip,
      });

      eventHub.publish(
        channels.merchant(merchantId),
        "account.created",
        serializeAccount(account),
      );

      return reply.status(201).send({ account: serializeAccount(account) });
    },
  );

  // ---------------------------------------------------------------------
  // PATCH /api/v1/merchant/accounts/:id
  // ---------------------------------------------------------------------
  app.patch(
    "/api/v1/merchant/accounts/:id",
    requireWrite,
    async (request, reply) => {
      const merchantId = await app.resolveMerchantId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = z
        .object({
          label: z.string().trim().min(2).max(80).optional(),
          status: z.enum(["PENDING", "ACTIVE", "SUSPENDED"]).optional(),
          accountType: accountTypeSchema.optional(),
        })
        .parse(request.body);

      const account = await prisma.paymentAccount.findFirst({
        where: { id, merchantId },
      });
      if (!account) throw new NotFoundError("That payment account could not be found.");

      const updated = await prisma.paymentAccount.update({
        where: { id },
        data: body,
      });

      eventHub.publish(
        channels.merchant(merchantId),
        "account.updated",
        serializeAccount(updated),
      );

      return reply.send({ account: serializeAccount(updated) });
    },
  );

  // ---------------------------------------------------------------------
  // DELETE /api/v1/merchant/accounts/:id
  // ---------------------------------------------------------------------
  app.delete(
    "/api/v1/merchant/accounts/:id",
    requireWrite,
    async (request, reply) => {
      const merchantId = await app.resolveMerchantId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);

      const account = await prisma.paymentAccount.findFirst({
        where: { id, merchantId },
      });
      if (!account) throw new NotFoundError("That payment account could not be found.");

      await prisma.paymentAccount.delete({ where: { id } });

      await recordAudit({
        action: "ACCOUNT_REMOVED",
        actorId: request.auth!.userId,
        merchantId,
        metadata: { accountId: id, provider: account.provider },
        ipAddress: request.ip,
      });

      eventHub.publish(
        channels.merchant(merchantId),
        "account.removed",
        { id },
      );

      return reply.send({ ok: true });
    },
  );

  // ---------------------------------------------------------------------
  // GET /api/v1/merchant/devices
  // ---------------------------------------------------------------------
  app.get(
    "/api/v1/merchant/devices",
    requireMerchant,
    async (request, reply) => {
      const merchantId = await app.resolveMerchantId(request);
      const query = z
        .object({
          q: z.string().trim().optional(),
          status: deviceStatusSchema.optional(),
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(50),
        })
        .parse(request.query);

      const where: Record<string, unknown> = { merchantId };
      if (query.status) where.status = query.status;
      if (query.q) {
        where.OR = [
          { name: { contains: query.q, mode: "insensitive" } },
          { deviceId: { contains: query.q, mode: "insensitive" } },
        ];
      }

      const [rows, total] = await Promise.all([
        prisma.device.findMany({
          where,
          include: { connectedAccount: { select: { label: true } } },
          orderBy: { createdAt: "desc" },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        prisma.device.count({ where }),
      ]);

      return reply.send({
        devices: rows.map(serializeDevice),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        },
      });
    },
  );

  // ---------------------------------------------------------------------
  // POST /api/v1/merchant/devices/pairing-codes
  // ---------------------------------------------------------------------
  app.post(
    "/api/v1/merchant/devices/pairing-codes",
    requireWrite,
    async (request, reply) => {
      const merchantId = await app.resolveMerchantId(request);
      const body = z
        .object({ connectedAccountId: z.string().trim().nullable().optional() })
        .parse(request.body ?? {});

      if (body.connectedAccountId) {
        const account = await prisma.paymentAccount.findFirst({
          where: { id: body.connectedAccountId, merchantId },
          select: { id: true },
        });
        if (!account) {
          throw new NotFoundError("That payment account could not be found.");
        }
      }

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const pairing = await prisma.pairingCode.create({
        data: {
          merchantId,
          code: generatePairingCode(),
          expiresAt,
          connectedAccountId: body.connectedAccountId ?? null,
        },
      });

      return reply.status(201).send({
        pairingCode: {
          id: pairing.id,
          code: pairing.code,
          expiresAt: pairing.expiresAt.toISOString(),
          connectedAccountId: pairing.connectedAccountId ?? null,
        },
      });
    },
  );

  // ---------------------------------------------------------------------
  // PATCH /api/v1/merchant/devices/:id
  // ---------------------------------------------------------------------
  app.patch(
    "/api/v1/merchant/devices/:id",
    requireWrite,
    async (request, reply) => {
      const merchantId = await app.resolveMerchantId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = deviceBodySchema.parse(request.body);

      const device = await prisma.device.findFirst({ where: { id, merchantId } });
      if (!device) throw new NotFoundError("That device could not be found.");

      if (body.connectedAccountId) {
        const account = await prisma.paymentAccount.findFirst({
          where: { id: body.connectedAccountId, merchantId },
          select: { id: true },
        });
        if (!account) {
          throw new NotFoundError("That payment account could not be found.");
        }
      }

      const updated = await prisma.device.update({
        where: { id },
        data: {
          name: body.name ?? device.name,
          connectedAccountId:
            body.connectedAccountId === undefined
              ? device.connectedAccountId
              : body.connectedAccountId,
        },
        include: { connectedAccount: { select: { label: true } } },
      });

      eventHub.publish(
        channels.merchant(merchantId),
        "device.updated",
        serializeDevice(updated),
      );

      return reply.send({ device: serializeDevice(updated) });
    },
  );

  // ---------------------------------------------------------------------
  // DELETE /api/v1/merchant/devices/:id
  // ---------------------------------------------------------------------
  app.delete(
    "/api/v1/merchant/devices/:id",
    requireWrite,
    async (request, reply) => {
      const merchantId = await app.resolveMerchantId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);

      const device = await prisma.device.findFirst({ where: { id, merchantId } });
      if (!device) throw new NotFoundError("That device could not be found.");

      await prisma.device.delete({ where: { id } });

      await recordAudit({
        action: "DEVICE_DISCONNECTED",
        actorId: request.auth!.userId,
        merchantId,
        metadata: { deviceId: id, deviceIdentifier: device.deviceId },
        ipAddress: request.ip,
      });

      eventHub.publish(
        channels.merchant(merchantId),
        "device.removed",
        { id },
      );

      return reply.send({ ok: true });
    },
  );

  // ---------------------------------------------------------------------
  // GET /api/v1/merchant/transactions
  // ---------------------------------------------------------------------
  app.get(
    "/api/v1/merchant/transactions",
    requireMerchant,
    async (request, reply) => {
      const merchantId = await app.resolveMerchantId(request);
      const query = z
        .object({
          q: z.string().trim().optional(),
          status: transactionStatusSchema.optional(),
          provider: providerSchema.optional(),
          accountId: z.string().trim().optional(),
          from: z.string().trim().optional(),
          to: z.string().trim().optional(),
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
        })
        .parse(request.query);

      const where: Record<string, unknown> = { merchantId };
      if (query.status) where.status = query.status;
      if (query.provider) where.provider = query.provider;
      if (query.accountId) where.accountId = query.accountId;

      if (query.from || query.to) {
        const range: Record<string, Date> = {};
        if (query.from) {
          const from = new Date(query.from);
          if (!Number.isNaN(from.getTime())) range.gte = from;
        }
        if (query.to) {
          const to = new Date(query.to);
          if (!Number.isNaN(to.getTime())) {
            to.setHours(23, 59, 59, 999);
            range.lte = to;
          }
        }
        if (Object.keys(range).length) where.occurredAt = range;
      }

      if (query.q) {
        where.OR = [
          { reference: { contains: query.q, mode: "insensitive" } },
          { customerName: { contains: query.q, mode: "insensitive" } },
          { customerPhone: { contains: query.q } },
          { providerRef: { contains: query.q, mode: "insensitive" } },
          { rawNotification: { contains: query.q, mode: "insensitive" } },
        ];
      }

      const [rows, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          orderBy: { occurredAt: "desc" },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: {
            account: { select: { label: true } },
            device: { select: { name: true } },
          },
        }),
        prisma.transaction.count({ where }),
      ]);

      return reply.send({
        transactions: rows.map(serializeTransaction),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        },
      });
    },
  );

  // ---------------------------------------------------------------------
  // GET /api/v1/merchant/transactions/:id
  // ---------------------------------------------------------------------
  app.get(
    "/api/v1/merchant/transactions/:id",
    requireMerchant,
    async (request, reply) => {
      const merchantId = await app.resolveMerchantId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);

      const transaction = await prisma.transaction.findFirst({
        where: { id, merchantId },
        include: {
          account: { select: { label: true } },
          device: { select: { name: true } },
          reviewedBy: { select: { fullName: true } },
        },
      });
      if (!transaction) {
        throw new NotFoundError("That transaction could not be found.");
      }

      return reply.send({ transaction: serializeTransaction(transaction) });
    },
  );

  // ---------------------------------------------------------------------
  // POST /api/v1/merchant/transactions/:id/review
  // ---------------------------------------------------------------------
  app.post(
    "/api/v1/merchant/transactions/:id/review",
    requireWrite,
    async (request, reply) => {
      const merchantId = await app.resolveMerchantId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = z
        .object({
          decision: z.enum(["ACCEPT", "REJECT"]),
          note: z.string().trim().max(500).optional(),
        })
        .parse(request.body);

      const transaction = await prisma.transaction.findFirst({
        where: { id, merchantId },
      });
      if (!transaction) {
        throw new NotFoundError("That transaction could not be found.");
      }
      if (transaction.status !== "REVIEW") {
        throw new BadRequestError("That transaction is not awaiting review.");
      }

      // The notification and the payment it was matched to are decided
      // together, so they can never disagree.
      const { updated, paymentResult } = await prisma.$transaction(async (tx) => {
        const updated = await tx.transaction.update({
          where: { id },
          data: {
            status: body.decision === "ACCEPT" ? "CONFIRMED" : "FAILED",
            reviewedById: request.auth!.userId,
            reviewedAt: new Date(),
            confidence: body.decision === "ACCEPT" ? 1 : transaction.confidence,
          },
          include: {
            account: { select: { label: true } },
            device: { select: { name: true } },
            reviewedBy: { select: { fullName: true } },
          },
        });
        const paymentResult = await resolvePaymentAfterReview(tx, updated, body.decision);
        return { updated, paymentResult };
      });

      await recordAudit({
        action: "TRANSACTION_REVIEWED",
        actorId: request.auth!.userId,
        merchantId,
        metadata: { transactionId: id, decision: body.decision, note: body.note },
        ipAddress: request.ip,
      });

      if (paymentResult) {
        await recordAudit({
          action: "PAYMENT_STATUS_CHANGED",
          actorId: request.auth!.userId,
          merchantId: updated.merchantId,
          metadata: {
            paymentId: paymentResult.paymentId,
            status: paymentResult.status,
            source: "transaction_review",
            transactionId: updated.id,
            decision: body.decision,
          },
          ipAddress: request.ip,
        });
      }

      eventHub.publish(
        channels.merchant(merchantId),
        "transaction.reviewed",
        serializeTransaction(updated),
      );

      return reply.send({ transaction: serializeTransaction(updated) });
    },
  );

  // ---------------------------------------------------------------------
  // GET /api/v1/merchant/api-keys
  // ---------------------------------------------------------------------
  app.get(
    "/api/v1/merchant/api-keys",
    requireMerchant,
    async (request, reply) => {
      const merchantId = await app.resolveMerchantId(request);
      const keys = await prisma.apiKey.findMany({
        where: { merchantId },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({
        apiKeys: keys.map((key) => ({
          id: key.id,
          name: key.name,
          keyPrefix: key.keyPrefix,
          lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
          revokedAt: key.revokedAt?.toISOString() ?? null,
          expiresAt: key.expiresAt?.toISOString() ?? null,
          createdAt: key.createdAt.toISOString(),
        })),
      });
    },
  );

  // ---------------------------------------------------------------------
  // POST /api/v1/merchant/api-keys
  // ---------------------------------------------------------------------
  app.post(
    "/api/v1/merchant/api-keys",
    requireWrite,
    async (request, reply) => {
      const merchantId = await app.resolveMerchantId(request);
      const body = z
        .object({ name: z.string().trim().min(2, "A name is required").max(80) })
        .parse(request.body);

      // `Math.random()` is predictable and must never produce a credential.
      const secret = generateApiKeySecret();
      const keyPrefix = `${secret.slice(0, 12)}…`;

      const key = await prisma.apiKey.create({
        data: {
          merchantId,
          userId: request.auth!.userId,
          name: body.name,
          keyPrefix,
          keyHash: sha256(secret),
        },
      });

      await recordAudit({
        action: "API_KEY_CREATED",
        actorId: request.auth!.userId,
        merchantId,
        metadata: { apiKeyId: key.id, name: body.name },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        apiKey: {
          id: key.id,
          name: key.name,
          keyPrefix: key.keyPrefix,
          createdAt: key.createdAt.toISOString(),
        },
        // The only time the full key is ever returned.
        secret,
      });
    },
  );

  // ---------------------------------------------------------------------
  // DELETE /api/v1/merchant/api-keys/:id
  // ---------------------------------------------------------------------
  app.delete(
    "/api/v1/merchant/api-keys/:id",
    requireWrite,
    async (request, reply) => {
      const merchantId = await app.resolveMerchantId(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);

      const key = await prisma.apiKey.findFirst({ where: { id, merchantId } });
      if (!key) throw new NotFoundError("That API key could not be found.");

      await prisma.apiKey.update({
        where: { id },
        data: { revokedAt: new Date() },
      });

      await recordAudit({
        action: "API_KEY_REVOKED",
        actorId: request.auth!.userId,
        merchantId,
        metadata: { apiKeyId: id },
        ipAddress: request.ip,
      });

      return reply.send({ ok: true });
    },
  );

  // ---------------------------------------------------------------------
  // GET /api/v1/merchant/audit-logs
  // ---------------------------------------------------------------------
  app.get(
    "/api/v1/merchant/audit-logs",
    requireMerchant,
    async (request, reply) => {
      const merchantId = await app.resolveMerchantId(request);
      const query = paginationSchema.parse(request.query);

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: { merchantId },
          orderBy: { createdAt: "desc" },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: { actor: { select: { fullName: true } } },
        }),
        prisma.auditLog.count({ where: { merchantId } }),
      ]);

      return reply.send({
        logs: logs.map((log) => ({
          id: log.id,
          action: log.action,
          actorName: log.actor?.fullName ?? null,
          metadata: log.metadata,
          ipAddress: log.ipAddress,
          createdAt: log.createdAt.toISOString(),
        })),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        },
      });
    },
  );

  // ---------------------------------------------------------------------
  // GET /api/v1/merchant/team
  // ---------------------------------------------------------------------
  app.get(
    "/api/v1/merchant/team",
    requireMerchant,
    async (request, reply) => {
      const merchantId = await app.resolveMerchantId(request);
      const users = await prisma.user.findMany({
        where: { merchantId },
        include: { merchant: { select: { businessName: true } } },
        orderBy: { createdAt: "asc" },
      });
      return reply.send({ users: users.map(serializeUser) });
    },
  );

  // ---------------------------------------------------------------------
  // POST /api/v1/merchant/team
  // ---------------------------------------------------------------------
  app.post(
    "/api/v1/merchant/team",
    {
      preHandler: [
        app.authenticate,
        app.requireRole(["MERCHANT_OWNER", "MERCHANT_ADMIN"]),
      ],
    },
    async (request, reply) => {
      const merchantId = await app.resolveMerchantId(request);
      const body = z
        .object({
          email: z.string().trim().toLowerCase().email(),
          fullName: z.string().trim().min(2).max(120),
          role: z.enum([
            "MERCHANT_ADMIN",
            "MERCHANT_MANAGER",
            "MERCHANT_VIEWER",
          ]),
        })
        .parse(request.body);

      const existing = await prisma.user.findUnique({
        where: { email: body.email },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictError("An account with that email already exists.");
      }

      const user = await prisma.user.create({
        data: {
          email: body.email,
          fullName: body.fullName,
          role: body.role,
          merchantId,
          // Invited users have no usable password until they set one.
          passwordHash: "!invited",
        },
        include: { merchant: { select: { businessName: true } } },
      });

      return reply.status(201).send({ user: serializeUser(user) });
    },
  );

  // ---------------------------------------------------------------------
  // GET /api/v1/merchant/settings
  // ---------------------------------------------------------------------
  app.get(
    "/api/v1/merchant/settings",
    requireMerchant,
    async (request, reply) => {
      const merchantId = await app.resolveMerchantId(request);
      const merchant = await prisma.merchant.findUnique({
        where: { id: merchantId },
      });
      if (!merchant) throw new NotFoundError("That merchant could not be found.");

      return reply.send({
        merchant: {
          id: merchant.id,
          businessName: merchant.businessName,
          ownerName: merchant.ownerName,
          email: merchant.email,
          phone: merchant.phone,
          country: merchant.country,
          plan: merchant.plan,
          status: merchant.status,
          registrationDate: merchant.registrationDate.toISOString(),
          lastActiveAt: merchant.lastActiveAt.toISOString(),
        },
      });
    },
  );

  // ---------------------------------------------------------------------
  // PATCH /api/v1/merchant/settings
  // ---------------------------------------------------------------------
  app.patch(
    "/api/v1/merchant/settings",
    requireWrite,
    async (request, reply) => {
      const merchantId = await app.resolveMerchantId(request);
      const body = z
        .object({
          businessName: z.string().trim().min(2).max(120).optional(),
          ownerName: z.string().trim().min(2).max(120).optional(),
          phone: z
            .string()
            .trim()
            .regex(/^01[3-9]\d{8}$/, "Enter a valid 11-digit Bangladeshi mobile number")
            .optional(),
          country: z.string().trim().max(60).optional(),
        })
        .parse(request.body);

      const merchant = await prisma.merchant.update({
        where: { id: merchantId },
        data: body,
      });

      return reply.send({
        merchant: {
          id: merchant.id,
          businessName: merchant.businessName,
          ownerName: merchant.ownerName,
          email: merchant.email,
          phone: merchant.phone,
          country: merchant.country,
          plan: merchant.plan,
          status: merchant.status,
          registrationDate: merchant.registrationDate.toISOString(),
          lastActiveAt: merchant.lastActiveAt.toISOString(),
        },
      });
    },
  );

  // ---------------------------------------------------------------------
  // GET /api/v1/merchant/transactions/export
  // ---------------------------------------------------------------------
  app.get(
    "/api/v1/merchant/transactions/export",
    requireMerchant,
    async (request, reply) => {
      const merchantId = await app.resolveMerchantId(request);
      const rows = await prisma.transaction.findMany({
        where: { merchantId },
        orderBy: { occurredAt: "desc" },
        take: 5000,
      });

      const header = [
        "reference",
        "provider",
        "amount",
        "currency",
        "customer",
        "phone",
        "status",
        "confidence",
        "occurredAt",
      ];
      const lines = rows.map((row) =>
        [
          row.reference,
          row.provider,
          `${Math.floor(row.amountMinor / 100)}.${String(row.amountMinor % 100).padStart(2, "0")}`,
          "BDT",
          row.customerName ?? "",
          row.customerPhone ?? "",
          row.status,
          String(row.confidence),
          row.occurredAt.toISOString(),
        ]
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(","),
      );

      return reply
        .header(
          "content-type",
          "text/csv; charset=utf-8",
        )
        .header(
          "content-disposition",
          `attachment; filename="zevapay-transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
        )
        .send(`${[header.join(","), ...lines].join("\n")}`);
    },
  );
}
