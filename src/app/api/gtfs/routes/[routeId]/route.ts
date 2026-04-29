import { asc, and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/gtfs/db";
import {
  routesTable,
  shapesTable,
  stopTimesTable,
  stopsTable,
  tripsTable,
} from "@/lib/gtfs/schema";
import type { Route, RouteCacheEntry, Stop, Trip } from "@/store/routeStore";

export const runtime = "nodejs";
export const revalidate = 86400; // 24h — TTC GTFS updates ~every 6 weeks

const CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
};

function toTrip(row: {
  tripId: string;
  routeId: string;
  shapeId: string;
  tripHeadsign: string;
  directionId: number | null;
}): Trip {
  return {
    tripId: row.tripId,
    routeId: row.routeId,
    shapeId: row.shapeId,
    tripHeadsign: row.tripHeadsign,
    directionId: Number(row.directionId ?? 0),
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ routeId: string }> },
) {
  const { routeId } = await params;

  const routeRow = await db
    .select()
    .from(routesTable)
    .where(eq(routesTable.routeId, routeId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!routeRow) {
    return Response.json({ error: "Route not found" }, { status: 404 });
  }

  const route: Route = {
    routeId: routeRow.routeId,
    routeShortName: routeRow.routeShortName,
    routeLongName: routeRow.routeLongName,
    routeType: routeRow.routeType,
    routeColor: routeRow.routeColor ?? undefined,
    routeTextColor: routeRow.routeTextColor ?? undefined,
  };

  // Fetch only pre-computed canonical trips — no stop_times COUNT needed.
  // Requires mark-canonical-trips script to have been run after migration.
  const tripRows = await db
    .select({
      tripId: tripsTable.tripId,
      routeId: tripsTable.routeId,
      shapeId: tripsTable.shapeId,
      tripHeadsign: tripsTable.tripHeadsign,
      directionId: tripsTable.directionId,
    })
    .from(tripsTable)
    .where(and(eq(tripsTable.routeId, routeId), eq(tripsTable.isCanonical, true)));

  const canonicalTrips = tripRows
    .map(toTrip)
    .sort((a, b) => a.directionId - b.directionId);

  if (canonicalTrips.length === 0) {
    const payload: RouteCacheEntry = {
      routeId,
      route,
      canonicalTrips: [],
      stopsByTrip: {},
      shapesByTrip: {},
    };
    return Response.json(payload, { headers: CACHE_HEADERS });
  }

  const canonicalTripIds = canonicalTrips.map((t) => t.tripId);
  const canonicalShapeIds = Array.from(
    new Set(canonicalTrips.map((t) => t.shapeId).filter(Boolean)),
  );

  const [stopRows, shapeRows] = await Promise.all([
    db
      .select({
        tripId: stopTimesTable.tripId,
        stopId: stopTimesTable.stopId,
        stopSequence: stopTimesTable.stopSequence,
        stopName: stopsTable.stopName,
        stopLat: stopsTable.stopLat,
        stopLon: stopsTable.stopLon,
      })
      .from(stopTimesTable)
      .innerJoin(stopsTable, eq(stopsTable.stopId, stopTimesTable.stopId))
      .where(inArray(stopTimesTable.tripId, canonicalTripIds))
      .orderBy(asc(stopTimesTable.tripId), asc(stopTimesTable.stopSequence)),

    canonicalShapeIds.length > 0
      ? db
          .select({
            shapeId: shapesTable.shapeId,
            shapePtLat: shapesTable.shapePtLat,
            shapePtLon: shapesTable.shapePtLon,
            shapePtSequence: shapesTable.shapePtSequence,
          })
          .from(shapesTable)
          .where(inArray(shapesTable.shapeId, canonicalShapeIds))
          .orderBy(asc(shapesTable.shapeId), asc(shapesTable.shapePtSequence))
      : Promise.resolve([]),
  ]);

  const stopsByTrip: Record<string, Stop[]> = {};
  for (const row of stopRows) {
    if (!stopsByTrip[row.tripId]) stopsByTrip[row.tripId] = [];
    stopsByTrip[row.tripId].push({
      stopId: row.stopId,
      stopName: row.stopName,
      lat: row.stopLat,
      lon: row.stopLon,
      sequence: row.stopSequence,
    });
  }

  const byShapeId: Record<string, RouteCacheEntry["shapesByTrip"][string]> = {};
  for (const row of shapeRows) {
    if (!byShapeId[row.shapeId]) byShapeId[row.shapeId] = [];
    byShapeId[row.shapeId].push({
      lat: row.shapePtLat,
      lon: row.shapePtLon,
      sequence: row.shapePtSequence,
    });
  }

  const shapesByTrip: Record<string, RouteCacheEntry["shapesByTrip"][string]> =
    {};
  for (const trip of canonicalTrips) {
    shapesByTrip[trip.tripId] = byShapeId[trip.shapeId] ?? [];
  }

  const payload: RouteCacheEntry = {
    routeId,
    route,
    canonicalTrips,
    stopsByTrip,
    shapesByTrip,
  };

  return Response.json(payload, { headers: CACHE_HEADERS });
}
