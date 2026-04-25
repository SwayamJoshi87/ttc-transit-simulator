import { defineConfig } from "drizzle-kit";
import { getPgConnectionOptions } from "./src/lib/gtfs/connection";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const { connectionString, ssl } = getPgConnectionOptions(
  process.env.DATABASE_URL,
);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/gtfs/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: connectionString,
    ssl,
  },
  strict: true,
  verbose: true,
});
