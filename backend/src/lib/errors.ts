/**
 * Application error taxonomy. Route handlers throw these; the global error
 * handler turns them into consistent JSON responses.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "The request could not be understood.", details?: unknown) {
    super(400, "BAD_REQUEST", message, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Some fields need attention.", details?: unknown) {
    super(422, "VALIDATION_ERROR", message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "You need to sign in to continue.") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this resource.") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "That record could not be found.") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "That record already exists.", details?: unknown) {
    super(409, "CONFLICT", message, details);
  }
}

export class UnauthorizedDeviceError extends AppError {
  constructor(message = "This device is not authorised to post notifications.") {
    super(401, "UNAUTHORIZED_DEVICE", message);
  }
}
