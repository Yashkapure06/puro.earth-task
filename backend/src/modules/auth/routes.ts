import type { Express } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import { users, type User } from "../../db/schema.js";
import { unauthorized, validationError } from "../../lib/errors.js";
import { verifyPassword } from "../../lib/password.js";
import { asyncHandler } from "../../lib/async-handler.js";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  requireAuth,
  sessionTokenFromRequest,
  setSessionCookie,
} from "../../middleware/auth.js";
import { createCustomer } from "../customers/service.js";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

const registerBodySchema = credentialsSchema.extend({
  name: z.string().trim().min(1).max(80),
});

function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

async function defaultBankId(): Promise<string> {
  const bank = await db.query.banks.findFirst();
  if (!bank) {
    throw new Error("No bank is configured");
  }
  return bank.id;
}

export function authRoutes(app: Express): void {
  app.post(
    "/api/auth/register",
    asyncHandler(async (request, response) => {
      const parsed = registerBodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw validationError(
          "Invalid registration payload",
          parsed.error.flatten(),
        );
      }

      const { user } = await createCustomer(db, {
        bankId: await defaultBankId(),
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
      });

      const session = await createSession(user.id);
      setSessionCookie(response, session.token, session.expiresAt);
      response.json({ user: toPublicUser(user) });
    }),
  );

  app.post(
    "/api/auth/login",
    asyncHandler(async (request, response) => {
      const parsed = credentialsSchema.safeParse(request.body);
      if (!parsed.success) {
        throw validationError("Invalid login payload", parsed.error.flatten());
      }

      const email = parsed.data.email.toLowerCase();
      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (
        !user ||
        !(await verifyPassword(parsed.data.password, user.passwordHash))
      ) {
        throw unauthorized("Invalid credentials");
      }

      const session = await createSession(user.id);
      setSessionCookie(response, session.token, session.expiresAt);
      response.json({ user: toPublicUser(user) });
    }),
  );

  app.post(
    "/api/auth/logout",
    asyncHandler(async (request, response) => {
      await destroySession(sessionTokenFromRequest(request));
      clearSessionCookie(response);
      response.status(204).end();
    }),
  );

  app.get(
    "/api/me",
    requireAuth,
    asyncHandler(async (request, response) => {
      response.json(toPublicUser(request.currentUser!));
    }),
  );
}
