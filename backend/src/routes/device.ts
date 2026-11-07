import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { channels, eventHub } from "../lib/events.js";
import { authenticateDevice } from "../lib/device-auth.js";
import { pairDevice } from "../lib/device-pairing.js";
import { generateTransactionReference } from "../lib/hash.js";
import { parseNotification } from "../parser/index.js";
import { settleFromTransaction, type SettleResult } from "../lib/payment-matching.js";
import { serializeTransaction } from "../lib/serializers.js";

const notificationSchema = z.object({
  /** Optional. If sent, it must be the device the token belongs to. */
  deviceId: z.string().trim().min(3).optional(),
  /** The raw SMS body exactly as received. */
  message: z.string().trim().min(1, "A message body is required"),
  /** Optional timestamp supplied by the device. */
  receivedAt: z.string().datetime().optional(),
  /** Optional provider hint from the bound payment account. */
  provider: z
    .enum(["BKASH", "NAGAD", "ROCKET", "UPAY"])
    .optional(),
});

const pairingSchema = z.object({
  code: z.string().trim().min(4, "A pairing code is required"),
  deviceId: z.string().trim().min(3, "A device identifier is required"),
  deviceName: z.string().trim().min(2).max(80).optional(),
  androidVersion: z.string().trim().max(40).optional(),
});

export async function registerDeviceRoutes(app: FastifyInstance): Promise<void> {
  // A device is not a user. After pairing it holds its own token and sends it
  // as `Authorization: Bearer zpd_…`. The token identifies the device; a
  // `deviceId` in the body is only checked against it.

  // ---------------------------------------------------------------------
  // POST /api/v1/device/pair
  // ---------------------------------------------------------------------
  app.post(
    "/api/v1/device/pair",
    {
      // The pairing code is the only credential here, so keep guesses scarce.
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const body = pairingSchema.parse(request.body);
      const { device, token } = await pairDevice(body);

      eventHub.publish(
        channels.merchant(device.merchantId),
        "device.paired",
        { id: device.id, deviceId: device.deviceId, name: device.name },
      );

      return reply.status(201).send({
        device: {
          id: device.id,
          name: device.name,
          deviceId: device.deviceId,
          merchantId: device.merchantId,
          status: device.status,
        },
        // Shown once. The device keeps it and sends it on every later call.
        deviceToken: token,
      });
    },
  );

  // ---------------------------------------------------------------------
  // POST /api/v1/device/notifications
  // ---------------------------------------------------------------------
  app.post(
    "/api/v1/device/notifications",
    {
      config: { rateLimit: { max: 600, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const body = notificationSchema.parse(request.body);
      const device = await authenticateDevice(request.headers, body.deviceId);

      await prisma.device.update({
        where: { id: device.id },
        data: { status: "ONLINE", lastActiveAt: new Date() },
      });

      const expectedProvider =
        body.provider ?? device.connectedAccount?.provider ?? undefined;

      const { result } = parseNotification(body.message, { expectedProvider });

      // A parsed SMS is unverified evidence, regardless of parser confidence.
      const status = result.outcome === "payment_received" && result.confidence >= config.autoAcceptConfidence
        ? "PENDING"
        : "REVIEW";

      const occurredAt =
        result.occurredAt ??
        (body.receivedAt ? new Date(body.receivedAt) : new Date());

      // Guard against the same notification being posted twice — the device
      // retries on flaky mobile networks.
      const duplicate = await prisma.transaction.findFirst({
        where: {
          deviceId: device.id,
          providerRef: result.providerRef ? result.providerRef : undefined,
          rawNotification: body.message,
        },
        select: { id: true },
      });

      if (duplicate) {
        return reply.send({
          duplicate: true,
          transactionId: duplicate.id,
          status,
        });
      }

      const transaction = await prisma.transaction.create({
        data: {
          reference: generateTransactionReference(),
          merchantId: device.merchantId,
          accountId: device.connectedAccountId,
          deviceId: device.id,
          provider: result.provider,
          amountMinor: Math.round((result.amount ?? 0) * 100),
          currency: "BDT",
          customerName: result.customerName,
          customerPhone: result.customerPhone,
          status,
          rawNotification: body.message,
          confidence: result.confidence,
          providerRef: result.providerRef,
          occurredAt,
        },
        include: {
          account: { select: { label: true } },
          device: { select: { name: true } },
        },
      });

      // If a customer already gave this TrxID for a payment, settle it now.
      // A failure here must never lose the notification, which is already
      // saved, so it is logged and the notification is left for review.
      let settlement: SettleResult | null = null;
      if (
        result.outcome === "payment_received" &&
        result.directionExplicit &&
        result.providerRef
      ) {
        try {
          settlement = await settleFromTransaction(transaction.id);
        } catch (error) {
          request.log.error({ err: error }, "payment matching failed");
        }
      }

      // Matching may have changed the status, so publish what is stored.
      const current = settlement
        ? await prisma.transaction.findUniqueOrThrow({
            where: { id: transaction.id },
            include: {
              account: { select: { label: true } },
              device: { select: { name: true } },
            },
          })
        : transaction;

      eventHub.publish(
        channels.merchant(device.merchantId),
        "transaction.created",
        serializeTransaction(current),
      );
      eventHub.publish(channels.platform, "transaction.created", {
        merchantId: device.merchantId,
        transaction: serializeTransaction(current),
      });

      return reply.status(201).send({
        duplicate: false,
        transactionId: transaction.id,
        reference: transaction.reference,
        status: current.status,
        confidence: result.confidence,
        // True only when the SMS matched a payment's TrxID and amount.
        autoAccepted: settlement?.outcome === "approved",
        verificationRequired: settlement?.outcome !== "approved",
        paymentId: settlement?.paymentId ?? null,
        missing: result.missing,
        reasons: [...result.reasons, ...(settlement?.reasons ?? [])],
      });
    },
  );

  // ---------------------------------------------------------------------
  // POST /api/v1/device/heartbeat
  // ---------------------------------------------------------------------
  app.post(
    "/api/v1/device/heartbeat",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = z
        .object({ deviceId: z.string().trim().min(3).optional() })
        .parse(request.body ?? {});
      const device = await authenticateDevice(request.headers, body.deviceId);

      await prisma.device.update({
        where: { id: device.id },
        data: { status: "ONLINE", lastActiveAt: new Date() },
      });

      return reply.send({ ok: true, at: new Date().toISOString() });
    },
  );
}
