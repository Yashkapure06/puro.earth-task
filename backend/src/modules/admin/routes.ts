import type { Express } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import { accounts, banks, users } from "../../db/schema.js";
import { formatSortCode } from "../../lib/account-numbers.js";
import { validationError } from "../../lib/errors.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireAdmin } from "../../middleware/auth.js";
import {
  closeCustomerAccount,
  createCustomer,
  updateCustomer,
} from "../customers/service.js";

const createCustomerBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

const updateCustomerBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().email(),
});

const customerIdParams = z.object({
  id: z.string().uuid(),
});

function customerPayload(row: {
  id: string;
  name: string;
  email: string;
  accountNumber: string;
  sortCode: string;
  closedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    accountNumber: row.accountNumber,
    sortCode: formatSortCode(row.sortCode),
    status: row.closedAt ? "closed" : "open",
    createdAt: row.createdAt.toISOString(),
  };
}

export function adminRoutes(app: Express): void {
  app.get(
    "/api/admin/customers",
    requireAdmin,
    asyncHandler(async (request, response) => {
      const admin = request.currentUser!;
      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          accountNumber: accounts.accountNumber,
          sortCode: banks.sortCode,
          closedAt: accounts.closedAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .innerJoin(accounts, eq(accounts.userId, users.id))
        .innerJoin(banks, eq(banks.id, users.bankId))
        .where(eq(users.bankId, admin.bankId));

      response.json({
        customers: rows.map((row) => customerPayload(row)),
      });
    }),
  );

  app.post(
    "/api/admin/customers",
    requireAdmin,
    asyncHandler(async (request, response) => {
      const parsed = createCustomerBodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw validationError(
          "Invalid customer payload",
          parsed.error.flatten(),
        );
      }

      const admin = request.currentUser!;
      const { user, account } = await createCustomer(db, {
        bankId: admin.bankId,
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
      });

      response.json({
        customer: {
          id: user.id,
          name: user.name,
          email: user.email,
          accountNumber: account.accountNumber,
        },
      });
    }),
  );

  app.patch(
    "/api/admin/customers/:id",
    requireAdmin,
    asyncHandler(async (request, response) => {
      const params = customerIdParams.safeParse(request.params);
      const parsed = updateCustomerBodySchema.safeParse(request.body);
      if (!params.success || !parsed.success) {
        throw validationError("Invalid customer payload");
      }

      const user = await updateCustomer(db, {
        adminBankId: request.currentUser!.bankId,
        userId: params.data.id,
        name: parsed.data.name,
        email: parsed.data.email,
      });

      response.json({
        customer: { id: user.id, name: user.name, email: user.email },
      });
    }),
  );

  app.post(
    "/api/admin/customers/:id/close",
    requireAdmin,
    asyncHandler(async (request, response) => {
      const params = customerIdParams.safeParse(request.params);
      if (!params.success) {
        throw validationError("Invalid customer id");
      }

      await closeCustomerAccount(db, {
        adminBankId: request.currentUser!.bankId,
        userId: params.data.id,
      });

      response.json({ ok: true });
    }),
  );
}
