CREATE TYPE "public"."user_role" AS ENUM('admin', 'customer');--> statement-breakpoint
CREATE TABLE "banks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sort_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bank_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'customer';--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "account_number" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "card_last4" text;--> statement-breakpoint
INSERT INTO "banks" ("name", "sort_code") VALUES ('Puro', '040011');--> statement-breakpoint
UPDATE "users" SET "bank_id" = (SELECT "id" FROM "banks" LIMIT 1) WHERE "bank_id" IS NULL;--> statement-breakpoint
UPDATE "users" SET "password_hash" = 'invalid' WHERE "password_hash" IS NULL;--> statement-breakpoint
UPDATE "users" SET "role" = 'customer' WHERE "role" IS NULL;--> statement-breakpoint
UPDATE "accounts" SET "account_number" = lpad(substring(replace("id"::text, '-', ''), 1, 8), 8, '0') WHERE "account_number" IS NULL;--> statement-breakpoint
UPDATE "accounts" SET "card_last4" = lpad(substring(replace("id"::text, '-', ''), 9, 4), 4, '0') WHERE "card_last4" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "bank_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "account_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "card_last4" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_bank_id_idx" ON "users" USING btree ("bank_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_account_number_uidx" ON "accounts" USING btree ("account_number");
