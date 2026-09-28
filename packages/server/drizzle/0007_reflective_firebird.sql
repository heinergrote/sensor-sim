CREATE SEQUENCE "public"."sim_config_label_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint

DELETE
FROM sim_configs;

ALTER TABLE "sim_configs"
    ALTER COLUMN "label" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "sim_configs"
    ALTER COLUMN "label" SET DEFAULT 'sim-' || nextval('sim_config_label_seq');--> statement-breakpoint
ALTER TABLE "sim_configs"
    ALTER COLUMN "label" SET NOT NULL;

