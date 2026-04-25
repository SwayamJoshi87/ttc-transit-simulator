import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import Papa from "papaparse";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import { getPgConnectionOptions } from "../src/lib/gtfs/connection";
import {
  calendarTable,
  routesTable,
  shapesTable,
  stopTimesTable,
  stopsTable,
  tripsTable,
} from "../src/lib/gtfs/schema";

loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const { connectionString, ssl } = getPgConnectionOptions(databaseUrl);

const pool = new Pool({
  connectionString,
  ssl,
});

const db = drizzle(pool);

type CsvRow = Record<string, string>;

function toInt(value: string | undefined, fallback = 0): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

function toFloat(value: string | undefined, fallback = 0): number {
  if (!value) return fallback;
  const n = Number.parseFloat(value);
  return Number.isNaN(n) ? fallback : n;
}

function toBool(value: string | undefined): boolean {
  return value === "1";
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function parseCsv(fileName: string): Promise<CsvRow[]> {
  const filePath = path.join(process.cwd(), "public", "gtfs", fileName);
  const raw = await readFile(filePath, "utf8");
  const parsed = Papa.parse<CsvRow>(raw, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (header) => header.trim(),
  });
  return parsed.data;
}

async function ensureTables() {
  await db.execute(
    sql`DROP TABLE IF EXISTS stop_times, shapes, trips, stops, calendar, routes CASCADE`,
  );

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS feedback (
      id serial PRIMARY KEY,
      message text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS routes (
      route_id text PRIMARY KEY,
      route_short_name text NOT NULL,
      route_long_name text NOT NULL,
      route_type integer NOT NULL,
      route_color text,
      route_text_color text
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS trips (
      trip_id text PRIMARY KEY,
      route_id text NOT NULL,
      service_id text NOT NULL,
      trip_headsign text NOT NULL,
      direction_id integer,
      shape_id text NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS stops (
      stop_id text PRIMARY KEY,
      stop_name text NOT NULL,
      stop_lat real NOT NULL,
      stop_lon real NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS stop_times (
      trip_id text NOT NULL,
      stop_id text NOT NULL,
      stop_sequence integer NOT NULL,
      arrival_time text NOT NULL,
      departure_time text NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS shapes (
      shape_id text NOT NULL,
      shape_pt_lat real NOT NULL,
      shape_pt_lon real NOT NULL,
      shape_pt_sequence integer NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS calendar (
      service_id text PRIMARY KEY,
      monday boolean NOT NULL,
      tuesday boolean NOT NULL,
      wednesday boolean NOT NULL,
      thursday boolean NOT NULL,
      friday boolean NOT NULL,
      saturday boolean NOT NULL,
      sunday boolean NOT NULL,
      start_date text NOT NULL,
      end_date text NOT NULL
    )
  `);
}

async function seedRoutes() {
  const rows = await parseCsv("routes.txt");
  const values = rows.map((row) => ({
    routeId: row.route_id,
    routeShortName: row.route_short_name ?? "",
    routeLongName: row.route_long_name ?? "",
    routeType: toInt(row.route_type),
    routeColor: row.route_color || null,
    routeTextColor: row.route_text_color || null,
  }));

  for (const batch of chunk(values, 1000)) {
    await db.insert(routesTable).values(batch);
  }
}

async function seedTrips() {
  const rows = await parseCsv("trips.txt");
  const values = rows.map((row) => ({
    tripId: row.trip_id,
    routeId: row.route_id,
    serviceId: row.service_id,
    tripHeadsign: row.trip_headsign ?? "",
    directionId: toInt(row.direction_id, 0),
    shapeId: row.shape_id ?? "",
  }));

  for (const batch of chunk(values, 1000)) {
    await db.insert(tripsTable).values(batch);
  }
}

async function seedStops() {
  const rows = await parseCsv("stops.txt");
  const values = rows.map((row) => ({
    stopId: row.stop_id,
    stopName: row.stop_name ?? "",
    stopLat: toFloat(row.stop_lat),
    stopLon: toFloat(row.stop_lon),
  }));

  for (const batch of chunk(values, 1000)) {
    await db.insert(stopsTable).values(batch);
  }
}

async function seedStopTimes() {
  const rows = await parseCsv("stop_times.txt");
  const values = rows.map((row) => ({
    tripId: row.trip_id,
    stopId: row.stop_id,
    stopSequence: toInt(row.stop_sequence),
    arrivalTime: row.arrival_time ?? "00:00:00",
    departureTime: row.departure_time ?? "00:00:00",
  }));

  for (const batch of chunk(values, 2000)) {
    await db.insert(stopTimesTable).values(batch);
  }
}

async function seedShapes() {
  const rows = await parseCsv("shapes.txt");
  const values = rows.map((row) => ({
    shapeId: row.shape_id,
    shapePtLat: toFloat(row.shape_pt_lat),
    shapePtLon: toFloat(row.shape_pt_lon),
    shapePtSequence: toInt(row.shape_pt_sequence),
  }));

  for (const batch of chunk(values, 2000)) {
    await db.insert(shapesTable).values(batch);
  }
}

async function seedCalendar() {
  const rows = await parseCsv("calendar.txt");
  const values = rows.map((row) => ({
    serviceId: row.service_id,
    monday: toBool(row.monday),
    tuesday: toBool(row.tuesday),
    wednesday: toBool(row.wednesday),
    thursday: toBool(row.thursday),
    friday: toBool(row.friday),
    saturday: toBool(row.saturday),
    sunday: toBool(row.sunday),
    startDate: row.start_date ?? "",
    endDate: row.end_date ?? "",
  }));

  for (const batch of chunk(values, 1000)) {
    await db.insert(calendarTable).values(batch);
  }
}

async function truncateAll() {
  await db.execute(
    sql`TRUNCATE TABLE stop_times, shapes, trips, stops, calendar, routes`,
  );
}

async function main() {
  await ensureTables();

  console.log("Seeding routes...");
  await seedRoutes();
  console.log("Seeding trips...");
  await seedTrips();
  console.log("Seeding stops...");
  await seedStops();
  console.log("Seeding stop_times...");
  await seedStopTimes();
  console.log("Seeding shapes...");
  await seedShapes();
  console.log("Seeding calendar...");
  await seedCalendar();

  console.log("GTFS seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
