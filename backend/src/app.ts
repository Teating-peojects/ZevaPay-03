import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import { config } from "./config.js";
import { errorHandler, notFoundHandler } from "./lib/http.js";
import authPlugin from "./plugins/auth.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerMerchantRoutes } from "./routes/merchant.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerDeviceRoutes } from "./routes/device.js";
import { registerStreamRoutes } from "./routes/stream.js";
import { registerCheckoutRoutes } from "./routes/checkout.js";
import { registerPaymentRoutes } from "./routes/payments.js";
import { registerCustomerRoutes } from "./routes/customers.js";

/**
 * Builds the Fastify application. Kept separate from the process bootstrap so
 * tests can drive the app without binding a port.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport: config.env === "development" ? undefined : undefined,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.headers['x-device-secret']",
          "res.headers['set-cookie']",
        ],
        censor: "[redacted]",
      },
    },
    trustProxy: true,
    genReqId: () => `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    disableRequestLogging: config.env === "test",
  });

  await app.register(helmet, { contentSecurityPolicy: false });

  await app.register(cors, {
    origin: (origin, callback) => {
      // Same-origin and non-browser clients send no Origin header.
      if (!origin) return callback(null, true);
      if (config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed by CORS policy"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });

  await app.register(cookie);

  await app.register(jwt, {
    secret: config.jwt.secret,
    sign: { expiresIn: config.jwt.accessTtl },
  });

  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    // Auth endpoints are stricter; see routes/auth.ts.
    keyGenerator: (request) => request.ip,
    allowList: (request) => request.url === "/health",
  });

  await app.register(authPlugin);

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  // A POST that declares a JSON content type but carries no body is treated
  // as an empty object rather than a malformed request. Browsers and CLI
  // clients both do this by accident.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => {
      const raw = typeof body === "string" ? body.trim() : "";
      if (raw.length === 0) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(raw));
      } catch (error) {
        const err = error as Error & { statusCode?: number };
        err.statusCode = 400;
        done(err, undefined);
      }
    },
  );

  app.get("/health", async () => ({
    status: "ok",
    service: "zevapay-api",
    env: config.env,
    time: new Date().toISOString(),
  }));

  await registerAuthRoutes(app);
  await registerMerchantRoutes(app);
  await registerPaymentRoutes(app);
  await registerCheckoutRoutes(app);
  await registerCustomerRoutes(app);
  await registerAdminRoutes(app);
  await registerDeviceRoutes(app);
  await registerStreamRoutes(app);

  return app;
}
