import { and, eq, ne } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import { accounts, users } from "../../db/schema.js";
import { generateAccountNumber, generateCardNumber } from "../../lib/account-numbers.js";
import { accountNotFound, emailTaken } from "../../lib/errors.js";
import { hashPassword } from "../../lib/password.js";

export type NewCustomer = {
  bankId: string;
  name: string;
  email: string;
  password: string;
  openingBalance?: number;
};

export async function createCustomer(db: Database, input: NewCustomer) {
  const email = input.email.toLowerCase();
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    throw emailTaken();
  }

  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        bankId: input.bankId,
        email,
        name: input.name.trim(),
        passwordHash,
        role: "customer",
      })
      .returning();

    if (!user) {
      throw new Error("Failed to create customer");
    }

    let accountNumber = generateAccountNumber();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const clash = await tx.query.accounts.findFirst({
        where: eq(accounts.accountNumber, accountNumber),
      });
      if (!clash) break;
      accountNumber = generateAccountNumber();
    }

    const card = generateCardNumber();
    const [account] = await tx
      .insert(accounts)
      .values({
        userId: user.id,
        currency: "GBP",
        balance: input.openingBalance ?? 0,
        accountNumber,
        cardLast4: card.last4,
        cardNumber: card.number,
      })
      .returning();

    if (!account) {
      throw new Error("Failed to open account");
    }

    return { user, account };
  });
}

export async function updateCustomer(
  db: Database,
  input: { adminBankId: string; userId: string; name: string; email: string },
) {
  const email = input.email.toLowerCase();
  const target = await db.query.users.findFirst({
    where: eq(users.id, input.userId),
  });
  if (
    !target ||
    target.bankId !== input.adminBankId ||
    target.role !== "customer"
  ) {
    throw accountNotFound("Customer not found");
  }

  const clash = await db.query.users.findFirst({
    where: and(eq(users.email, email), ne(users.id, input.userId)),
  });
  if (clash) {
    throw emailTaken();
  }

  const [user] = await db
    .update(users)
    .set({ name: input.name.trim(), email })
    .where(eq(users.id, input.userId))
    .returning();

  if (!user) {
    throw accountNotFound("Customer not found");
  }
  return user;
}

export async function closeCustomerAccount(
  db: Database,
  input: { adminBankId: string; userId: string },
) {
  const target = await db.query.users.findFirst({
    where: eq(users.id, input.userId),
  });
  if (
    !target ||
    target.bankId !== input.adminBankId ||
    target.role !== "customer"
  ) {
    throw accountNotFound("Customer not found");
  }

  const [account] = await db
    .update(accounts)
    .set({ closedAt: new Date(), updatedAt: new Date() })
    .where(eq(accounts.userId, input.userId))
    .returning();

  if (!account) {
    throw accountNotFound("Account not found");
  }
  return account;
}
