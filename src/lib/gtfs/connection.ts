export interface PgConnectionOptions {
  connectionString: string;
  ssl: { rejectUnauthorized: boolean } | undefined;
}

export function getPgConnectionOptions(
  databaseUrl: string,
): PgConnectionOptions {
  const parsed = new URL(databaseUrl);
  const sslMode = parsed.searchParams.get("sslmode");

  if (sslMode) {
    parsed.searchParams.delete("sslmode");
  }

  return {
    connectionString: parsed.toString(),
    ssl:
      sslMode && sslMode !== "disable"
        ? { rejectUnauthorized: false }
        : undefined,
  };
}
