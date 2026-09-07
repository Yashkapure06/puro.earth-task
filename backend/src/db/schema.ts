import {
  bigint,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const currencyEnum = pgEnum("currency", ["GBP"]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "DEPOSIT",
  "WITHDRAWAL",
  "TRANSFER",
]);

export const userRoleEnum = pgEnum("user_role", ["admin", "customer"]);

export const banks = pgTable("banks", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  sortCode: text("sort_code").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bankId: uuid("bank_id")
      .notNull()
      .references(() => banks.id, { onDelete: "restrict" }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("customer"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("users_email_uidx").on(table.email),
    index("users_bank_id_idx").on(table.bankId),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    currency: currencyEnum("currency").notNull().default("GBP"),
    /** Balance in minor units (pence for GBP). Never use floating point. */
    balance: bigint("balance", { mode: "number" }).notNull().default(0),
    accountNumber: text("account_number").notNull(),
    cardLast4: text("card_last4").notNull(),
    /** Demo PAN only. Never returned from GET /accounts/me. */
    cardNumber: text("card_number").notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("accounts_user_id_uidx").on(table.userId),
    uniqueIndex("accounts_account_number_uidx").on(table.accountNumber),
    index("accounts_user_id_idx").on(table.userId),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: transactionTypeEnum("type").notNull(),
    sourceAccountId: uuid("source_account_id").references(() => accounts.id, {
      onDelete: "restrict",
    }),
    destinationAccountId: uuid("destination_account_id").references(
      () => accounts.id,
      { onDelete: "restrict" },
    ),
    /** Set for outbound payments to another bank (no local destination account). */
    payeeSortCode: text("payee_sort_code"),
    payeeAccountNumber: text("payee_account_number"),
    payeeName: text("payee_name"),
    /** Amount in minor units. Always positive; direction inferred from type. */
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: currencyEnum("currency").notNull().default("GBP"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("transactions_source_account_id_idx").on(table.sourceAccountId),
    index("transactions_destination_account_id_idx").on(
      table.destinationAccountId,
    ),
    index("transactions_created_at_idx").on(table.createdAt),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("sessions_token_uidx").on(table.token),
    index("sessions_user_id_idx").on(table.userId),
  ],
);

export type Bank = typeof banks.$inferSelect;
export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type UserRole = (typeof userRoleEnum.enumValues)[number];
