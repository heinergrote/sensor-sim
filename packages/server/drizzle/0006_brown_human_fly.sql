ALTER TABLE "sim_configs" DROP CONSTRAINT "sim_configs_pkey";--> statement-breakpoint
ALTER TABLE "sim_configs" RENAME COLUMN "id" TO "label";--> statement-breakpoint
ALTER TABLE "sim_configs" ALTER COLUMN "label" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sim_configs" ADD CONSTRAINT "sim_configs_label_unique" UNIQUE("label");--> statement-breakpoint
ALTER TABLE "sim_configs" ADD COLUMN "id" serial PRIMARY KEY NOT NULL;
