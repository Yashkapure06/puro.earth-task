import "./setup.js";
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import type { Express } from "express";
import { buildApp } from "../app.js";
import { inject, type InjectResponse } from "./http.js";
import { db, queryClient } from "../db/index.js";
import {
  accounts,
  banks,
  sessions,
  transactions,
  users,
} from "../db/schema.js";
import { generateCardNumber } from "../lib/account-numbers.js";
import { hashPassword } from "../lib/password.js";
import { transfer } from "../modules/transactions/service.js";
import { deposit, withdraw } from "../modules/accounts/service.js";
import { AppError } from "../lib/errors.js";

const DEMO_PASSWORD = "demo-pass";

type Seeded = {
  admin: { id: string; email: string };
  yash: { id: string; email: string; name: string };
  alex: { id: string; email: string; name: string };
  yashAccountId: string;
  alexAccountId: string;
  yashAccountNumber: string;
  alexAccountNumber: string;
};

type Body = {
  user?: { email: string; role: string };
  error?: { code: string };
  customer?: { accountNumber: string; name: string };
  account?: { id: string; balance: { amount: number } };
  transfer?: { id: string; rail: string; destinationAccountId: string | null };
  id?: string;
  holderName?: string;
  accountNumber?: string;
  sortCode?: string;
  maskedCardNumber?: string;
  cardNumber?: string;
  balance?: { amount: number };
  rail?: string;
  name?: string;
};

function body(response: InjectResponse): Body {
  return response.json() as Body;
}

async function resetAndSeed(): Promise<Seeded> {
  await db.delete(sessions);
  await db.delete(transactions);
  await db.delete(accounts);
  await db.delete(users);
  await db.delete(banks);

  const [bank] = await db
    .insert(banks)
    .values({ name: "Puro", sortCode: "040011" })
    .returning();
  if (!bank) throw new Error("seed bank failed");

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

  if (!admin || !yash || !alex) throw new Error("seed users failed");

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

  if (!yashAccount || !alexAccount) throw new Error("seed accounts failed");

  return {
    admin,
    yash,
    alex,
    yashAccountId: yashAccount.id,
    alexAccountId: alexAccount.id,
    yashAccountNumber: yashAccount.accountNumber,
    alexAccountNumber: alexAccount.accountNumber,
  };
}

