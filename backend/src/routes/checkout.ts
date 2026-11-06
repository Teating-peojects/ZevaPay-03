import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { NotFoundError } from "../lib/errors.js";
import { buildCheckoutView, createCheckoutPayment, loadCheckout } from "../lib/checkout.js";
import { submitTrxId } from "../lib/payment-attempts.js";
import { CHECKOUT_PROVIDERS } from "../lib/payment-matching.js";

const createSchema = z.object({
  amountMinor: z.number().int().min(100, "The smallest payment is Tk 1.00 (100)").max(2_000_000_000),
  currency: z.literal("BDT").default("BDT"),
  description: z.string().trim().max(200).optional(),
  orderId: z.string().trim().min(1).max(100).optional(),
  returnUrl: z.string().trim().max(500).optional(),
  expiresInMinutes: z.number().int().min(5).max(1440).optional(),
});

const trxSchema = z.object({
  provider: z.enum(CHECKOUT_PROVIDERS),
  trxId: z.string().trim().min(4).max(40),
});

const UNAVAILABLE = "This payment link is not available.";

/**
 * Hosted checkout.
 *
 * `/checkout/*` is called by a merchant's server with an API key.
 * `/public/checkout/*` is called by the customer's browser; the link secret
 * in the path is the only credential, so those routes are rate limited and
 * never reveal anything beyond what the customer needs to pay.
 */
export async function registerCheckoutRoutes(app: FastifyInstance): Promise<void> {
  const keyed = { preHandler: [app.authenticateApiKey] };

  // -----------------------------------------------------------------------
  // POST /api/v1/checkout/payments  (API key)
  // -----------------------------------------------------------------------
  app.post(
    "/api/v1/checkout/payments",
    { ...keyed, config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = createSchema.parse(request.body);
      const { payment, url } = await createCheckoutPayment({
        merchantId: request.apiKey!.merchantId,
        apiKeyId: request.apiKey!.id,
        amountMinor: body.amountMinor,
        description: body.description,
        orderId: body.orderId,
        returnUrl: body.returnUrl,
        expiresInMinutes: body.expiresInMinutes,
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        data: {
          id: payment.id,
          reference: payment.reference,
          status: payment.status,
          amountMinor: payment.amountMinor,
          currency: payment.currency,
          expiresAt: payment.expiresAt?.toISOString() ?? null,
          orderId: body.orderId ?? null,
          // Shown once. Only a hash of the secret in it is kept.
          checkoutUrl: url,
        },
      });
    },
  );

  // -----------------------------------------------------------------------
  // GET /api/v1/checkout/payments/:id  (API key)
  // -----------------------------------------------------------------------
  app.get<{ Params: { id: string } }>(
    "/api/v1/checkout/payments/:id",
    { ...keyed, config: { rateLimit: { max: 300, timeWindow: "1 minute" } } },
    async (request) => {
      const payment = await prisma.payment.findFirst({
        where: { id: request.params.id, merchantId: request.apiKey!.merchantId, deletedAt: null },
        select: {
          id: true,
          reference: true,
          status: true,
          amountMinor: true,
          currency: true,
          expiresAt: true,
          confirmedAt: true,
          metadata: true,
        },
      });
      if (!payment) throw new NotFoundError("That payment could not be found.");

      const orderId =
        payment.metadata && typeof payment.metadata === "object" && "orderId" in payment.metadata
          ? (payment.metadata as { orderId?: unknown }).orderId
          : null;
      const open = payment.status === "CREATED" || payment.status === "PENDING";

      return {
        data: {
          id: payment.id,
          reference: payment.reference,
          // CONFIRMED means a notification matched. REVIEW needs the merchant's decision.
          status: payment.status,
          amountMinor: payment.amountMinor,
          currency: payment.currency,
          expired: open && !!payment.expiresAt && payment.expiresAt.getTime() < Date.now(),
          expiresAt: payment.expiresAt?.toISOString() ?? null,
          confirmedAt: payment.confirmedAt?.toISOString() ?? null,
          orderId: typeof orderId === "string" ? orderId : null,
        },
      };
    },
  );

  // -----------------------------------------------------------------------
  // GET /api/v1/public/checkout/:token  (customer)
  // -----------------------------------------------------------------------
  app.get<{ Params: { token: string } }>(
    "/api/v1/public/checkout/:token",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const record = await loadCheckout(request.params.token);
      if (!record) throw new NotFoundError(UNAVAILABLE);
      // The link is a credential: never let a cache keep it.
      reply.header("cache-control", "no-store");
      return { data: buildCheckoutView(record) };
    },
  );

  // -----------------------------------------------------------------------
  // POST /api/v1/public/checkout/:token/trxid  (customer)
  // -----------------------------------------------------------------------
  app.post<{ Params: { token: string } }>(
    "/api/v1/public/checkout/:token/trxid",
    { config: { rateLimit: { max: 15, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = trxSchema.parse(request.body);
      const record = await loadCheckout(request.params.token);
      if (!record) throw new NotFoundError(UNAVAILABLE);

      const result = await submitTrxId({
        paymentId: record.id,
        merchantId: record.merchantId,
        provider: body.provider,
        trxId: body.trxId,
        actorId: null,
        ipAddress: request.ip,
        requireActiveAccount: true,
      });

      const fresh = await loadCheckout(request.params.token);
      reply.header("cache-control", "no-store");
      return reply.status(201).send({
        data: {
          match: result.match,
          checkout: fresh ? buildCheckoutView(fresh) : null,
        },
      });
    },
  );
}
