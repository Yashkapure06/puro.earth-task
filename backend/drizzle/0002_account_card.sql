ALTER TABLE "accounts" ADD COLUMN "card_number" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "accounts" SET "card_number" = '000000000000' || "card_last4" WHERE "card_number" IS NULL;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "card_number" SET NOT NULL;
