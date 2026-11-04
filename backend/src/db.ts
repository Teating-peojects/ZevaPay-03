import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";
import { config } from "./config.js";

/**
 * Prisma client with the pg driver adapter, as required by Prisma 7.
 * A single instance is shared across the process.
 */
const adapter = new PrismaPg({ connectionString: config.databaseUrl });

export const prisma = new PrismaClient({
  adapter,
  log: config.env === "development" ? ["warn", "error"] : ["error"],
});
