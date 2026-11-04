import type { FastifyInstance } from "fastify";
import { eventHub } from "../lib/events.js";

/**
 * Server-Sent Events feed used by the dashboards for live updates.
 *
 * Merchant users subscribe to their own merchant channel; platform admins
 * subscribe to the platform channel.
 */
export async function registerStreamRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/v1/stream",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const isPlatformAdmin = ["SUPER_ADMIN", "ADMIN", "SUPPORT"].includes(request.auth!.role);
      const merchantId = request.auth!.merchantId;

      if (!isPlatformAdmin && !merchantId) {
        reply.status(403);
        return reply.send({
          error: {
            code: "FORBIDDEN",
            message: "Your account is not linked to a merchant.",
          },
        });
      }

      const channel = isPlatformAdmin ? "platform" : `merchant:${merchantId}`;

      reply.raw.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });

      const send = (event: string, data: unknown) => {
        reply.raw.write(`event: ${event}\n`);
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      send("connected", { channel, at: new Date().toISOString() });

      // Backfill the most recent events so a reconnecting client is not
      // left with a blank screen.
      for (const event of eventHub.history(channel).slice(-20)) {
        send(event.type, event.payload);
      }

      const unsubscribe = eventHub.subscribe((event) => {
        if (event.channel !== channel) return;
        send(event.type, event.payload);
      });

      // Keep-alive comment so proxies do not drop an idle connection.
      const keepAlive = setInterval(() => {
        reply.raw.write(": ping\n\n");
      }, 25_000);

      const cleanup = () => {
        clearInterval(keepAlive);
        unsubscribe();
      };

      request.raw.on("close", cleanup);
      request.raw.on("error", cleanup);

      // The connection stays open; Fastify must not try to serialise a reply.
      return reply;
    },
  );
}
