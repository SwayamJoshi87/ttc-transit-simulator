import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";
import { getPgConnectionOptions } from "../src/lib/gtfs/connection";

loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

const { connectionString, ssl } = getPgConnectionOptions(databaseUrl);
const pool = new Pool({ connectionString, ssl, statement_timeout: 300_000 });

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Step 1: compute stop_count for every trip in one aggregate pass.
    // stop_times has ~800k rows but the trip_id index makes this fast.
    process.stdout.write("Computing stop counts… ");
    const { rowCount: countRows } = await client.query(`
      WITH counts AS (
        SELECT trip_id, COUNT(*)::int AS cnt
        FROM stop_times
        GROUP BY trip_id
      )
      UPDATE trips
      SET stop_count = counts.cnt
      FROM counts
      WHERE trips.trip_id = counts.trip_id
    `);
    console.log(`updated ${countRows} trips`);

    // Step 2: within each (route_id, direction_id, trip_headsign) group, mark
    // the trip with the most stops as canonical. trip_id tiebreaker is
    // deterministic when two trips have identical stop counts.
    process.stdout.write("Marking canonical trips… ");
    const { rowCount: markRows } = await client.query(`
      WITH ranked AS (
        SELECT
          trip_id,
          ROW_NUMBER() OVER (
            PARTITION BY route_id, COALESCE(direction_id, 0), trip_headsign
            ORDER BY COALESCE(stop_count, 0) DESC, trip_id ASC
          ) AS rn
        FROM trips
      )
      UPDATE trips
      SET is_canonical = (ranked.rn = 1)
      FROM ranked
      WHERE trips.trip_id = ranked.trip_id
    `);
    console.log(`marked ${markRows} trips`);

    await client.query("COMMIT");
    console.log("Done.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
