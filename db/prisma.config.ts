import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 configuration. The schema lives in ./prisma/schema.prisma and the
 * generated client is emitted into the backend package so both the API and
 * the seed script import the same instance.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "npx tsx seed/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
