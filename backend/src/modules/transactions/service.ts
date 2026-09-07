import { eq, sql } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import { accounts, transactions } from "../../db/schema.js";
import { formatSortCode } from "../../lib/account-numbers.js";
import {
  accountClosed,
  accountNotFound,
  destinationAccountNotFound,
  insufficientFunds,
  invalidAmount,
  sameAccountTransfer,
} from "../../lib/errors.js";
import { isPositiveMinorUnits, type Currency } from "../../lib/money.js";
import {
  maskAccountNumber,
  ownedFromRow,
  toAccountResponse,
  type OwnedRow,
} from "../accounts/service.js";

export type TransferResult = {
  transfer: {
    id: string;
    amount: { amount: number; currency: Currency };
    sourceAccountId: string;
    destinationAccountId: string | null;
    destinationHolderName: string;
    destinationMaskedAccountNumber: string;
    rail: "puro" | "external";
    createdAt: string;
  };
  account: ReturnType<typeof toAccountResponse>;
};

export type PayeePreview = {
  rail: "puro" | "external";
  name: string;
  sortCode: string;
  accountNumber: string;
};

type QueryExecutor = Pick<Database, "execute">;

type ResolvedPayee =
  | { rail: "puro"; destination: OwnedRow }
  | {
      rail: "external";
      sortCodeDigits: string;
      accountNumber: string;
      name: string;
    };

async function loadOwnedByUser(
  executor: QueryExecutor,
  userId: string,
): Promise<OwnedRow | undefined> {
  const rows = await executor.execute<OwnedRow>(sql`
    SELECT a.id, a.user_id, a.currency, a.balance, a.created_at, a.updated_at,
           a.account_number, a.card_last4, a.card_number, a.closed_at,
           u.name AS holder_name, b.sort_code
    FROM accounts a
    INNER JOIN users u ON u.id = a.user_id
    INNER JOIN banks b ON b.id = u.bank_id
    WHERE a.user_id = ${userId}
    LIMIT 1
  `);
  return rows[0];
}

async function loadPayeeByCoordinates(
  executor: QueryExecutor,
  sortCodeDigits: string,
  accountNumber: string,
): Promise<OwnedRow | undefined> {
  const rows = await executor.execute<OwnedRow>(sql`
    SELECT a.id, a.user_id, a.currency, a.balance, a.created_at, a.updated_at,
           a.account_number, a.card_last4, a.card_number, a.closed_at,
           u.name AS holder_name, b.sort_code
    FROM accounts a
    INNER JOIN users u ON u.id = a.user_id
    INNER JOIN banks b ON b.id = u.bank_id
    WHERE a.account_number = ${accountNumber}
      AND b.sort_code = ${sortCodeDigits}
      AND u.role = 'customer'
    LIMIT 1
  `);
  return rows[0];
}

function isOwnCoordinates(
  source: OwnedRow,
  sortCodeDigits: string,
  accountNumber: string,
): boolean {
  return (
    source.sort_code === sortCodeDigits &&
    source.account_number === accountNumber
  );
}

function externalPayeeName(
  sortCodeDigits: string,
  accountNumber: string,
): string {
  return `${formatSortCode(sortCodeDigits)} / ${accountNumber}`;
}

async function resolvePayee(
  executor: QueryExecutor,
  source: OwnedRow,
  sortCodeDigits: string,
  accountNumber: string,
): Promise<ResolvedPayee> {
  if (isOwnCoordinates(source, sortCodeDigits, accountNumber)) {
    throw sameAccountTransfer();
  }

  if (sortCodeDigits === source.sort_code) {
    const destination = await loadPayeeByCoordinates(
      executor,
      sortCodeDigits,
      accountNumber,
    );
    if (!destination || destination.closed_at) {
      throw destinationAccountNotFound();
    }
    return { rail: "puro", destination };
  }

  return {
    rail: "external",
    sortCodeDigits,
    accountNumber,
    name: externalPayeeName(sortCodeDigits, accountNumber),
  };
}

function toPayeePreview(resolved: ResolvedPayee): PayeePreview {
  switch (resolved.rail) {
    case "puro":
      return {
        rail: "puro",
        name: resolved.destination.holder_name,
        sortCode: formatSortCode(resolved.destination.sort_code),
        accountNumber: resolved.destination.account_number,
      };
    case "external":
      return {
        rail: "external",
        name: "another bank",
        sortCode: formatSortCode(resolved.sortCodeDigits),
        accountNumber: resolved.accountNumber,
      };
    default: {
      const _exhaustive: never = resolved;
      throw new Error(`Unhandled payee rail: ${_exhaustive}`);
    }
  }
}

