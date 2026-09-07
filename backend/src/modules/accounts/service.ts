import { eq, sql } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import { accounts, transactions, type Account } from "../../db/schema.js";
import {
  formatCardNumber,
  formatSortCode,
  maskDigits,
} from "../../lib/account-numbers.js";
import { isValidAuthorizePin } from "../../lib/authorize-pin.js";
import {
  accountClosed,
  accountNotFound,
  insufficientFunds,
  invalidAmount,
  invalidPin,
} from "../../lib/errors.js";
import { isPositiveMinorUnits, type Currency } from "../../lib/money.js";

export type AccountWithHolder = Account & {
  holderName: string;
  sortCode: string;
};

export type AccountResponse = {
  id: string;
  userId: string;
  currency: Currency;
  balance: {
    amount: number;
    currency: Currency;
  };
  accountNumber: string;
  sortCode: string;
  maskedAccountNumber: string;
  maskedCardNumber: string;
  holderName: string;
  closed: boolean;
  updatedAt: string;
};

export type OwnedRow = {
  id: string;
  user_id: string;
  currency: Currency;
  balance: string | number;
  created_at: Date;
  updated_at: Date;
  account_number: string;
  card_last4: string;
  card_number: string;
  closed_at: Date | null;
  holder_name: string;
  sort_code: string;
};

const OWNED_COLUMNS = sql.raw(`
  a.id, a.user_id, a.currency, a.balance, a.created_at, a.updated_at,
  a.account_number, a.card_last4, a.card_number, a.closed_at,
  u.name AS holder_name, b.sort_code
`);

export function ownedFromRow(
  row: OwnedRow,
  overrides?: { balance?: number; updatedAt?: Date },
): AccountWithHolder {
  return {
    id: row.id,
    userId: row.user_id,
    currency: row.currency,
    balance: overrides?.balance ?? Number(row.balance),
    accountNumber: row.account_number,
    cardLast4: row.card_last4,
    cardNumber: row.card_number,
    closedAt: row.closed_at ? new Date(row.closed_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: overrides?.updatedAt ?? new Date(row.updated_at),
    holderName: row.holder_name,
    sortCode: row.sort_code,
  };
}

export function maskAccountNumber(accountNumber: string): string {
  return maskDigits(accountNumber);
}

/** Account for this user only. Callers pass the session user id, never a client account id. */
export async function getOwnedAccount(
  db: Database,
  userId: string,
): Promise<AccountWithHolder> {
  const rows = await db.execute<OwnedRow>(sql`
    SELECT ${OWNED_COLUMNS}
    FROM accounts a
    INNER JOIN users u ON u.id = a.user_id
    INNER JOIN banks b ON b.id = u.bank_id
    WHERE a.user_id = ${userId}
    LIMIT 1
  `);

  const row = rows[0];
  if (!row) {
    throw accountNotFound();
  }

  return ownedFromRow(row);
}

export function toAccountResponse(account: AccountWithHolder): AccountResponse {
  const updatedAt =
    account.updatedAt instanceof Date
      ? account.updatedAt
      : new Date(account.updatedAt);

  return {
    id: account.id,
    userId: account.userId,
    currency: account.currency,
    balance: {
      amount: account.balance,
      currency: account.currency,
    },
    accountNumber: account.accountNumber,
    sortCode: formatSortCode(account.sortCode),
    maskedAccountNumber: maskAccountNumber(account.accountNumber),
    maskedCardNumber: maskDigits(account.cardLast4),
    holderName: account.holderName,
    closed: account.closedAt !== null,
    updatedAt: updatedAt.toISOString(),
  };
}

export function assertAccountOpen(account: AccountWithHolder): void {
  if (account.closedAt) {
    throw accountClosed();
  }
}

export async function revealCardNumber(
  db: Database,
  userId: string,
  pin: string,
): Promise<{ cardNumber: string }> {
  if (!isValidAuthorizePin(pin)) {
    throw invalidPin();
  }
  const account = await getOwnedAccount(db, userId);
  assertAccountOpen(account);
  return { cardNumber: formatCardNumber(account.cardNumber) };
}

function validateMutationAmount(amount: number, currency: Currency): void {
  if (!isPositiveMinorUnits(amount)) {
    throw invalidAmount("Amount must be a positive integer in minor units");
  }
  if (currency !== "GBP") {
    throw invalidAmount("Unsupported currency");
  }
}

/**
 * Atomically deposit into the authenticated user's account.
 * Locks the account row, updates balance, inserts transaction.
 */
export async function deposit(
  db: Database,
  userId: string,
  amount: number,
  currency: Currency,
) {
  validateMutationAmount(amount, currency);

  return db.transaction(async (tx) => {
    const locked = await tx.execute<OwnedRow>(sql`
      SELECT ${OWNED_COLUMNS}
      FROM accounts a
      INNER JOIN users u ON u.id = a.user_id
      INNER JOIN banks b ON b.id = u.bank_id
      WHERE a.user_id = ${userId}
      FOR UPDATE OF a
    `);

    const account = locked[0];
    if (!account) {
      throw accountNotFound();
    }
    if (account.currency !== currency) {
      throw invalidAmount("Currency does not match account currency");
    }
    assertAccountOpen(ownedFromRow(account));

    const currentBalance = Number(account.balance);
    const newBalance = currentBalance + amount;
    const now = new Date();

    await tx
      .update(accounts)
      .set({ balance: newBalance, updatedAt: now })
      .where(eq(accounts.id, account.id));

    const [txn] = await tx
      .insert(transactions)
      .values({
        type: "DEPOSIT",
        sourceAccountId: null,
        destinationAccountId: account.id,
        amount,
        currency,
      })
      .returning();

    return {
      account: toAccountResponse(ownedFromRow(account, { balance: newBalance, updatedAt: now })),
      transaction: txn,
    };
  });
}

/**
 * Atomically withdraw from the authenticated user's account.
 * Never allows negative balances.
 */
export async function withdraw(
  db: Database,
  userId: string,
  amount: number,
  currency: Currency,
) {
  validateMutationAmount(amount, currency);

  return db.transaction(async (tx) => {
    const locked = await tx.execute<OwnedRow>(sql`
      SELECT ${OWNED_COLUMNS}
      FROM accounts a
      INNER JOIN users u ON u.id = a.user_id
      INNER JOIN banks b ON b.id = u.bank_id
      WHERE a.user_id = ${userId}
      FOR UPDATE OF a
    `);

    const account = locked[0];
    if (!account) {
      throw accountNotFound();
    }
    if (account.currency !== currency) {
      throw invalidAmount("Currency does not match account currency");
    }
    assertAccountOpen(ownedFromRow(account));

    const currentBalance = Number(account.balance);
    if (currentBalance < amount) {
      throw insufficientFunds();
    }

    const newBalance = currentBalance - amount;
    const now = new Date();

    await tx
      .update(accounts)
      .set({ balance: newBalance, updatedAt: now })
      .where(eq(accounts.id, account.id));

    const [txn] = await tx
      .insert(transactions)
      .values({
        type: "WITHDRAWAL",
        sourceAccountId: account.id,
        destinationAccountId: null,
        amount,
        currency,
      })
      .returning();

    return {
      account: toAccountResponse(ownedFromRow(account, { balance: newBalance, updatedAt: now })),
      transaction: txn,
    };
  });
}
