import { prisma } from "../db.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "./errors.js";
import {
  PLAN_CATALOG,
  TRIAL_DAYS,
  addDays,
  addMonths,
  findPlan,
  type PlanDefinition,
} from "./plans.js";

/**
 * One live subscription per merchant. It runs until `renewsAt`; nothing flips a
 * status when that time passes, the state is worked out from the clock each
 * time. A merchant who has never had one gets the free trial the first time
 * we look, so the 30 days start when they first use the service, not while an
 * administrator is still reviewing the sign-up.
 */

export type AccessState = "trial" | "active" | "expired";

export interface Access {
  state: AccessState;
  planCode: string;
  planName: string;
  endsAt: string;
  /** Whole days left, rounded up. 0 once it has ended. */
  daysLeft: number;
}

interface SubscriptionRow {
  status: string;
  renewsAt: Date | null;
  plan: { code: string; name: string };
}

export function evaluateAccess(subscription: SubscriptionRow, now: Date): Access {
  const ends = subscription.renewsAt ?? now;
  const remaining = ends.getTime() - now.getTime();
  const state: AccessState =
    remaining <= 0 ? "expired" : subscription.status === "TRIALING" ? "trial" : "active";
  return {
    state,
    planCode: subscription.plan.code,
    planName: subscription.plan.name,
    endsAt: ends.toISOString(),
    daysLeft: remaining <= 0 ? 0 : Math.ceil(remaining / 86_400_000),
  };
}

async function planRow(definition: PlanDefinition) {
  return prisma.plan.upsert({
    where: { code: definition.code },
    create: {
      code: definition.code,
      name: definition.name,
      monthlyPriceMinor: definition.monthlyPriceMinor,
      limits: { months: definition.months },
    },
    update: {
      name: definition.name,
      monthlyPriceMinor: definition.monthlyPriceMinor,
      limits: { months: definition.months },
      isActive: true,
    },
  });
}

async function latestLive(merchantId: string) {
  const [found] = await prisma.subscription.findMany({
    where: { merchantId, status: { in: ["TRIALING", "ACTIVE"] } },
    orderBy: { createdAt: "desc" },
    take: 1,
    include: { plan: true },
  });
  return found ?? null;
}

/** The merchant's current access, starting the free trial if they have never had a plan. */
export async function getAccess(merchantId: string, now: Date = new Date()): Promise<Access> {
  let live = await latestLive(merchantId);
  if (!live) {
    const trial = PLAN_CATALOG.find((p) => p.code === "TRIAL")!;
    const plan = await planRow(trial);
    live = await prisma.subscription.create({
      data: {
        merchantId,
        planId: plan.id,
        status: "TRIALING",
        startedAt: now,
        renewsAt: addDays(now, TRIAL_DAYS),
      },
      include: { plan: true },
    });
    await prisma.merchant.update({ where: { id: merchantId }, data: { plan: trial.name } });
  }
  return evaluateAccess(live, now);
}

/** Refuses to start new payments once a plan has ended. Received SMS and existing payments are not touched. */
export async function assertCanCreatePayments(merchantId: string, now: Date = new Date()): Promise<void> {
  const access = await getAccess(merchantId, now);
  if (access.state === "expired") {
    throw new ForbiddenError(
      "Your plan has ended, so new payments cannot be created. Renew your plan to continue. Payments already created and SMS already received are not affected.",
    );
  }
}

/**
 * Starts a paid period. If time is left on the current plan or trial, the new
 * period starts when that ends, so nothing the merchant has paid for is lost.
 */
export async function activatePlan(merchantId: string, planCode: string, now: Date = new Date()) {
  const definition = findPlan(planCode);
  if (!definition) throw new BadRequestError("That plan does not exist.");
  if (definition.months === 0) throw new BadRequestError("The free trial starts by itself and cannot be activated.");

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { id: true } });
  if (!merchant) throw new NotFoundError("That merchant could not be found.");

  const plan = await planRow(definition);

  return prisma.$transaction(async (tx) => {
    const [current] = await tx.subscription.findMany({
      where: { merchantId, status: { in: ["TRIALING", "ACTIVE"] } },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    const start = current?.renewsAt && current.renewsAt.getTime() > now.getTime() ? current.renewsAt : now;
    const end = addMonths(start, definition.months);

    await tx.subscription.updateMany({
      where: { merchantId, status: { in: ["TRIALING", "ACTIVE"] } },
      data: { status: "CANCELLED" },
    });
    const created = await tx.subscription.create({
      data: { merchantId, planId: plan.id, status: "ACTIVE", startedAt: now, renewsAt: end },
      include: { plan: true },
    });
    await tx.merchant.update({ where: { id: merchantId }, data: { plan: definition.name } });
    return evaluateAccess(created, now);
  });
}
