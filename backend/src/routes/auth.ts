import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../db.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  profileSchema,
  registerSchema,
} from "../schemas/auth.js";
import { recordAudit } from "../lib/audit.js";
import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from "../lib/errors.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { randomToken, sha256 } from "../lib/hash.js";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearSessionCookies,
  issueSession,
  revokeAllSessions,
  rotateSession,
  setSessionCookies,
} from "../lib/tokens.js";
import { serializeMerchant, serializeUser } from "../lib/serializers.js";

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------
  // POST /api/v1/auth/register
  // ---------------------------------------------------------------------
  app.post(
    "/api/v1/auth/register",
    {
      config: {
        rateLimit: { max: 10, timeWindow: "1 hour" },
      },
    },
    async (request, reply) => {
      const body = registerSchema.parse(request.body);

      const existing = await prisma.user.findUnique({
        where: { email: body.email },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictError("An account with that email already exists.");
      }

      const passwordHash = await hashPassword(body.password);

      const merchant = await prisma.merchant.create({
        data: {
          businessName: body.businessName,
          ownerName: body.ownerName,
          email: body.email,
          phone: body.phone,
          country: body.country,
          status: "PENDING_REVIEW",
          plan: "Starter",
          lastActiveAt: new Date(),
          users: {
            create: {
              email: body.email,
              fullName: body.ownerName,
              phone: body.phone,
              passwordHash,
              role: "MERCHANT_OWNER",
            },
          },
        },
        include: { users: true },
      });

      const user = merchant.users[0]!;

      await recordAudit({
        action: "REGISTER",
        actorId: user.id,
        merchantId: merchant.id,
        metadata: { businessName: merchant.businessName },
        ipAddress: request.ip,
      });

      const tokens = await issueSession(
        app,
        {
          id: user.id,
          email: user.email,
          role: user.role,
          merchantId: user.merchantId,
        },
        { userAgent: request.headers["user-agent"], ipAddress: request.ip },
      );

      setSessionCookies(reply, tokens);

      return reply.status(201).send({
        user: serializeUser(user),
        merchant: serializeMerchant(merchant),
        expiresIn: tokens.expiresIn,
      });
    },
  );

  // ---------------------------------------------------------------------
  // POST /api/v1/auth/login
  // ---------------------------------------------------------------------
  app.post(
    "/api/v1/auth/login",
    {
      config: {
        rateLimit: { max: 10, timeWindow: "1 minute" },
      },
    },
    async (request, reply) => {
      const body = loginSchema.parse(request.body);

      const user = await prisma.user.findUnique({
        where: { email: body.email },
        include: { merchant: true },
      });

      if (!user || !user.isActive) {
        await recordAudit({
          action: "LOGIN_FAILED",
          actorId: user?.id ?? null,
          ipAddress: request.ip,
          metadata: { email: body.email, reason: "invalid_credentials" },
        });
        throw new UnauthorizedError("Email or password is incorrect.");
      }

      // A suspended merchant cannot use the platform at all. A merchant that
      // is still under review may sign in, but only to look — every write is
      // refused until an administrator approves it.
      if (user.merchant && user.merchant.status === "SUSPENDED") {
        await recordAudit({
          action: "LOGIN_FAILED",
          actorId: user.id,
          merchantId: user.merchantId,
          ipAddress: request.ip,
          metadata: {
            email: body.email,
            reason: "merchant_suspended",
            merchantStatus: user.merchant.status,
          },
        });

        throw new ForbiddenError(
          "This account has been suspended. Contact ZevaPay support to restore access.",
        );
      }

      const valid = await verifyPassword(body.password, user.passwordHash);
      if (!valid) {
        await recordAudit({
          action: "LOGIN_FAILED",
          actorId: user.id,
          merchantId: user.merchantId,
          ipAddress: request.ip,
          metadata: { email: body.email, reason: "invalid_credentials" },
        });
        throw new UnauthorizedError("Email or password is incorrect.");
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      if (user.merchant) {
        await prisma.merchant.update({
          where: { id: user.merchantId! },
          data: { lastActiveAt: new Date() },
        });
      }

      await recordAudit({
        action: "LOGIN",
        actorId: user.id,
        merchantId: user.merchantId,
        ipAddress: request.ip,
      });

      const tokens = await issueSession(
        app,
        {
          id: user.id,
          email: user.email,
          role: user.role,
          merchantId: user.merchantId,
        },
        { userAgent: request.headers["user-agent"], ipAddress: request.ip },
      );

      setSessionCookies(reply, tokens);

      return reply.send({
        user: serializeUser(user),
        merchant: user.merchant ? serializeMerchant(user.merchant) : null,
        expiresIn: tokens.expiresIn,
      });
    },
  );

  // ---------------------------------------------------------------------
  // POST /api/v1/auth/refresh
  // ---------------------------------------------------------------------
  app.post(
    "/api/v1/auth/refresh",
    {
      config: {
        rateLimit: { max: 60, timeWindow: "1 minute" },
      },
    },
    async (request, reply) => {
      // The refresh token normally arrives in an httpOnly cookie. A body
      // value is also accepted for non-browser clients.
      const body = z
        .object({ refreshToken: z.string().optional() })
        .parse(request.body ?? {});
      const refreshToken =
        body.refreshToken ?? request.cookies[REFRESH_COOKIE];

      if (!refreshToken) {
        throw new UnauthorizedError("Your session has expired. Please sign in again.");
      }

      const result = await rotateSession(
        app,
        refreshToken,
        { userAgent: request.headers["user-agent"], ipAddress: request.ip },
      );

      if (!result) {
        clearSessionCookies(reply);
        throw new UnauthorizedError("Your session has expired. Please sign in again.");
      }

      const user = await prisma.user.findUnique({
        where: { id: result.userId },
        include: { merchant: true },
      });

      if (!user) {
        clearSessionCookies(reply);
        throw new UnauthorizedError("Your session has expired. Please sign in again.");
      }

      setSessionCookies(reply, result);

      return reply.send({
        user: serializeUser(user),
        merchant: user.merchant ? serializeMerchant(user.merchant) : null,
        expiresIn: result.expiresIn,
      });
    },
  );

  // ---------------------------------------------------------------------
  // POST /api/v1/auth/logout
  // ---------------------------------------------------------------------
  app.post("/api/v1/auth/logout", async (request, reply) => {
    const body = z
      .object({ refreshToken: z.string().optional() })
      .parse(request.body ?? {});
    const refreshToken = body.refreshToken ?? request.cookies[REFRESH_COOKIE];

    if (refreshToken) {
      const session = await prisma.session.findUnique({
        where: { tokenHash: sha256(refreshToken) },
        select: { id: true, userId: true },
      });
      if (session) {
        await prisma.session.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
        await recordAudit({
          action: "LOGOUT",
          actorId: session.userId,
          ipAddress: request.ip,
        });
      }
    }

    clearSessionCookies(reply);

    return reply.send({ ok: true });
  });

  // ---------------------------------------------------------------------
  // POST /api/v1/auth/logout-all
  // ---------------------------------------------------------------------
  app.post(
    "/api/v1/auth/logout-all",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      await revokeAllSessions(request.auth!.userId);
      return reply.send({ ok: true });
    },
  );

  // ---------------------------------------------------------------------
  // POST /api/v1/auth/forgot-password
  // ---------------------------------------------------------------------
  app.post(
    "/api/v1/auth/forgot-password",
    {
      config: {
        rateLimit: { max: 5, timeWindow: "15 minutes" },
      },
    },
    async (request, reply) => {
      const body = forgotPasswordSchema.parse(request.body);

      const user = await prisma.user.findUnique({
        where: { email: body.email },
        select: { id: true },
      });

      // Always report success so the endpoint cannot be used to discover
      // which email addresses have accounts.
      if (user) {
        const token = randomToken(32);
        await prisma.verificationToken.create({
          data: {
            tokenHash: sha256(token),
            purpose: "PASSWORD_RESET",
            userId: user.id,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          },
        });
        await prisma.verificationToken.deleteMany({
          where: { userId: user.id, purpose: "PASSWORD_RESET", expiresAt: { lt: new Date() } },
        });
        request.log.info(
          { userId: user.id },
          "Password reset requested — token issued (no email transport configured)",
        );
      }

      return reply.send({
        ok: true,
        message:
          "If an account exists for that email, a reset link has been sent.",
      });
    },
  );

  // ---------------------------------------------------------------------
  // POST /api/v1/auth/reset-password
  // ---------------------------------------------------------------------
  app.post("/api/v1/auth/reset-password", async (request, reply) => {
    const body = z
      .object({
        token: z.string().min(10, "A reset token is required"),
        password: changePasswordSchema.shape.newPassword,
      })
      .parse(request.body);

    const tokenHash = sha256(body.token);
    const user = await prisma.$transaction(async (tx) => {
      const claimed = await tx.verificationToken.updateMany({
        where: { tokenHash, purpose: "PASSWORD_RESET", usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) throw new ValidationError("That reset link is invalid or has expired.");
      const token = await tx.verificationToken.findUnique({ where: { tokenHash }, select: { userId: true } });
      if (!token) throw new ValidationError("That reset link is invalid or has expired.");
      const updatedUser = await tx.user.update({
        where: { id: token.userId },
        data: { passwordHash: await hashPassword(body.password) },
        select: { id: true, merchantId: true },
      });
      await tx.session.updateMany({ where: { userId: token.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      return updatedUser;
    });

    await recordAudit({
      action: "PASSWORD_CHANGED",
      actorId: user.id,
      merchantId: user.merchantId,
      metadata: { via: "password_reset" },
      ipAddress: request.ip,
    });

    return reply.send({ ok: true });
  });

  app.post("/api/v1/auth/email-verification/request", { preHandler: [app.authenticate] }, async (request) => {
    const token = randomToken(32);
    await prisma.verificationToken.create({ data: {
      tokenHash: sha256(token), purpose: "EMAIL_VERIFICATION", userId: request.auth!.userId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    } });
    return { ok: true, message: "If email delivery is configured, a verification link will be sent." };
  });

  app.post("/api/v1/auth/verify-email", async (request) => {
    const body = z.object({ token: z.string().trim().min(20).max(200) }).parse(request.body);
    const tokenHash = sha256(body.token);
    const user = await prisma.$transaction(async (tx) => {
      const claim = await tx.verificationToken.updateMany({
        where: { tokenHash, purpose: "EMAIL_VERIFICATION", usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claim.count !== 1) throw new ValidationError("That verification link is invalid or expired.");
      const token = await tx.verificationToken.findUnique({ where: { tokenHash }, select: { userId: true } });
      if (!token) throw new ValidationError("That verification link is invalid or expired.");
      return tx.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: new Date() }, select: { id: true, merchantId: true } });
    });
    await recordAudit({ action: "EMAIL_VERIFIED", actorId: user.id, merchantId: user.merchantId, ipAddress: request.ip });
    return { ok: true };
  });

  // ---------------------------------------------------------------------
  // GET /api/v1/auth/me
  // ---------------------------------------------------------------------
  app.get(
    "/api/v1/auth/me",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.auth!.userId },
        include: { merchant: true },
      });

      if (!user) {
        throw new UnauthorizedError("Your session has expired. Please sign in again.");
      }

      return reply.send({
        user: serializeUser(user),
        merchant: user.merchant ? serializeMerchant(user.merchant) : null,
      });
    },
  );

  // ---------------------------------------------------------------------
  // PATCH /api/v1/auth/profile
  // ---------------------------------------------------------------------
  app.patch(
    "/api/v1/auth/profile",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const body = profileSchema.parse(request.body);

      const existing = await prisma.user.findUnique({
        where: { email: body.email },
        select: { id: true },
      });
      if (existing && existing.id !== request.auth!.userId) {
        throw new ConflictError("That email address is already in use.");
      }

      const user = await prisma.user.update({
        where: { id: request.auth!.userId },
        data: {
          fullName: body.fullName,
          email: body.email,
          phone: body.phone ? body.phone : null,
        },
        include: { merchant: true },
      });

      return reply.send({
        user: serializeUser(user),
        merchant: user.merchant ? serializeMerchant(user.merchant) : null,
      });
    },
  );

  // ---------------------------------------------------------------------
  // POST /api/v1/auth/change-password
  // ---------------------------------------------------------------------
  app.post(
    "/api/v1/auth/change-password",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const body = changePasswordSchema.parse(request.body);

      const user = await prisma.user.findUnique({
        where: { id: request.auth!.userId },
        select: { id: true, merchantId: true, passwordHash: true },
      });
      if (!user) throw new UnauthorizedError();

      const valid = await verifyPassword(body.currentPassword, user.passwordHash);
      if (!valid) {
        throw new ValidationError("Your current password is incorrect.", {
          currentPassword: "Your current password is incorrect.",
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(body.newPassword) },
      });

      await revokeAllSessions(user.id);

      await recordAudit({
        action: "PASSWORD_CHANGED",
        actorId: user.id,
        merchantId: user.merchantId,
        metadata: { via: "settings" },
        ipAddress: request.ip,
      });

      return reply.send({ ok: true });
    },
  );

  // ---------------------------------------------------------------------
  // GET /api/v1/auth/sessions
  // ---------------------------------------------------------------------
  app.get(
    "/api/v1/auth/sessions",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const sessions = await prisma.session.findMany({
        where: { userId: request.auth!.userId, revokedAt: null },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({
        sessions: sessions.map((session) => ({
          id: session.id,
          userAgent: session.userAgent,
          ipAddress: session.ipAddress,
          createdAt: session.createdAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
        })),
      });
    },
  );

  // ---------------------------------------------------------------------
  // GET /api/v1/config
  // ---------------------------------------------------------------------
  app.get("/api/v1/config", async () => ({
    autoAcceptConfidence: config.autoAcceptConfidence,
    providers: ["BKASH", "NAGAD", "ROCKET", "UPAY"],
    accountTypes: ["PERSONAL", "MERCHANT", "AGENT", "BUSINESS"],
  }));
}
