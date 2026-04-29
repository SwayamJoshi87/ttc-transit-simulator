CREATE INDEX "stop_times_trip_sequence_idx" ON "stop_times" USING btree ("trip_id","stop_sequence");--> statement-breakpoint
CREATE INDEX "shapes_shape_sequence_idx" ON "shapes" USING btree ("shape_id","shape_pt_sequence");
