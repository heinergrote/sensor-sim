CREATE TYPE "public"."type" AS ENUM('follow', 'circle');--> statement-breakpoint
ALTER TABLE "sim_configs" ALTER COLUMN "target_latitude" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sim_configs" ALTER COLUMN "target_longitude" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sim_configs" ALTER COLUMN "initial_distance" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sim_configs" ALTER COLUMN "initial_azimuth" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sim_configs" ALTER COLUMN "type" SET DEFAULT 'follow'::"public"."type";--> statement-breakpoint
ALTER TABLE "sim_configs" ALTER COLUMN "type" SET DATA TYPE "public"."type" USING "type"::"public"."type";--> statement-breakpoint
ALTER TABLE "sim_configs" ALTER COLUMN "type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sim_configs" ALTER COLUMN "speed" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sim_configs" ALTER COLUMN "playing" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "sim_configs" ALTER COLUMN "playing" SET NOT NULL;