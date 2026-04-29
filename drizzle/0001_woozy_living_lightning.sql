ALTER TABLE "trips" ADD COLUMN "stop_count" integer;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "is_canonical" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "trips_canonical_idx" ON "trips" USING btree ("route_id","is_canonical");