async function login(
  app: Express,
  email: string,
  password = DEMO_PASSWORD,
): Promise<string> {
  const response = await inject(app, {
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  assert.equal(response.statusCode, 200);
  const cookie = response.cookies.find((c) => c.name === "puro_session");
  if (!cookie?.value) {
    throw new Error("login did not set puro_session");
  }
  return cookie.value;
}

describe("Puro Banking API", () => {
  let app: Express;
  let seed: Seeded;

  before(async () => {
    await db.execute(sql`SELECT 1`);
    app = buildApp();
  });

  beforeEach(async () => {
    seed = await resetAndSeed();
  });

  after(async () => {
    await queryClient.end();
  });

  describe("health", () => {
    it("reports the server is up and the database is connected", async () => {
      const response = await inject(app, {
        method: "GET",
        url: "/api/health",
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), {
        status: "ok",
        server: "up",
        database: "connected",
      });
    });
  });

  describe("authentication", () => {
    it("logs in a seeded user", async () => {
      const response = await inject(app, {
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "yash@puro.earth.task.com", password: DEMO_PASSWORD },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(body(response).user?.email, "yash@puro.earth.task.com");
      assert.equal(body(response).user?.role, "customer");
      assert.ok(response.cookies.some((c) => c.name === "puro_session"));
    });

    it("rejects unknown emails", async () => {
      const response = await inject(app, {
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "nobody@puro.earth.task.com", password: DEMO_PASSWORD },
      });

      assert.equal(response.statusCode, 401);
      assert.equal(body(response).error?.code, "UNAUTHORIZED");
    });

    it("rejects a wrong password", async () => {
      const response = await inject(app, {
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "yash@puro.earth.task.com", password: "wrong-pass" },
      });

      assert.equal(response.statusCode, 401);
      assert.equal(body(response).error?.code, "UNAUTHORIZED");
    });

    it("opens a customer account on register", async () => {
      const response = await inject(app, {
        method: "POST",
        url: "/api/auth/register",
        payload: {
          name: "Sam Rivera",
          email: "sam@puro.earth.task.com",
          password: DEMO_PASSWORD,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(body(response).user?.role, "customer");
      const cookie = response.cookies.find((c) => c.name === "puro_session");
      if (!cookie?.value) {
        throw new Error("register did not set puro_session");
      }

      const account = await inject(app, {
        method: "GET",
        url: "/api/accounts/me",
        cookies: { puro_session: cookie.value },
      });
      assert.equal(account.statusCode, 200);
      assert.match(body(account).accountNumber ?? "", /^\d{8}$/);
      assert.equal(body(account).sortCode, "04-00-11");
      assert.match(body(account).maskedCardNumber ?? "", /^•••• \d{4}$/);
      assert.equal(body(account).balance?.amount, 0);
    });

    it("rejects unauthenticated account access", async () => {
      const response = await inject(app, {
        method: "GET",
        url: "/api/accounts/me",
      });

      assert.equal(response.statusCode, 401);
      assert.equal(body(response).error?.code, "UNAUTHORIZED");
    });
  });

  describe("authorization", () => {
    it("returns only the authenticated user's account", async () => {
      const token = await login(app, "yash@puro.earth.task.com");
      const response = await inject(app, {
        method: "GET",
        url: "/api/accounts/me",
        cookies: { puro_session: token },
      });

      assert.equal(response.statusCode, 200);
      const me = body(response);
      assert.equal(me.id, seed.yashAccountId);
      assert.equal(me.balance?.amount, 428_050);
      assert.equal(me.holderName, "Yash Kapure");
      assert.match(me.accountNumber ?? "", /^\d{8}$/);
    });

    it("cannot mutate another user's account via ownership derivation", async () => {
      const token = await login(app, "alex@puro.earth.task.com");
      const beforeRow = await db.query.accounts.findFirst({
        where: eq(accounts.id, seed.yashAccountId),
      });

      const response = await inject(app, {
        method: "POST",
        url: "/api/accounts/me/withdraw",
        cookies: { puro_session: token },
        payload: { amount: 1000, currency: "GBP" },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(body(response).account?.id, seed.alexAccountId);

      const after = await db.query.accounts.findFirst({
        where: eq(accounts.id, seed.yashAccountId),
      });
      assert.equal(after?.balance, beforeRow?.balance);
    });

    it("forbids an admin from using customer money routes", async () => {
      const token = await login(app, "admin@puro.earth.task.com");
      const response = await inject(app, {
        method: "GET",
        url: "/api/accounts/me",
        cookies: { puro_session: token },
      });
      assert.equal(response.statusCode, 403);
      assert.equal(body(response).error?.code, "FORBIDDEN");
    });

    it("forbids a customer from the admin customer list", async () => {
      const token = await login(app, "yash@puro.earth.task.com");
      const response = await inject(app, {
        method: "GET",
        url: "/api/admin/customers",
        cookies: { puro_session: token },
      });
      assert.equal(response.statusCode, 403);
    });

    it("lets an admin create a customer with generated account details", async () => {
      const token = await login(app, "admin@puro.earth.task.com");
      const response = await inject(app, {
        method: "POST",
        url: "/api/admin/customers",
        cookies: { puro_session: token },
        payload: {
          name: "Jordan Lee",
          email: "jordan@puro.earth.task.com",
          password: DEMO_PASSWORD,
        },
      });
      assert.equal(response.statusCode, 200);
      assert.match(body(response).customer?.accountNumber ?? "", /^\d{8}$/);
    });

    it("lets an admin update a customer name and email", async () => {
      const token = await login(app, "admin@puro.earth.task.com");
      const response = await inject(app, {
        method: "PATCH",
        url: `/api/admin/customers/${seed.alex.id}`,
        cookies: { puro_session: token },
        payload: { name: "Alex M.", email: "alex.m@puro.earth.task.com" },
      });
      assert.equal(response.statusCode, 200);
      assert.equal(body(response).customer?.name, "Alex M.");
    });

    it("closes an account so deposits are rejected", async () => {
      const adminToken = await login(app, "admin@puro.earth.task.com");
      const closed = await inject(app, {
        method: "POST",
        url: `/api/admin/customers/${seed.alex.id}/close`,
        cookies: { puro_session: adminToken },
      });
      assert.equal(closed.statusCode, 200);

      const token = await login(app, "alex@puro.earth.task.com");
      const response = await inject(app, {
        method: "POST",
        url: "/api/accounts/me/deposit",
        cookies: { puro_session: token },
        payload: { amount: 1000, currency: "GBP" },
      });
      assert.equal(response.statusCode, 403);
      assert.equal(body(response).error?.code, "ACCOUNT_CLOSED");
    });

    it("reveals the card number only after the demo PIN", async () => {
      const token = await login(app, "yash@puro.earth.task.com");
      const me = await inject(app, {
        method: "GET",
        url: "/api/accounts/me",
        cookies: { puro_session: token },
      });
      assert.equal(me.statusCode, 200);
      assert.equal(body(me).cardNumber, undefined);

      const denied = await inject(app, {
        method: "POST",
        url: "/api/accounts/me/card",
        cookies: { puro_session: token },
        payload: { pin: "0000" },
      });
      assert.equal(denied.statusCode, 401);
      assert.equal(body(denied).error?.code, "INVALID_PIN");

      const revealed = await inject(app, {
        method: "POST",
        url: "/api/accounts/me/card",
        cookies: { puro_session: token },
        payload: { pin: "1234" },
      });
      assert.equal(revealed.statusCode, 200);
      const cardNumber = body(revealed).cardNumber ?? "";
      assert.match(cardNumber, /^\d{4} \d{4} \d{4} \d{4}$/);
      assert.ok(cardNumber.endsWith((body(me).maskedCardNumber ?? "").slice(-4)));
    });
  });

  describe("deposit", () => {
    it("deposits atomically and creates a transaction", async () => {
      const token = await login(app, "yash@puro.earth.task.com");
      const response = await inject(app, {
        method: "POST",
        url: "/api/accounts/me/deposit",
        cookies: { puro_session: token },
        payload: { amount: 10_000, currency: "GBP" },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(body(response).account?.balance.amount, 438_050);

      const account = await db.query.accounts.findFirst({
        where: eq(accounts.id, seed.yashAccountId),
      });
      assert.equal(account?.balance, 438_050);

      const txns = await db.query.transactions.findMany({
        where: eq(transactions.destinationAccountId, seed.yashAccountId),
      });
      assert.ok(txns.some((t) => t.type === "DEPOSIT" && t.amount === 10_000));
    });

    it("rejects non-positive amounts", async () => {
      const token = await login(app, "yash@puro.earth.task.com");
      const response = await inject(app, {
        method: "POST",
        url: "/api/accounts/me/deposit",
        cookies: { puro_session: token },
        payload: { amount: 0, currency: "GBP" },
      });

      assert.equal(response.statusCode, 400);
      assert.equal(body(response).error?.code, "VALIDATION_ERROR");
    });
  });

  describe("withdrawal", () => {
    it("withdraws when funds are sufficient", async () => {
      const token = await login(app, "yash@puro.earth.task.com");
      const response = await inject(app, {
        method: "POST",
        url: "/api/accounts/me/withdraw",
        cookies: { puro_session: token },
        payload: { amount: 28_050, currency: "GBP" },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(body(response).account?.balance.amount, 400_000);
    });

    it("rejects insufficient funds", async () => {
      const token = await login(app, "alex@puro.earth.task.com");
      const response = await inject(app, {
        method: "POST",
        url: "/api/accounts/me/withdraw",
        cookies: { puro_session: token },
        payload: { amount: 200_000, currency: "GBP" },
      });

      assert.equal(response.statusCode, 409);
      assert.equal(body(response).error?.code, "INSUFFICIENT_FUNDS");

      const account = await db.query.accounts.findFirst({
        where: eq(accounts.id, seed.alexAccountId),
      });
      assert.equal(account?.balance, 175_000);
    });
  });

  describe("transfer", () => {
    it("transfers atomically between accounts", async () => {
      const token = await login(app, "yash@puro.earth.task.com");
      const response = await inject(app, {
        method: "POST",
        url: "/api/transfers",
        cookies: { puro_session: token },
        payload: {
          sortCode: "04-00-11",
          accountNumber: seed.alexAccountNumber,
          amount: 25_000,
          currency: "GBP",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(body(response).account?.balance.amount, 403_050);

      const yash = await db.query.accounts.findFirst({
        where: eq(accounts.id, seed.yashAccountId),
      });
      const alex = await db.query.accounts.findFirst({
        where: eq(accounts.id, seed.alexAccountId),
      });
      assert.equal(yash?.balance, 403_050);
      assert.equal(alex?.balance, 200_000);

      const txn = await db.query.transactions.findFirst({
        where: eq(transactions.id, body(response).transfer?.id ?? ""),
      });
      assert.equal(txn?.type, "TRANSFER");
      assert.equal(txn?.amount, 25_000);
    });

    it("rejects same-account transfers", async () => {
      const token = await login(app, "yash@puro.earth.task.com");
      const response = await inject(app, {
        method: "POST",
        url: "/api/transfers",
        cookies: { puro_session: token },
        payload: {
          sortCode: "040011",
          accountNumber: seed.yashAccountNumber,
          amount: 1000,
          currency: "GBP",
        },
      });

      assert.equal(response.statusCode, 400);
      assert.equal(body(response).error?.code, "SAME_ACCOUNT_TRANSFER");
    });

    it("rejects missing destination", async () => {
      const token = await login(app, "yash@puro.earth.task.com");
      const response = await inject(app, {
        method: "POST",
        url: "/api/transfers",
        cookies: { puro_session: token },
        payload: {
          sortCode: "04-00-11",
          accountNumber: "00000000",
          amount: 1000,
          currency: "GBP",
        },
      });

      assert.equal(response.statusCode, 404);
      assert.equal(body(response).error?.code, "DESTINATION_ACCOUNT_NOT_FOUND");
    });

    it("previews a payee from sort code and account number without an id", async () => {
      const token = await login(app, "yash@puro.earth.task.com");
      const response = await inject(app, {
        method: "POST",
        url: "/api/transfers/preview",
        cookies: { puro_session: token },
        payload: {
          sortCode: "04-00-11",
          accountNumber: seed.alexAccountNumber,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), {
        rail: "puro",
        name: "Alex Morgan",
        sortCode: "04-00-11",
        accountNumber: seed.alexAccountNumber,
      });
      assert.equal(Object.hasOwn(response.json(), "accountId"), false);
      assert.equal(Object.hasOwn(response.json(), "id"), false);
    });

    it("previews a non-Puro sort code as an outbound payee", async () => {
      const token = await login(app, "yash@puro.earth.task.com");
      const response = await inject(app, {
        method: "POST",
        url: "/api/transfers/preview",
        cookies: { puro_session: token },
        payload: {
          sortCode: "11-11-11",
          accountNumber: "11111111",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), {
        rail: "external",
        name: "another bank",
        sortCode: "11-11-11",
        accountNumber: "11111111",
      });
    });

    it("posts an outbound payment without crediting a Puro account", async () => {
      const token = await login(app, "yash@puro.earth.task.com");
      const beforeAlex = (
        await db.query.accounts.findFirst({
          where: eq(accounts.id, seed.alexAccountId),
        })
      )?.balance;

      const response = await inject(app, {
        method: "POST",
        url: "/api/transfers",
        cookies: { puro_session: token },
        payload: {
          sortCode: "11-11-11",
          accountNumber: "11111111",
          amount: 11_100,
          currency: "GBP",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(body(response).account?.balance.amount, 416_950);
      assert.equal(body(response).transfer?.rail, "external");
      assert.equal(body(response).transfer?.destinationAccountId, null);

      const yash = await db.query.accounts.findFirst({
        where: eq(accounts.id, seed.yashAccountId),
      });
      const alex = await db.query.accounts.findFirst({
        where: eq(accounts.id, seed.alexAccountId),
      });
      assert.equal(yash?.balance, 416_950);
      assert.equal(alex?.balance, beforeAlex);

      const txn = await db.query.transactions.findFirst({
        where: eq(transactions.id, body(response).transfer?.id ?? ""),
      });
      assert.equal(txn?.destinationAccountId, null);
      assert.equal(txn?.payeeSortCode, "111111");
      assert.equal(txn?.payeeAccountNumber, "11111111");
    });

    it("does not list every customer as a transfer directory", async () => {
      const token = await login(app, "yash@puro.earth.task.com");
      const response = await inject(app, {
        method: "GET",
        url: "/api/transfer-recipients",
        cookies: { puro_session: token },
      });

      assert.equal(response.statusCode, 404);
    });

    it("rejects insufficient funds without mutating balances", async () => {
      const token = await login(app, "alex@puro.earth.task.com");
      const response = await inject(app, {
        method: "POST",
        url: "/api/transfers",
        cookies: { puro_session: token },
        payload: {
          sortCode: "04-00-11",
          accountNumber: seed.yashAccountNumber,
          amount: 500_000,
          currency: "GBP",
        },
      });

      assert.equal(response.statusCode, 409);
      assert.equal(body(response).error?.code, "INSUFFICIENT_FUNDS");

      const yash = await db.query.accounts.findFirst({
        where: eq(accounts.id, seed.yashAccountId),
      });
      const alex = await db.query.accounts.findFirst({
        where: eq(accounts.id, seed.alexAccountId),
      });
      assert.equal(yash?.balance, 428_050);
      assert.equal(alex?.balance, 175_000);
    });

    it("rolls back entirely when transaction insert would fail", async () => {
      const beforeYash = (
        await db.query.accounts.findFirst({
          where: eq(accounts.id, seed.yashAccountId),
        })
      )?.balance;
      const beforeAlex = (
        await db.query.accounts.findFirst({
          where: eq(accounts.id, seed.alexAccountId),
        })
      )?.balance;
      const beforeCount = (
        await db.select({ count: sql<number>`count(*)::int` }).from(transactions)
      )[0]?.count;

      await assert.rejects(
        () => transfer(db, seed.yash.id, "040011", "00000000", 1000, "GBP"),
        (err: unknown) => err instanceof AppError,
      );

      const afterYash = (
        await db.query.accounts.findFirst({
          where: eq(accounts.id, seed.yashAccountId),
        })
      )?.balance;
      const afterAlex = (
        await db.query.accounts.findFirst({
          where: eq(accounts.id, seed.alexAccountId),
        })
      )?.balance;
      const afterCount = (
        await db.select({ count: sql<number>`count(*)::int` }).from(transactions)
      )[0]?.count;

      assert.equal(afterYash, beforeYash);
      assert.equal(afterAlex, beforeAlex);
      assert.equal(afterCount, beforeCount);
    });

    it("never allows negative balances via service withdraw", async () => {
      await assert.rejects(
        () => withdraw(db, seed.alex.id, 175_001, "GBP"),
        (err: unknown) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.code, "INSUFFICIENT_FUNDS");
          return true;
        },
      );

      const alex = await db.query.accounts.findFirst({
        where: eq(accounts.id, seed.alexAccountId),
      });
      assert.equal(alex?.balance, 175_000);
    });

    it("deposit service updates balance with integer minor units", async () => {
      const result = await deposit(db, seed.yash.id, 1, "GBP");
      assert.equal(result.account.balance.amount, 428_051);
    });
  });
});
