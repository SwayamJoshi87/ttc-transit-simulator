import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getPgConnectionOptions } from "@/lib/gtfs/connection";
import * as schema from "@/lib/gtfs/schema";

let pool: Pool | null = null;

function createPool() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const { connectionString, ssl } = getPgConnectionOptions(databaseUrl);

  return new Pool({
    connectionString,
    ssl,
    max: 3,
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
}

export function getGtfsPool() {
  if (!pool) pool = createPool();
  return pool;
}

export const db = drizzle(getGtfsPool(), { schema });
