ALTER TABLE "sim_configs" ADD COLUMN "owner_id" integer;--> statement-breakpoint
UPDATE "sim_configs" SET "owner_id" = (SELECT "id" FROM "users" WHERE "username" = 'admin' AND "admin" = true LIMIT 1);--> statement-breakpoint
DELETE FROM "sim_configs" WHERE "owner_id" IS NULL;--> statement-breakpoint
ALTER TABLE "sim_configs" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sim_configs" ADD CONSTRAINT "sim_configs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;