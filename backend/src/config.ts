import { z } from "zod";
import "dotenv/config";

/**
 * Runtime configuration. Every value is validated at boot so a misconfigured
 * deployment fails fast instead of surfacing as a confusing runtime error.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine((value) => value.startsWith("postgresql://"), {
      message: "DATABASE_URL must be a PostgreSQL connection string",
    }),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters").optional(),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),

  /** Public address of the web app. Checkout links are built from it. */
  PUBLIC_APP_URL: z.string().url().optional(),

  /** Origins allowed to call the API with credentials. */
  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  /** Shared secret the Android device uses when posting notifications. */

  /** Parser confidence threshold for routing unverified notifications. */
  AUTO_ACCEPT_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.9),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
}).superRefine((value, context) => {
  if (value.NODE_ENV === "production" && !value.JWT_SECRET) {
    context.addIssue({ code: "custom", path: ["JWT_SECRET"], message: "JWT_SECRET is required in production" });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const env = parsed.data;

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  port: env.PORT,
  host: env.HOST,
  databaseUrl: env.DATABASE_URL,
  jwt: {
    secret: env.JWT_SECRET ?? "dev-only-secret-change-me-in-production-000000",
    accessTtl: env.JWT_ACCESS_TTL,
    refreshTtl: env.JWT_REFRESH_TTL,
  },
  publicAppUrl: (
    env.PUBLIC_APP_URL ??
    env.CORS_ORIGINS.split(",")[0]?.trim() ??
    "http://localhost:3000"
  ).replace(/\/$/, ""),
  corsOrigins: env.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  autoAcceptConfidence: env.AUTO_ACCEPT_CONFIDENCE,
  logLevel: env.LOG_LEVEL,
} as const;

export type AppConfig = typeof config;
