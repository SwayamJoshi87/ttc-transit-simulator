import { asc } from "drizzle-orm";
import { db } from "@/lib/gtfs/db";
import { routesTable } from "@/lib/gtfs/schema";
import type { Route } from "@/store/routeStore";

export const runtime = "nodejs";
export const revalidate = 86400; // 24h — TTC GTFS updates ~every 6 weeks

const CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
};

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

  return Response.json({ routes }, { headers: CACHE_HEADERS });
}