/**
 * Confirm a payee from sort code + account number. Does not return account ids.
 * A non-Puro sort code is an outbound payment, not an error.
 */
export async function lookupPayee(
  db: Database,
  authenticatedUserId: string,
  sortCodeDigits: string,
  accountNumber: string,
): Promise<PayeePreview> {
  const source = await loadOwnedByUser(db, authenticatedUserId);
  if (!source) {
    throw accountNotFound();
  }
  if (source.closed_at) {
    throw accountClosed();
  }

  const resolved = await resolvePayee(
    db,
    source,
    sortCodeDigits,
    accountNumber,
  );
  return toPayeePreview(resolved);
}

/**
 * Atomic transfer with deterministic lock ordering to avoid deadlocks.
 *
 * Lock order (in-bank): always lock the account with the lexicographically
 * smaller id first. Outbound payments lock the source only.
 * Ownership of the source is verified from the authenticated userId, never from
 * a client-supplied source account id. Destination is resolved from sort code +
 * account number, never from a client-supplied destination id.
 */
export async function transfer(
  db: Database,
  authenticatedUserId: string,
  sortCodeDigits: string,
  accountNumber: string,
  amount: number,
  currency: Currency,
): Promise<TransferResult> {
  if (!isPositiveMinorUnits(amount)) {
    throw invalidAmount("Amount must be a positive integer in minor units");
  }
  if (currency !== "GBP") {
    throw invalidAmount("Unsupported currency");
  }

  return db.transaction(async (tx) => {
    const sourceMeta = await loadOwnedByUser(tx, authenticatedUserId);
    if (!sourceMeta) {
      throw accountNotFound();
    }

    const resolved = await resolvePayee(
      tx,
      sourceMeta,
      sortCodeDigits,
      accountNumber,
    );

    switch (resolved.rail) {
      case "external":
        return postOutboundTransfer(tx, {
          sourceMeta,
          authenticatedUserId,
          amount,
          currency,
          sortCodeDigits: resolved.sortCodeDigits,
          accountNumber: resolved.accountNumber,
          payeeName: resolved.name,
        });
      case "puro":
        return postInBankTransfer(tx, {
          sourceMeta,
          destinationMeta: resolved.destination,
          authenticatedUserId,
          amount,
          currency,
        });
      default: {
        const _exhaustive: never = resolved;
        throw new Error(`Unhandled payee rail: ${_exhaustive}`);
      }
    }
  });
}

async function postOutboundTransfer(
  tx: QueryExecutor & Pick<Database, "update" | "insert">,
  input: {
    sourceMeta: OwnedRow;
    authenticatedUserId: string;
    amount: number;
    currency: Currency;
    sortCodeDigits: string;
    accountNumber: string;
    payeeName: string;
  },
): Promise<TransferResult> {
  const locked = await tx.execute<OwnedRow>(sql`
    SELECT a.id, a.user_id, a.currency, a.balance, a.created_at, a.updated_at,
           a.account_number, a.card_last4, a.card_number, a.closed_at,
           u.name AS holder_name, b.sort_code
    FROM accounts a
    INNER JOIN users u ON u.id = a.user_id
    INNER JOIN banks b ON b.id = u.bank_id
    WHERE a.id = ${input.sourceMeta.id}
    FOR UPDATE OF a
  `);
  const source = locked[0];
  if (!source) {
    throw accountNotFound();
  }
  if (source.user_id !== input.authenticatedUserId) {
    throw accountNotFound();
  }
  if (source.currency !== input.currency) {
    throw invalidAmount("Currency does not match account currency");
  }
  if (source.closed_at) {
    throw accountClosed();
  }

  const sourceBalance = Number(source.balance);
  if (sourceBalance < input.amount) {
    throw insufficientFunds();
  }

  const newSourceBalance = sourceBalance - input.amount;
  const now = new Date();

  await tx
    .update(accounts)
    .set({ balance: newSourceBalance, updatedAt: now })
    .where(eq(accounts.id, source.id));

  const [txn] = await tx
    .insert(transactions)
    .values({
      type: "TRANSFER",
      sourceAccountId: source.id,
      destinationAccountId: null,
      payeeSortCode: input.sortCodeDigits,
      payeeAccountNumber: input.accountNumber,
      payeeName: input.payeeName,
      amount: input.amount,
      currency: input.currency,
    })
    .returning();

  if (!txn) {
    throw new Error("Failed to create transfer transaction");
  }

  return {
    transfer: {
      id: txn.id,
      amount: { amount: txn.amount, currency: txn.currency },
      sourceAccountId: source.id,
      destinationAccountId: null,
      destinationHolderName: "another bank",
      destinationMaskedAccountNumber: maskAccountNumber(input.accountNumber),
      rail: "external",
      createdAt: txn.createdAt.toISOString(),
    },
    account: toAccountResponse(
      ownedFromRow(source, { balance: newSourceBalance, updatedAt: now }),
    ),
  };
}

