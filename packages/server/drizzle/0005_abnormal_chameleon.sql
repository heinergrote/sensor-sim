ALTER TABLE "sim_configs" ALTER COLUMN "share_token" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "sim_configs" ALTER COLUMN "share_token" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "sim_configs" ALTER COLUMN "share_token" SET NOT NULL;