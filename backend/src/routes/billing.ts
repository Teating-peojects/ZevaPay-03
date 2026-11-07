import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { recordAudit } from "../lib/audit.js";
import { NotFoundError } from "../lib/errors.js";
import { PLAN_CATALOG, totalPriceMinor } from "../lib/plans.js";
import { activatePlan, getAccess } from "../lib/subscriptions.js";

const READ_ROLES = ["MERCHANT_OWNER", "MERCHANT_ADMIN", "MERCHANT_MANAGER", "MERCHANT_VIEWER"];

export async function registerBillingRoutes(app: FastifyInstance): Promise<void> {
  const read = { preHandler: [app.authenticate, app.requireRole(READ_ROLES)] };
  const admin = {
    preHandler: [app.authenticate, app.requireRole(["SUPER_ADMIN", "ADMIN"]), app.requirePermission("admin:manage")],
  };

  const idParams = z.object({ id: z.string().min(1) });

  const catalog = () =>
    PLAN_CATALOG.map((plan) => ({
      code: plan.code,
      name: plan.name,
      months: plan.months,
      monthlyPriceMinor: plan.monthlyPriceMinor,
      totalPriceMinor: totalPriceMinor(plan),
      currency: "BDT",
    }));

  // The plans on sale and where this merchant stands.
  app.get("/api/v1/merchant/billing", read, async (request, reply) => {
    const merchantId = await app.resolveMerchantId(request);
    return reply.send({ plans: catalog(), subscription: await getAccess(merchantId) });
  });

  // An administrator starts or renews a plan after the merchant has paid.
  app.post("/api/v1/admin/merchants/:id/subscription", admin, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = z.object({ planCode: z.string().min(1) }).parse(request.body);

    const merchant = await prisma.merchant.findUnique({ where: { id }, select: { id: true } });
    if (!merchant) throw new NotFoundError("That merchant could not be found.");

    const subscription = await activatePlan(id, body.planCode);
    await recordAudit({
      action: "MERCHANT_UPDATED",
      actorId: request.auth!.userId,
      merchantId: id,
      metadata: { change: "plan_activated", planCode: body.planCode, endsAt: subscription.endsAt },
      ipAddress: request.ip,
    });
    return reply.send({ subscription });
  });

  app.get("/api/v1/admin/merchants/:id/subscription", admin, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const merchant = await prisma.merchant.findUnique({ where: { id }, select: { id: true } });
    if (!merchant) throw new NotFoundError("That merchant could not be found.");
    return reply.send({ plans: catalog(), subscription: await getAccess(id) });
  });
}
