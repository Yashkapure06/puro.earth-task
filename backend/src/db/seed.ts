import "../lib/env.js";
import { eq } from "drizzle-orm";
import { db, queryClient } from "./index.js";
import { accounts, banks, sessions, transactions, users } from "./schema.js";
import { hashPassword } from "../lib/password.js";
import { generateCardNumber } from "../lib/account-numbers.js";

export const DEMO_PASSWORD = "demo-pass";

async function seed() {
  console.log("Seeding database...");

  await db.delete(sessions);
  await db.delete(transactions);
  await db.delete(accounts);
  await db.delete(users);
  await db.delete(banks);

  const [bank] = await db
    .insert(banks)
    .values({ name: "Puro", sortCode: "040011" })
    .returning();
  if (!bank) throw new Error("Failed to seed bank");

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const [admin] = await db
    .insert(users)
    .values({
      bankId: bank.id,
      email: "admin@puro.earth.task.com",
      name: "Puro Admin",
      passwordHash,
      role: "admin",
    })
    .returning();

  const [yash] = await db
    .insert(users)
    .values({
      bankId: bank.id,
      email: "yash@puro.earth.task.com",
      name: "Yash Kapure",
      passwordHash,
      role: "customer",
    })
    .returning();

  const [alex] = await db
    .insert(users)
    .values({
      bankId: bank.id,
      email: "alex@puro.earth.task.com",
      name: "Alex Morgan",
      passwordHash,
      role: "customer",
    })
    .returning();

  if (!admin || !yash || !alex) {
    throw new Error("Failed to seed users");
  }

  const yashCard = generateCardNumber();
  const [yashAccount] = await db
    .insert(accounts)
    .values({
      userId: yash.id,
      currency: "GBP",
      balance: 428_050,
      accountNumber: "20481233",
      cardLast4: yashCard.last4,
      cardNumber: yashCard.number,
    })
    .returning();

  const alexCard = generateCardNumber();
  const [alexAccount] = await db
    .insert(accounts)
    .values({
      userId: alex.id,
      currency: "GBP",
      balance: 175_000,
      accountNumber: "31975512",
      cardLast4: alexCard.last4,
      cardNumber: alexCard.number,
    })
    .returning();

  if (!yashAccount || !alexAccount) {
    throw new Error("Failed to seed accounts");
  }

  const now = Date.now();
  const daysAgo = (days: number, hour = 12) =>
    new Date(now - days * 24 * 60 * 60 * 1000 - (12 - hour) * 60 * 60 * 1000);

  await db.insert(transactions).values([
    {
      type: "DEPOSIT",
      sourceAccountId: null,
      destinationAccountId: yashAccount.id,
      amount: 500_000,
      currency: "GBP",
      createdAt: daysAgo(14, 10),
    },
    {
      type: "TRANSFER",
      sourceAccountId: alexAccount.id,
      destinationAccountId: yashAccount.id,
      amount: 75_000,
      currency: "GBP",
      createdAt: daysAgo(10, 15),
    },
    {
      type: "WITHDRAWAL",
      sourceAccountId: yashAccount.id,
      destinationAccountId: null,
      amount: 10_000,
      currency: "GBP",
      createdAt: daysAgo(5, 11),
    },
    {
      type: "DEPOSIT",
      sourceAccountId: null,
      destinationAccountId: yashAccount.id,
      amount: 50_000,
      currency: "GBP",
      createdAt: daysAgo(2, 9),
    },
    {
      type: "TRANSFER",
      sourceAccountId: yashAccount.id,
      destinationAccountId: alexAccount.id,
      amount: 25_000,
      currency: "GBP",
      createdAt: daysAgo(1, 14),
    },
    {
      type: "DEPOSIT",
      sourceAccountId: null,
      destinationAccountId: alexAccount.id,
      amount: 200_000,
      currency: "GBP",
      createdAt: daysAgo(12, 10),
    },
    {
      type: "WITHDRAWAL",
      sourceAccountId: alexAccount.id,
      destinationAccountId: null,
      amount: 5_000,
      currency: "GBP",
      createdAt: daysAgo(3, 16),
    },
  ]);

  await db
    .update(accounts)
    .set({ balance: 428_050 })
    .where(eq(accounts.id, yashAccount.id));
  await db
    .update(accounts)
    .set({ balance: 175_000 })
    .where(eq(accounts.id, alexAccount.id));

  console.log("Seed complete. Password for all demo users: demo-pass");
  console.log(`  Admin <admin@puro.earth.task.com>`);
  console.log(
    `  Yash Kapure <yash@puro.earth.task.com>: £4,280.50  04-00-11 / ${yashAccount.accountNumber}`,
  );
  console.log(
    `  Alex Morgan <alex@puro.earth.task.com>: £1,750.00  04-00-11 / ${alexAccount.accountNumber}`,
  );
}

seed()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await queryClient.end();
  });
