/**
 * Domain errors the API can return. The client maps `code`, not HTTP text.
 * Unknown failures become INTERNAL_ERROR in the error handler. No stack traces.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "ACCOUNT_NOT_FOUND"
  | "DESTINATION_ACCOUNT_NOT_FOUND"
  | "INSUFFICIENT_FUNDS"
  | "INVALID_AMOUNT"
  | "SAME_ACCOUNT_TRANSFER"
  | "EMAIL_TAKEN"
  | "INVALID_PIN"
  | "ACCOUNT_CLOSED"
  | "INTERNAL_ERROR";

/** Thrown from services. The Express error handler turns this into JSON. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function validationError(message: string, details?: unknown): AppError {
  return new AppError("VALIDATION_ERROR", message, 400, details);
}

export function unauthorized(message = "Unauthorized"): AppError {
  return new AppError("UNAUTHORIZED", message, 401);
}

export function forbidden(message = "Forbidden"): AppError {
  return new AppError("FORBIDDEN", message, 403);
}

export function emailTaken(message = "Email already in use"): AppError {
  return new AppError("EMAIL_TAKEN", message, 409);
}

export function invalidPin(message = "Incorrect PIN"): AppError {
  return new AppError("INVALID_PIN", message, 401);
}

export function accountClosed(message = "Account is closed"): AppError {
  return new AppError("ACCOUNT_CLOSED", message, 403);
}

export function accountNotFound(message = "Account not found"): AppError {
  return new AppError("ACCOUNT_NOT_FOUND", message, 404);
}

export function destinationAccountNotFound(
  message = "Destination account not found",
): AppError {
  return new AppError("DESTINATION_ACCOUNT_NOT_FOUND", message, 404);
}

export function insufficientFunds(
  message = "Insufficient funds",
): AppError {
  return new AppError("INSUFFICIENT_FUNDS", message, 409);
}

export function invalidAmount(message = "Invalid amount"): AppError {
  return new AppError("INVALID_AMOUNT", message, 400);
}

export function sameAccountTransfer(
  message = "Cannot transfer to the same account",
): AppError {
  return new AppError("SAME_ACCOUNT_TRANSFER", message, 400);
}
