import type { Express } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import {
  formatSortCode,
  normalizeAccountNumber,
  normalizeSortCode,
} from "../../lib/account-numbers.js";
import { validationError } from "../../lib/errors.js";
import type { Currency } from "../../lib/money.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireCustomer } from "../../middleware/auth.js";
import { getOwnedAccount, maskAccountNumber } from "../accounts/service.js";
import { lookupPayee, transfer } from "./service.js";

const payeeBodySchema = z.object({
  sortCode: z.string(),
  accountNumber: z.string(),
});

const transferBodySchema = payeeBodySchema.extend({
  amount: z.number().int().positive(),
  currency: z.literal("GBP").default("GBP"),
});

function parsePayeeCoordinates(input: {
  sortCode: string;
  accountNumber: string;
}): { sortCodeDigits: string; accountNumber: string } {
  const sortCodeDigits = normalizeSortCode(input.sortCode);
  const accountNumber = normalizeAccountNumber(input.accountNumber);
  if (!sortCodeDigits || !accountNumber) {
    throw validationError("Enter a valid sort code and account number");
  }
  return { sortCodeDigits, accountNumber };
}

type TransactionListItem = {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "TRANSFER";
  amount: { amount: number; currency: Currency };
  /** Signed amount from the perspective of the current user's account */
  signedAmount: { amount: number; currency: Currency };
  counterpartyName: string | null;
  counterpartyMaskedAccountNumber: string | null;
  createdAt: string;
};

export function transactionRoutes(app: Express): void {
  app.post(
    "/api/transfers/preview",
    requireCustomer,
    asyncHandler(async (request, response) => {
      const parsed = payeeBodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw validationError("Invalid payee payload", parsed.error.flatten());
      }

      const { sortCodeDigits, accountNumber } = parsePayeeCoordinates(
        parsed.data,
      );
      response.json(
        await lookupPayee(
          db,
          request.currentUser!.id,
          sortCodeDigits,
          accountNumber,
        ),
      );
    }),
  );

  app.post(
    "/api/transfers",
    requireCustomer,
    asyncHandler(async (request, response) => {
      const parsed = transferBodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw validationError("Invalid transfer payload", parsed.error.flatten());
      }

      const { sortCodeDigits, accountNumber } = parsePayeeCoordinates(
        parsed.data,
      );
      const user = request.currentUser!;
      response.json(
        await transfer(
          db,
          user.id,
          sortCodeDigits,
          accountNumber,
          parsed.data.amount,
          parsed.data.currency,
        ),
      );
    }),
  );

  app.get(
    "/api/transactions",
    requireCustomer,
    asyncHandler(async (request, response) => {
      const user = request.currentUser!;
      const account = await getOwnedAccount(db, user.id);

      const rows = await db.execute<{
        id: string;
        type: "DEPOSIT" | "WITHDRAWAL" | "TRANSFER";
        amount: string | number;
        currency: Currency;
        created_at: Date;
        source_account_id: string | null;
        destination_account_id: string | null;
        source_holder: string | null;
        destination_holder: string | null;
        source_account_number: string | null;
        destination_account_number: string | null;
        payee_sort_code: string | null;
        payee_account_number: string | null;
        payee_name: string | null;
      }>(sql`
      SELECT
        t.id,
        t.type,
        t.amount,
        t.currency,
        t.created_at,
        t.source_account_id,
        t.destination_account_id,
        su.name AS source_holder,
        du.name AS destination_holder,
        sa.account_number AS source_account_number,
        da.account_number AS destination_account_number,
        t.payee_sort_code,
        t.payee_account_number,
        t.payee_name
      FROM transactions t
      LEFT JOIN accounts sa ON sa.id = t.source_account_id
      LEFT JOIN users su ON su.id = sa.user_id
      LEFT JOIN accounts da ON da.id = t.destination_account_id
      LEFT JOIN users du ON du.id = da.user_id
      WHERE t.source_account_id = ${account.id}
         OR t.destination_account_id = ${account.id}
      ORDER BY t.created_at DESC
      LIMIT 50
    `);

      const items: TransactionListItem[] = rows.map((row) => {
        const amount = Number(row.amount);
        let signed = amount;
        let counterpartyName: string | null = null;
        let counterpartyNumber: string | null = null;

        switch (row.type) {
          case "DEPOSIT":
            signed = amount;
            counterpartyName = "Bank deposit";
            break;
          case "WITHDRAWAL":
            signed = -amount;
            counterpartyName = "Cash withdrawal";
            break;
          case "TRANSFER":
            if (row.source_account_id === account.id) {
              signed = -amount;
              if (row.destination_holder && row.destination_account_number) {
                counterpartyName = row.destination_holder;
                counterpartyNumber = row.destination_account_number;
              } else if (row.payee_sort_code && row.payee_account_number) {
                counterpartyName = `${formatSortCode(row.payee_sort_code)} / ${maskAccountNumber(row.payee_account_number)}`;
                counterpartyNumber = row.payee_account_number;
              } else {
                counterpartyName = row.payee_name;
              }
            } else {
              signed = amount;
              counterpartyName = row.source_holder;
              counterpartyNumber = row.source_account_number;
            }
            break;
          default: {
            const _exhaustive: never = row.type;
            throw new Error(`Unhandled transaction type: ${_exhaustive}`);
          }
        }

        return {
          id: row.id,
          type: row.type,
          amount: { amount, currency: row.currency },
          signedAmount: { amount: signed, currency: row.currency },
          counterpartyName,
          counterpartyMaskedAccountNumber: counterpartyNumber
            ? maskAccountNumber(counterpartyNumber)
            : null,
          createdAt: new Date(row.created_at).toISOString(),
        };
      });

      response.json({ transactions: items });
    }),
  );
}
