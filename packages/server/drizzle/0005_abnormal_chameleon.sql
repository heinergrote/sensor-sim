ALTER TABLE "sim_configs"
    ALTER COLUMN "share_token" SET DATA TYPE text;--> statement-breakpoint

ALTER TABLE "sim_configs"
    ALTER COLUMN "share_token" SET DEFAULT '';--> statement-breakpoint

UPDATE "sim_configs"
SET "share_token" = '';--> statement-breakpoint

ALTER TABLE "sim_configs"
    ALTER COLUMN "share_token" SET NOT NULL;