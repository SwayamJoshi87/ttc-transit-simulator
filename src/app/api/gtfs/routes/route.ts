import { asc } from "drizzle-orm";
import { db } from "@/lib/gtfs/db";
import { routesTable } from "@/lib/gtfs/schema";
import type { Route } from "@/store/routeStore";

export const runtime = "nodejs";

export async function GET() {
  const rows = await db
    .select()
    .from(routesTable)
    .orderBy(
      asc(routesTable.routeType),
      asc(routesTable.routeShortName),
      asc(routesTable.routeLongName),
    );

  const routes: Route[] = rows.map((row) => ({
    routeId: row.routeId,
    routeShortName: row.routeShortName,
    routeLongName: row.routeLongName,
    routeType: row.routeType,
    routeColor: row.routeColor ?? undefined,
    routeTextColor: row.routeTextColor ?? undefined,
  }));

  return Response.json({ routes });
}
