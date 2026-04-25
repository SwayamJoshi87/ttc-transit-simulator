CREATE TABLE "calendar" (
	"service_id" text PRIMARY KEY NOT NULL,
	"monday" boolean NOT NULL,
	"tuesday" boolean NOT NULL,
	"wednesday" boolean NOT NULL,
	"thursday" boolean NOT NULL,
	"friday" boolean NOT NULL,
	"saturday" boolean NOT NULL,
	"sunday" boolean NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"route_id" text PRIMARY KEY NOT NULL,
	"route_short_name" text NOT NULL,
	"route_long_name" text NOT NULL,
	"route_type" integer NOT NULL,
	"route_color" text,
	"route_text_color" text
);
--> statement-breakpoint
CREATE TABLE "shapes" (
	"shape_id" text NOT NULL,
	"shape_pt_lat" real NOT NULL,
	"shape_pt_lon" real NOT NULL,
	"shape_pt_sequence" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stop_times" (
	"trip_id" text NOT NULL,
	"stop_id" text NOT NULL,
	"stop_sequence" integer NOT NULL,
	"arrival_time" text NOT NULL,
	"departure_time" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stops" (
	"stop_id" text PRIMARY KEY NOT NULL,
	"stop_name" text NOT NULL,
	"stop_lat" real NOT NULL,
	"stop_lon" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"trip_id" text PRIMARY KEY NOT NULL,
	"route_id" text NOT NULL,
	"service_id" text NOT NULL,
	"trip_headsign" text NOT NULL,
	"direction_id" integer,
	"shape_id" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "shapes_shape_id_idx" ON "shapes" USING btree ("shape_id");--> statement-breakpoint
CREATE INDEX "stop_times_trip_id_idx" ON "stop_times" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trips_route_id_idx" ON "trips" USING btree ("route_id");