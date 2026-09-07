import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { db } from "../db/index.js";
import { sessions, users, type User, type UserRole } from "../db/schema.js";
import { asyncHandler } from "../lib/async-handler.js";
import { forbidden, unauthorized } from "../lib/errors.js";

declare module "express-serve-static-core" {
  interface Request {
    currentUser?: User;
  }
}

/** Cookie name. Raw token goes to the browser; only the SHA-256 hash is stored. */
export const SESSION_COOKIE = "puro_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

const cookieBase = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  signed: true,
};

/** SHA-256 of the cookie value. A leaked database row is not a live session. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(userId: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({
    userId,
    token: hashToken(token),
    expiresAt,
  });

  return { token, expiresAt };
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.token, hashToken(token)));
}

export async function resolveUserFromToken(
  token: string | undefined,
): Promise<User | null> {
  if (!token) return null;

  const now = new Date();
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(eq(sessions.token, hashToken(token)), gt(sessions.expiresAt, now)),
    )
    .limit(1);

  return rows[0]?.user ?? null;
}

export function sessionTokenFromRequest(request: Request): string | undefined {
  const signed = request.signedCookies[SESSION_COOKIE];
  if (typeof signed === "string" && signed.length > 0) {
    return signed;
  }
  const raw = request.cookies[SESSION_COOKIE];
  return typeof raw === "string" ? raw : undefined;
}

/** Attach `request.currentUser` from the session cookie. No user, 401. */
export const requireAuth: RequestHandler = asyncHandler(
  async (request, _response, next) => {
    const user = await resolveUserFromToken(sessionTokenFromRequest(request));
    if (!user) {
      throw unauthorized();
    }
    request.currentUser = user;
    next();
  },
);

export function requireRole(role: UserRole): RequestHandler {
  return (request: Request, response: Response, next: NextFunction): void => {
    requireAuth(request, response, (error?: unknown) => {
      if (error) {
        next(error);
        return;
      }
      if (request.currentUser?.role !== role) {
        next(forbidden());
        return;
      }
      next();
    });
  };
}

export const requireCustomer = requireRole("customer");
export const requireAdmin = requireRole("admin");

export function setSessionCookie(
  response: Response,
  token: string,
  expiresAt: Date,
): void {
  response.cookie(SESSION_COOKIE, token, {
    ...cookieBase,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(SESSION_COOKIE, cookieBase);
}
