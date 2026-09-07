import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/**
 * Map thrown errors to `{ error: { code, message } }`.
 * AppError and Zod stay 4xx. Anything else is INTERNAL_ERROR (no internals).
 */
function toErrorBody(error: unknown): {
  statusCode: number;
  body: ApiErrorBody;
} {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      },
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: error.flatten(),
        },
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    },
  };
}

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  const mapped = toErrorBody(error);

  if (mapped.statusCode >= 500 && process.env.NODE_ENV !== "test") {
    console.error(error);
  }

  response.status(mapped.statusCode).json(mapped.body);
}
