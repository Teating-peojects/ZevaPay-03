import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError } from "./errors.js";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

/**
 * Turns a Zod issue list into a compact field -> message map so the frontend
 * can attach messages to individual form inputs.
 */
export function zodDetails(error: ZodError): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    if (!details[path]) details[path] = issue.message;
  }
  return details;
}

/**
 * Global error handler. Application errors become their intended status
 * code; everything else becomes a 500 with no internal detail leaked.
 */
export function errorHandler(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const requestId = request.id;

  if (error instanceof AppError) {
    const body: ApiErrorBody = {
      error: {
        code: error.code,
        message: error.message,
        requestId,
      },
    };
    if (error.details !== undefined) body.error.details = error.details;
    void reply.status(error.statusCode).send(body);
    return;
  }

  if (error instanceof ZodError) {
    const body: ApiErrorBody = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Some fields need attention.",
        details: zodDetails(error),
        requestId,
      },
    };
    void reply.status(422).send(body);
    return;
  }

  const statusCode =
    typeof (error as { statusCode?: number })?.statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : 500;

  if (statusCode === 429) {
    const body: ApiErrorBody = {
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please slow down and try again.",
        requestId,
      },
    };
    void reply.status(429).send(body);
    return;
  }

  if (statusCode < 500) {
    const message =
      typeof (error as { message?: string })?.message === "string"
        ? (error as { message: string }).message
        : "The request could not be processed.";
    const body: ApiErrorBody = {
      error: {
        code: (error as { code?: string })?.code ?? "BAD_REQUEST",
        message,
        requestId,
      },
    };
    void reply.status(statusCode).send(body);
    return;
  }

  request.log.error({ err: error, requestId }, "Unhandled error");
  const body: ApiErrorBody = {
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong on our side. Please try again.",
      requestId,
    },
  };
  void reply.status(500).send(body);
}

export function notFoundHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const body: ApiErrorBody = {
    error: {
      code: "NOT_FOUND",
      message: `Route ${request.method} ${request.url} does not exist.`,
      requestId: request.id,
    },
  };
  void reply.status(404).send(body);
}
