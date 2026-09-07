import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { sql } from "drizzle-orm";
import { authRoutes } from "./modules/auth/routes.js";
import { accountRoutes } from "./modules/accounts/routes.js";
import { adminRoutes } from "./modules/admin/routes.js";
import { transactionRoutes } from "./modules/transactions/routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { db } from "./db/index.js";
import { asyncHandler } from "./lib/async-handler.js";

/** In-memory Express app. Tests use this. `server.ts` is what listens. */
export function buildApp(): Express {
  const app = express();
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
  const sessionSecret =
    process.env.SESSION_SECRET ?? "dev-session-secret-change-in-production";

  app.use(
    cors({
      origin: frontendUrl,
      credentials: true,
    }),
  );
  app.use(cookieParser(sessionSecret));
  app.use(express.json());

  app.get(
    "/api/health",
    asyncHandler(async (_request, response) => {
      try {
        await db.execute(sql`SELECT 1`);
        response.json({
          status: "ok",
          server: "up",
          database: "connected",
        });
      } catch {
        response.status(503).json({
          status: "error",
          server: "up",
          database: "disconnected",
        });
      }
    }),
  );

  authRoutes(app);
  accountRoutes(app);
  adminRoutes(app);
  transactionRoutes(app);

  app.use((_request, response) => {
    response.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
      },
    });
  });

  app.use(errorHandler);

  return app;
}
