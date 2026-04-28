import { asc, eq, inArray, sql } from "drizzle-orm";
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

function getCanonicalTrips(
  trips: Trip[],
  stopCountByTripId: Map<string, number>,
): Trip[] {
  const groups = new Map<string, Trip[]>();
  for (const trip of trips) {
    const key = `${trip.directionId}|${trip.tripHeadsign}`;
    const arr = groups.get(key) ?? [];
    arr.push(trip);
    groups.set(key, arr);
  }

  return Array.from(groups.values())
    .map((group) =>
      group.reduce((longest, trip) => {
        const a = stopCountByTripId.get(longest.tripId) ?? 0;
        const b = stopCountByTripId.get(trip.tripId) ?? 0;
        return b > a ? trip : longest;
      }),
    )
    .sort((a, b) => a.directionId - b.directionId);
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

  const tripRows = await db
    .select({
      tripId: tripsTable.tripId,
      routeId: tripsTable.routeId,
      shapeId: tripsTable.shapeId,
      tripHeadsign: tripsTable.tripHeadsign,
      directionId: tripsTable.directionId,
    })
    .from(tripsTable)
    .where(eq(tripsTable.routeId, routeId));

  const trips = tripRows.map(toTrip);
  if (trips.length === 0) {
    const payload: RouteCacheEntry = {
      routeId,
      route,
      canonicalTrips: [],
      stopsByTrip: {},
      shapesByTrip: {},
    };
    return Response.json(payload);
  }

  const tripIds = trips.map((t) => t.tripId);

  // One aggregation query to count stops per trip — used to pick the canonical
  // (longest) trip per direction, without fetching all 800k stop_times rows.
  const countRows = await db
    .select({
      tripId: stopTimesTable.tripId,
      cnt: sql<number>`cast(count(*) as int)`,
    })
    .from(stopTimesTable)
    .where(inArray(stopTimesTable.tripId, tripIds))
    .groupBy(stopTimesTable.tripId);

  const stopCountByTripId = new Map(countRows.map((r) => [r.tripId, r.cnt]));
  const canonicalTrips = getCanonicalTrips(trips, stopCountByTripId);
  const canonicalTripIds = canonicalTrips.map((t) => t.tripId);
  const canonicalShapeIds = Array.from(
    new Set(canonicalTrips.map((t) => t.shapeId).filter(Boolean)),
  );

  // Fetch stops only for canonical trips (2–4 trips instead of all variants).
  const stopRows = await db
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
    .orderBy(asc(stopTimesTable.tripId), asc(stopTimesTable.stopSequence));

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

  const shapesByTrip: Record<string, RouteCacheEntry["shapesByTrip"][string]> =
    {};
  if (canonicalShapeIds.length > 0) {
    const shapeRows = await db
      .select({
        shapeId: shapesTable.shapeId,
        shapePtLat: shapesTable.shapePtLat,
        shapePtLon: shapesTable.shapePtLon,
        shapePtSequence: shapesTable.shapePtSequence,
      })
      .from(shapesTable)
      .where(inArray(shapesTable.shapeId, canonicalShapeIds))
      .orderBy(asc(shapesTable.shapeId), asc(shapesTable.shapePtSequence));

    const byShapeId: Record<string, RouteCacheEntry["shapesByTrip"][string]> =
      {};
    for (const row of shapeRows) {
      if (!byShapeId[row.shapeId]) byShapeId[row.shapeId] = [];
      byShapeId[row.shapeId].push({
        lat: row.shapePtLat,
        lon: row.shapePtLon,
        sequence: row.shapePtSequence,
      });
    }
    for (const trip of canonicalTrips) {
      shapesByTrip[trip.tripId] = byShapeId[trip.shapeId] ?? [];
    }
  }

  const payload: RouteCacheEntry = {
    routeId,
    route,
    canonicalTrips,
    stopsByTrip,
    shapesByTrip,
  };

  return Response.json(payload);
}
