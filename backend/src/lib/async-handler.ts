import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express does not catch rejected promises. Wrap async routes and pass
 * the error to `next` so the shared error handler can format it.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}
