import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { recordAudit } from "../lib/audit.js";
import { resolvePaymentAfterReview } from "../lib/payment-matching.js";
import { channels, eventHub } from "../lib/events.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../lib/errors.js";
import { serializeDevice, serializeMerchant, serializeTransaction, serializeUser } from "../lib/serializers.js";
import {
  deviceStatusSchema,
  paginationSchema,
  providerSchema,
  transactionStatusSchema,
} from "../schemas/common.js";

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  const admin = {
    preHandler: [app.authenticate, app.requireRole(["SUPER_ADMIN", "ADMIN"]), app.requirePermission("admin:manage")],
  };

  // ---------------------------------------------------------------------
  // GET /api/v1/admin/overview
  // ---------------------------------------------------------------------
  app.get("/api/v1/admin/overview", admin, async (_request, reply) => {
    const [merchantTotals, merchantCounts, transactionTotals, statusCounts, deviceCounts, recentMerchants, recentTransactions] =
      await Promise.all([
        prisma.merchant.count(),
        prisma.merchant.groupBy({
          by: ["status"],
          _count: { _all: true },
        }),
        prisma.transaction.aggregate({
          _count: { _all: true },
          _sum: { amountMinor: true },
        }),
        prisma.transaction.groupBy({
          by: ["status"],
          _count: { _all: true },
        }),
        prisma.device.groupBy({
          by: ["status"],
          _count: { _all: true },
        }),
        prisma.merchant.findMany({
          orderBy: { createdAt: "desc" },
          take: 6,
        }),
        prisma.transaction.findMany({
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            merchant: { select: { businessName: true } },
            account: { select: { label: true } },
            device: { select: { name: true } },
          },
        }),
      ]);

    const merchants = {
      active: 0,
      pendingReview: 0,
      suspended: 0,
    };
    for (const row of merchantCounts) {
      if (row.status === "ACTIVE") merchants.active = row._count._all;
      if (row.status === "PENDING_REVIEW") merchants.pendingReview = row._count._all;
      if (row.status === "SUSPENDED") merchants.suspended = row._count._all;
    }

    const transactions = {
      success: 0,
      pending: 0,
      review: 0,
      failed: 0,
    };
    for (const row of statusCounts) {
      if (row.status === "CONFIRMED") transactions.success = row._count._all;
      if (row.status === "PENDING") transactions.pending = row._count._all;
      if (row.status === "REVIEW") transactions.review = row._count._all;
      if (row.status === "FAILED") transactions.failed = row._count._all;
    }

    const devices = { online: 0, offline: 0, pending: 0 };
    for (const row of deviceCounts) {
      if (row.status === "ONLINE") devices.online = row._count._all;
      if (row.status === "OFFLINE") devices.offline = row._count._all;
      if (row.status === "PENDING") devices.pending = row._count._all;
    }

    // Daily activity for the last 14 days, used by the platform chart.
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 13);

    const rawActivity = await prisma.transaction.findMany({
      where: { occurredAt: { gte: since } },
      select: { occurredAt: true, status: true },
    });

    const buckets = new Map<string, { success: number; pending: number; failed: number }>();
    for (let i = 0; i < 14; i += 1) {
      const day = new Date(since);
      day.setDate(since.getDate() + i);
      buckets.set(day.toISOString().slice(0, 10), {
        success: 0,
        pending: 0,
        failed: 0,
      });
    }
    for (const row of rawActivity) {
      const key = row.occurredAt.toISOString().slice(0, 10);
      const bucket = buckets.get(key);
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

    return reply.send({
      stats: {
        totalMerchants: merchantTotals,
        activeMerchants: merchants.active,
        totalTransactions: transactionTotals._count._all,
        pendingReviews: transactions.review,
        totalAmount: (transactionTotals._sum.amountMinor ?? 0) / 100,
      },
      merchantCounts: merchants,
      transactionCounts: transactions,
      deviceCounts: devices,
      activity,
      recentMerchants: recentMerchants.map(serializeMerchant),
      recentTransactions: recentTransactions.map(serializeTransaction),
    });
  });

  // ---------------------------------------------------------------------
  // GET /api/v1/admin/merchants
  // ---------------------------------------------------------------------
  app.get("/api/v1/admin/merchants", admin, async (request, reply) => {
    const query = z
      .object({
        q: z.string().trim().optional(),
        status: z.enum(["PENDING_REVIEW", "ACTIVE", "SUSPENDED"]).optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(request.query);

    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.q) {
      where.OR = [
        { businessName: { contains: query.q, mode: "insensitive" } },
        { ownerName: { contains: query.q, mode: "insensitive" } },
        { email: { contains: query.q, mode: "insensitive" } },
        { phone: { contains: query.q } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.merchant.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.merchant.count({ where }),
    ]);

    return reply.send({
      merchants: rows.map(serializeMerchant),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    });
  });

  // ---------------------------------------------------------------------
  // PATCH /api/v1/admin/merchants/:id
  // ---------------------------------------------------------------------
  app.patch("/api/v1/admin/merchants/:id", admin, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z
      .object({
        status: z.enum(["PENDING_REVIEW", "ACTIVE", "SUSPENDED"]),
      })
      .parse(request.body);

    const merchant = await prisma.merchant.findUnique({ where: { id } });
    if (!merchant) throw new NotFoundError("That merchant could not be found.");
    if (merchant.status === body.status) {
      throw new BadRequestError("That merchant is already in that state.");
    }

    const updated = await prisma.merchant.update({
      where: { id },
      data: { status: body.status },
    });

    await recordAudit({
      action: "MERCHANT_STATUS_CHANGED",
      actorId: request.auth!.userId,
      merchantId: id,
      metadata: { from: merchant.status, to: body.status },
      ipAddress: request.ip,
    });

    eventHub.publish(channels.platform, "merchant.updated", serializeMerchant(updated));
    eventHub.publish(channels.merchant(id), "merchant.updated", serializeMerchant(updated));

    return reply.send({ merchant: serializeMerchant(updated) });
  });

  // ---------------------------------------------------------------------
  // GET /api/v1/admin/users
  // ---------------------------------------------------------------------
  app.get("/api/v1/admin/users", admin, async (request, reply) => {
    const query = z
      .object({
        q: z.string().trim().optional(),
        role: z.string().trim().optional(),
        isActive: z
          .enum(["true", "false"])
          .optional()
          .transform((value) =>
            value === undefined ? undefined : value === "true",
          ),
        merchantId: z.string().trim().optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(request.query);

    const where: Record<string, unknown> = {};
    if (query.role) where.role = query.role;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.merchantId) where.merchantId = query.merchantId;
    if (query.q) {
      where.OR = [
        { fullName: { contains: query.q, mode: "insensitive" } },
        { email: { contains: query.q, mode: "insensitive" } },
        { phone: { contains: query.q } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { merchant: { select: { businessName: true } } },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return reply.send({
      users: rows.map(serializeUser),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    });
  });

  // ---------------------------------------------------------------------
  // PATCH /api/v1/admin/users/:id
  // ---------------------------------------------------------------------
  app.patch("/api/v1/admin/users/:id", admin, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z
      .object({ isActive: z.boolean() })
      .parse(request.body);

    if (id === request.auth!.userId && !body.isActive) {
      throw new BadRequestError("You cannot deactivate your own account.");
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: { merchant: { select: { businessName: true } } },
    });
    if (!user) throw new NotFoundError("That user could not be found.");

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: body.isActive },
      include: { merchant: { select: { businessName: true } } },
    });

    // Deactivating a user must terminate their sessions immediately.
    if (!body.isActive) {
      await prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    eventHub.publish(channels.platform, "user.updated", serializeUser(updated));

    return reply.send({ user: serializeUser(updated) });
  });

  // ---------------------------------------------------------------------
  // GET /api/v1/admin/transactions
  // ---------------------------------------------------------------------
  app.get("/api/v1/admin/transactions", admin, async (request, reply) => {
    const query = z
      .object({
        q: z.string().trim().optional(),
        status: transactionStatusSchema.optional(),
        provider: providerSchema.optional(),
        merchantId: z.string().trim().optional(),
        from: z.string().trim().optional(),
        to: z.string().trim().optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(request.query);

    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.provider) where.provider = query.provider;
    if (query.merchantId) where.merchantId = query.merchantId;

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
        { merchant: { businessName: { contains: query.q, mode: "insensitive" } } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          merchant: { select: { businessName: true } },
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
  });

  // ---------------------------------------------------------------------
  // POST /api/v1/admin/transactions/:id/review
  // ---------------------------------------------------------------------
  app.post(
    "/api/v1/admin/transactions/:id/review",
    admin,
    async (request, reply) => {
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = z
        .object({
          decision: z.enum(["ACCEPT", "REJECT"]),
          note: z.string().trim().max(500).optional(),
        })
        .parse(request.body);

      const transaction = await prisma.transaction.findUnique({ where: { id } });
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
            merchant: { select: { businessName: true } },
            account: { select: { label: true } },
            device: { select: { name: true } },
          },
        });
        const paymentResult = await resolvePaymentAfterReview(tx, updated, body.decision);
        return { updated, paymentResult };
      });

      await recordAudit({
        action: "TRANSACTION_REVIEWED",
        actorId: request.auth!.userId,
        merchantId: transaction.merchantId,
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
        channels.merchant(transaction.merchantId),
        "transaction.reviewed",
        serializeTransaction(updated),
      );
      eventHub.publish(channels.platform, "transaction.reviewed", serializeTransaction(updated));

      return reply.send({ transaction: serializeTransaction(updated) });
    },
  );

  // ---------------------------------------------------------------------
  // GET /api/v1/admin/devices
  // ---------------------------------------------------------------------
  app.get("/api/v1/admin/devices", admin, async (request, reply) => {
    const query = z
      .object({
        q: z.string().trim().optional(),
        status: deviceStatusSchema.optional(),
        merchantId: z.string().trim().optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(request.query);

    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.merchantId) where.merchantId = query.merchantId;
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: "insensitive" } },
        { deviceId: { contains: query.q, mode: "insensitive" } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.device.findMany({
        where,
        orderBy: { lastActiveAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          connectedAccount: { select: { label: true } },
          merchant: { select: { businessName: true } },
        },
      }),
      prisma.device.count({ where }),
    ]);

    return reply.send({
      devices: rows.map((device) => ({
        ...serializeDevice(device),
        merchantName: device.merchant?.businessName ?? null,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    });
  });

  // ---------------------------------------------------------------------
  // DELETE /api/v1/admin/devices/:id
  // ---------------------------------------------------------------------
  app.delete("/api/v1/admin/devices/:id", admin, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);

    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) throw new NotFoundError("That device could not be found.");

    await prisma.device.delete({ where: { id } });

    await recordAudit({
      action: "DEVICE_DISCONNECTED",
      actorId: request.auth!.userId,
      merchantId: device.merchantId,
      metadata: { deviceId: id, deviceIdentifier: device.deviceId },
      ipAddress: request.ip,
    });

    eventHub.publish(channels.platform, "device.removed", { id });
    eventHub.publish(channels.merchant(device.merchantId), "device.removed", { id });

    return reply.send({ ok: true });
  });

  // ---------------------------------------------------------------------
  // GET /api/v1/admin/audit-logs
  // ---------------------------------------------------------------------
  app.get("/api/v1/admin/audit-logs", admin, async (request, reply) => {
    const query = paginationSchema.parse(request.query);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          actor: { select: { fullName: true } },
          merchant: { select: { businessName: true } },
        },
      }),
      prisma.auditLog.count(),
    ]);

    return reply.send({
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        actorName: log.actor?.fullName ?? null,
        merchantName: log.merchant?.businessName ?? null,
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
  });

  // ---------------------------------------------------------------------
  // GET /api/v1/admin/settings
  // ---------------------------------------------------------------------
  app.get("/api/v1/admin/settings", admin, async (_request, reply) => {
    const [merchantCount, userCount, deviceCount, transactionCount] =
      await Promise.all([
        prisma.merchant.count(),
        prisma.user.count(),
        prisma.device.count(),
        prisma.transaction.count(),
      ]);

    return reply.send({
      system: {
        merchants: merchantCount,
        users: userCount,
        devices: deviceCount,
        transactions: transactionCount,
        environment: process.env.NODE_ENV ?? "development",
      },
    });
  });

  // ---------------------------------------------------------------------
  // POST /api/v1/admin/merchants  — create a merchant and its owner
  // ---------------------------------------------------------------------
  app.post("/api/v1/admin/merchants", admin, async (request, reply) => {
    const body = z
      .object({
        businessName: z.string().trim().min(2).max(120),
        ownerName: z.string().trim().min(2).max(120),
        email: z.string().trim().toLowerCase().email(),
        phone: z
          .string()
          .trim()
          .regex(/^01[3-9]\d{8}$/, "Enter a valid 11-digit Bangladeshi mobile number")
          .optional(),
        status: z.enum(["PENDING_REVIEW", "ACTIVE", "SUSPENDED"]).default("ACTIVE"),
      })
      .parse(request.body);

    const existing = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError("An account with that email already exists.");
    }

    const merchant = await prisma.merchant.create({
      data: {
        businessName: body.businessName,
        ownerName: body.ownerName,
        email: body.email,
        phone: body.phone,
        status: body.status,
        users: {
          create: {
            email: body.email,
            fullName: body.ownerName,
            phone: body.phone,
            role: "MERCHANT_OWNER",
            passwordHash: "!invited",
          },
        },
      },
    });

    return reply.status(201).send({ merchant: serializeMerchant(merchant) });
  });
}
