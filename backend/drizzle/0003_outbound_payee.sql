ALTER TABLE "transactions" ADD COLUMN "payee_sort_code" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "payee_account_number" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "payee_name" text;--> statement-breakpoint
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_endpoints_check";--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_endpoints_check" CHECK (
  ("type" = 'DEPOSIT' AND "source_account_id" IS NULL AND "destination_account_id" IS NOT NULL)
  OR ("type" = 'WITHDRAWAL' AND "source_account_id" IS NOT NULL AND "destination_account_id" IS NULL)
  OR (
    "type" = 'TRANSFER'
    AND "source_account_id" IS NOT NULL
    AND (
      (
        "destination_account_id" IS NOT NULL
        AND "source_account_id" <> "destination_account_id"
      )
      OR (
        "destination_account_id" IS NULL
        AND "payee_sort_code" IS NOT NULL
        AND "payee_account_number" IS NOT NULL
        AND "payee_name" IS NOT NULL
      )
    )
  )
);
