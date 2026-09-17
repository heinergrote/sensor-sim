CREATE TABLE "sim_configs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"target_latitude" numeric,
	"target_longitude" numeric,
	"initial_distance" numeric,
	"initial_azimuth" numeric,
	"type" text,
	"speed" numeric,
	"playing" boolean
);
