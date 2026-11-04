ALTER TABLE "sim_configs" ADD COLUMN "spec" jsonb;--> statement-breakpoint
ALTER TABLE "sim_configs" DROP COLUMN "target_latitude";--> statement-breakpoint
ALTER TABLE "sim_configs" DROP COLUMN "target_longitude";--> statement-breakpoint
ALTER TABLE "sim_configs" DROP COLUMN "initial_distance";--> statement-breakpoint
ALTER TABLE "sim_configs" DROP COLUMN "initial_azimuth";