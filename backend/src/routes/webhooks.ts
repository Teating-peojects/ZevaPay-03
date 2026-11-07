import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { sha256 } from "../lib/hash.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../lib/errors.js";
import {
  MAX_ENDPOINTS_PER_MERCHANT,
  SUBSCRIBABLE_EVENTS,
  newWebhookSecret,
  validateWebhookUrl,
} from "../lib/webhooks.js";
import { randomBytes } from "node:crypto";

const READ_ROLES = ["MERCHANT_OWNER", "MERCHANT_ADMIN", "MERCHANT_MANAGER", "MERCHANT_VIEWER"];
const WRITE_ROLES = ["MERCHANT_OWNER", "MERCHANT_ADMIN", "MERCHANT_MANAGER"];

const createSchema = z.object({
  url: z.string().trim().min(1).max(500),
  events: z.array(z.enum(SUBSCRIBABLE_EVENTS)).min(1).max(SUBSCRIBABLE_EVENTS.length).optional(),
});

const idParams = z.object({ id: z.string().min(1) });

function view(endpoint: {
  id: string; url: string; events: string[]; isActive: boolean; createdAt: Date;
}) {
  return {
    id: endpoint.id,
    url: endpoint.url,
    events: endpoint.events,
    isActive: endpoint.isActive,
    createdAt: endpoint.createdAt.toISOString(),
  };
}

export async function registerWebhookRoutes(app: FastifyInstance): Promise<void> {
  const read = { preHandler: [app.authenticate, app.requireRole(READ_ROLES)] };
  // Same rule as the rest of the merchant API: only an approved merchant changes things.
  const write = {
    preHandler: [
      app.authenticate,
      app.requireRole(WRITE_ROLES),
      async (request: FastifyRequest) => {
        const merchantId = await app.resolveMerchantId(request);
        const merchant = await prisma.merchant.findUnique({
          where: { id: merchantId },
          select: { status: true },
        });
        if (!merchant) throw new NotFoundError("This merchant could not be found.");
        if (merchant.status === "SUSPENDED") {
          throw new ForbiddenError("This account has been suspended. Contact ZevaPay support to restore access.");
        }
        if (merchant.status !== "ACTIVE") {
          throw new ForbiddenError("Your account is still being reviewed. You will be able to make changes once it is approved.");
        }
      },
    ],
  };

  app.get("/api/v1/merchant/webhooks", read, async (request, reply) => {
    const merchantId = await app.resolveMerchantId(request);
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { merchantId },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ webhooks: endpoints.map(view) });
  });

  // The signing secret is returned here, once, and never again.
  app.post("/api/v1/merchant/webhooks", write, async (request, reply) => {
    const merchantId = await app.resolveMerchantId(request);
    const body = createSchema.parse(request.body);

    const checked = validateWebhookUrl(body.url);
    if (!checked.ok) throw new BadRequestError(checked.reason);

    const existing = await prisma.webhookEndpoint.count({ where: { merchantId } });
    if (existing >= MAX_ENDPOINTS_PER_MERCHANT) {
      throw new ConflictError(`You can add up to ${MAX_ENDPOINTS_PER_MERCHANT} webhook addresses. Remove one first.`);
    }

    const secret = newWebhookSecret();
    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        merchantId,
        url: checked.url.toString(),
        events: body.events ?? [...SUBSCRIBABLE_EVENTS],
        secret,
        secretHash: sha256(secret),
      },
    });
    return reply.status(201).send({ webhook: view(endpoint), secret });
  });

  app.patch("/api/v1/merchant/webhooks/:id", write, async (request, reply) => {
    const merchantId = await app.resolveMerchantId(request);
    const { id } = idParams.parse(request.params);
    const body = z.object({ isActive: z.boolean() }).parse(request.body);
    const found = await prisma.webhookEndpoint.findFirst({ where: { id, merchantId } });
    if (!found) throw new NotFoundError("That webhook address could not be found.");
    const endpoint = await prisma.webhookEndpoint.update({ where: { id }, data: { isActive: body.isActive } });
    return reply.send({ webhook: view(endpoint) });
  });

  app.delete("/api/v1/merchant/webhooks/:id", write, async (request, reply) => {
    const merchantId = await app.resolveMerchantId(request);
    const { id } = idParams.parse(request.params);
    const found = await prisma.webhookEndpoint.findFirst({ where: { id, merchantId } });
    if (!found) throw new NotFoundError("That webhook address could not be found.");
    await prisma.webhookEndpoint.delete({ where: { id } });
    return reply.send({ ok: true });
  });

  // Queues a `webhook.test` event so a merchant can check their handler.
  app.post("/api/v1/merchant/webhooks/:id/test", {
    ...write,
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const merchantId = await app.resolveMerchantId(request);
    const { id } = idParams.parse(request.params);
    const found = await prisma.webhookEndpoint.findFirst({ where: { id, merchantId } });
    if (!found) throw new NotFoundError("That webhook address could not be found.");

    const now = new Date();
    await prisma.webhookDelivery.create({
      data: {
        endpointId: id,
        event: "webhook.test",
        status: "PENDING",
        nextAttemptAt: now,
        payload: {
          id: `evt_${randomBytes(16).toString("base64url")}`,
          type: "webhook.test",
          createdAt: now.toISOString(),
          data: { message: "This is a test event from ZevaPay." },
        },
      },
    });
    return reply.status(202).send({ ok: true });
  });

  app.get("/api/v1/merchant/webhooks/:id/deliveries", read, async (request, reply) => {
    const merchantId = await app.resolveMerchantId(request);
    const { id } = idParams.parse(request.params);
    const found = await prisma.webhookEndpoint.findFirst({ where: { id, merchantId } });
    if (!found) throw new NotFoundError("That webhook address could not be found.");
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { endpointId: id },
      orderBy: { createdAt: "desc" },
      take: 25,
    });
    return reply.send({
      deliveries: deliveries.map((d) => ({
        id: d.id,
        event: d.event,
        status: d.status,
        attempts: d.attempts,
        responseCode: d.responseCode,
        lastError: d.lastError,
        createdAt: d.createdAt.toISOString(),
        deliveredAt: d.deliveredAt?.toISOString() ?? null,
        nextAttemptAt: d.nextAttemptAt?.toISOString() ?? null,
      })),
    });
  });
}
