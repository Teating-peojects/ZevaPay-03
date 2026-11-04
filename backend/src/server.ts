import { buildApp } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { pruneExpiredSessions } from "./lib/tokens.js";

async function main(): Promise<void> {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Shutting down");
    try {
      await app.close();
      await prisma.$disconnect();
    } catch (error) {
      app.log.error({ err: error }, "Error during shutdown");
    }
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  // Housekeeping: drop expired session rows once an hour.
  const pruneTimer = setInterval(
    () => {
      void pruneExpiredSessions().catch(() => undefined);
    },
    60 * 60 * 1000,
  );
  pruneTimer.unref();

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(
      `ZevaPay API listening on http://${config.host}:${config.port}`,
    );
  } catch (error) {
    app.log.error({ err: error }, "Failed to start server");
    await prisma.$disconnect();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal startup error", error);
  process.exit(1);
});