async function postInBankTransfer(
  tx: QueryExecutor & Pick<Database, "update" | "insert">,
  input: {
    sourceMeta: OwnedRow;
    destinationMeta: OwnedRow;
    authenticatedUserId: string;
    amount: number;
    currency: Currency;
  },
): Promise<TransferResult> {
  const destinationAccountId = input.destinationMeta.id;

  const firstId =
    input.sourceMeta.id < destinationAccountId
      ? input.sourceMeta.id
      : destinationAccountId;
  const secondId =
    input.sourceMeta.id < destinationAccountId
      ? destinationAccountId
      : input.sourceMeta.id;

  const locked = await tx.execute<OwnedRow>(sql`
    SELECT a.id, a.user_id, a.currency, a.balance, a.created_at, a.updated_at,
           a.account_number, a.card_last4, a.card_number, a.closed_at,
           u.name AS holder_name, b.sort_code
    FROM accounts a
    INNER JOIN users u ON u.id = a.user_id
    INNER JOIN banks b ON b.id = u.bank_id
    WHERE a.id = ${firstId} OR a.id = ${secondId}
    ORDER BY a.id
    FOR UPDATE OF a
  `);

  const byId = new Map(locked.map((row) => [row.id, row]));
  const source = byId.get(input.sourceMeta.id);
  const destination = byId.get(destinationAccountId);

  if (!source) {
    throw accountNotFound();
  }
  if (!destination) {
    throw destinationAccountNotFound();
  }
  if (source.user_id !== input.authenticatedUserId) {
    throw accountNotFound();
  }
  if (source.currency !== input.currency || destination.currency !== input.currency) {
    throw invalidAmount("Currency does not match account currency");
  }
  if (source.closed_at) {
    throw accountClosed();
  }
  if (destination.closed_at) {
    throw destinationAccountNotFound();
  }

  const sourceBalance = Number(source.balance);
  const destinationBalance = Number(destination.balance);

  if (sourceBalance < input.amount) {
    throw insufficientFunds();
  }

  const newSourceBalance = sourceBalance - input.amount;
  const newDestinationBalance = destinationBalance + input.amount;
  const now = new Date();

  await tx
    .update(accounts)
    .set({ balance: newSourceBalance, updatedAt: now })
    .where(eq(accounts.id, source.id));

  await tx
    .update(accounts)
    .set({ balance: newDestinationBalance, updatedAt: now })
    .where(eq(accounts.id, destination.id));

  const [txn] = await tx
    .insert(transactions)
    .values({
      type: "TRANSFER",
      sourceAccountId: source.id,
      destinationAccountId: destination.id,
      payeeSortCode: destination.sort_code,
      payeeAccountNumber: destination.account_number,
      payeeName: destination.holder_name,
      amount: input.amount,
      currency: input.currency,
    })
    .returning();

  if (!txn) {
    throw new Error("Failed to create transfer transaction");
  }

  return {
    transfer: {
      id: txn.id,
      amount: { amount: txn.amount, currency: txn.currency },
      sourceAccountId: source.id,
      destinationAccountId: destination.id,
      destinationHolderName: destination.holder_name,
      destinationMaskedAccountNumber: maskAccountNumber(
        destination.account_number,
      ),
      rail: "puro",
      createdAt: txn.createdAt.toISOString(),
    },
    account: toAccountResponse(
      ownedFromRow(source, { balance: newSourceBalance, updatedAt: now }),
    ),
  };
}
