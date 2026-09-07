import type { Express } from "express";
import { z } from "zod";
import { db } from "../../db/index.js";
import { validationError } from "../../lib/errors.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireCustomer } from "../../middleware/auth.js";
import {
  deposit,
  getOwnedAccount,
  revealCardNumber,
  toAccountResponse,
  withdraw,
} from "./service.js";

const amountBodySchema = z.object({
  amount: z.number().int().positive(),
  currency: z.literal("GBP").default("GBP"),
});

export function accountRoutes(app: Express): void {
  app.get(
    "/api/accounts/me",
    requireCustomer,
    asyncHandler(async (request, response) => {
      const user = request.currentUser!;
      const account = await getOwnedAccount(db, user.id);
      response.json(toAccountResponse(account));
    }),
  );

  app.post(
    "/api/accounts/me/card",
    requireCustomer,
    asyncHandler(async (request, response) => {
      const parsed = z
        .object({ pin: z.string().length(4) })
        .safeParse(request.body);
      if (!parsed.success) {
        throw validationError("Invalid PIN payload", parsed.error.flatten());
      }
      response.json(
        await revealCardNumber(db, request.currentUser!.id, parsed.data.pin),
      );
    }),
  );

  app.post(
    "/api/accounts/me/deposit",
    requireCustomer,
    asyncHandler(async (request, response) => {
      const parsed = amountBodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw validationError("Invalid deposit payload", parsed.error.flatten());
      }

      const user = request.currentUser!;
      const result = await deposit(
        db,
        user.id,
        parsed.data.amount,
        parsed.data.currency,
      );

      response.json({
        account: result.account,
        transaction: {
          id: result.transaction!.id,
          type: result.transaction!.type,
          amount: {
            amount: result.transaction!.amount,
            currency: result.transaction!.currency,
          },
          createdAt: result.transaction!.createdAt.toISOString(),
        },
      });
    }),
  );

  app.post(
    "/api/accounts/me/withdraw",
    requireCustomer,
    asyncHandler(async (request, response) => {
      const parsed = amountBodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw validationError(
          "Invalid withdrawal payload",
          parsed.error.flatten(),
        );
      }

      const user = request.currentUser!;
      const result = await withdraw(
        db,
        user.id,
        parsed.data.amount,
        parsed.data.currency,
      );

      response.json({
        account: result.account,
        transaction: {
          id: result.transaction!.id,
          type: result.transaction!.type,
          amount: {
            amount: result.transaction!.amount,
            currency: result.transaction!.currency,
          },
          createdAt: result.transaction!.createdAt.toISOString(),
        },
      });
    }),
  );
}
