import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const routesTable = pgTable("routes", {
  routeId: text("route_id").primaryKey(),
  routeShortName: text("route_short_name").notNull(),
  routeLongName: text("route_long_name").notNull(),
  routeType: integer("route_type").notNull(),
  routeColor: text("route_color"),
  routeTextColor: text("route_text_color"),
});

export const tripsTable = pgTable(
  "trips",
  {
    tripId: text("trip_id").primaryKey(),
    routeId: text("route_id").notNull(),
    serviceId: text("service_id").notNull(),
    tripHeadsign: text("trip_headsign").notNull(),
    directionId: integer("direction_id"),
    shapeId: text("shape_id").notNull(),
    stopCount: integer("stop_count"),
    isCanonical: boolean("is_canonical").notNull().default(false),
  },
  (t) => [
    index("trips_route_id_idx").on(t.routeId),
    index("trips_canonical_idx").on(t.routeId, t.isCanonical),
  ],
);

export const stopsTable = pgTable("stops", {
  stopId: text("stop_id").primaryKey(),
  stopName: text("stop_name").notNull(),
  stopLat: real("stop_lat").notNull(),
  stopLon: real("stop_lon").notNull(),
});

export const stopTimesTable = pgTable(
  "stop_times",
  {
    tripId: text("trip_id").notNull(),
    stopId: text("stop_id").notNull(),
    stopSequence: integer("stop_sequence").notNull(),
    arrivalTime: text("arrival_time").notNull(),
    departureTime: text("departure_time").notNull(),
  },
  (t) => [index("stop_times_trip_id_idx").on(t.tripId)],
);

export const shapesTable = pgTable(
  "shapes",
  {
    shapeId: text("shape_id").notNull(),
    shapePtLat: real("shape_pt_lat").notNull(),
    shapePtLon: real("shape_pt_lon").notNull(),
    shapePtSequence: integer("shape_pt_sequence").notNull(),
  },
  (t) => [index("shapes_shape_id_idx").on(t.shapeId)],
);

export const calendarTable = pgTable("calendar", {
  serviceId: text("service_id").primaryKey(),
  monday: boolean("monday").notNull(),
  tuesday: boolean("tuesday").notNull(),
  wednesday: boolean("wednesday").notNull(),
  thursday: boolean("thursday").notNull(),
  friday: boolean("friday").notNull(),
  saturday: boolean("saturday").notNull(),
  sunday: boolean("sunday").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
});

export const feedbackTable = pgTable("feedback", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
