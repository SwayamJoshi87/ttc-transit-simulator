import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/gtfs/db";
import {
  calendarTable,
  routesTable,
  shapesTable,
  stopTimesTable,
  stopsTable,
  tripsTable,
} from "@/lib/gtfs/schema";
import type {
  Route,
  RouteCacheEntry,
  Stop,
  StopTime,
  Trip,
} from "@/store/routeStore";

export const runtime = "nodejs";

function parseGtfsTime(t: string): number {
  const parts = t.split(":");
  if (parts.length !== 3) return 0;
  return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
}

function toTrip(row: {
  tripId: string;
  routeId: string;
  shapeId: string;
  tripHeadsign: string;
  directionId: number | null;
  serviceId: string;
}): Trip {
  return {
    tripId: row.tripId,
    routeId: row.routeId,
    shapeId: row.shapeId,
    tripHeadsign: row.tripHeadsign,
    directionId: Number(row.directionId ?? 0),
    serviceId: row.serviceId,
  };
}

function getCanonicalTrips(
  trips: Trip[],
  stopTimesByTrip: Record<string, StopTime[]>,
) {
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
        const lengthA = stopTimesByTrip[longest.tripId]?.length ?? 0;
        const lengthB = stopTimesByTrip[trip.tripId]?.length ?? 0;
        return lengthB > lengthA ? trip : longest;
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
      serviceId: tripsTable.serviceId,
    })
    .from(tripsTable)
    .where(eq(tripsTable.routeId, routeId));

  const trips = tripRows.map(toTrip);
  if (trips.length === 0) {
    const payload: RouteCacheEntry = {
      routeId,
      route,
      trips: [],
      canonicalTrips: [],
      stopsByTrip: {},
      shapesByTrip: {},
      stopTimesByTrip: {},
      serviceCalendarById: {},
    };
    return Response.json(payload);
  }

  const tripIds = trips.map((trip) => trip.tripId);
  const shapeIds = Array.from(
    new Set(trips.map((trip) => trip.shapeId).filter(Boolean)),
  );
  const serviceIds = Array.from(
    new Set(trips.map((trip) => trip.serviceId).filter(Boolean)),
  );

  const stopTimeRows = await db
    .select({
      tripId: stopTimesTable.tripId,
      stopId: stopTimesTable.stopId,
      stopSequence: stopTimesTable.stopSequence,
      arrivalTime: stopTimesTable.arrivalTime,
      departureTime: stopTimesTable.departureTime,
      stopName: stopsTable.stopName,
      stopLat: stopsTable.stopLat,
      stopLon: stopsTable.stopLon,
    })
    .from(stopTimesTable)
    .innerJoin(stopsTable, eq(stopsTable.stopId, stopTimesTable.stopId))
    .where(inArray(stopTimesTable.tripId, tripIds))
    .orderBy(asc(stopTimesTable.tripId), asc(stopTimesTable.stopSequence));

  const stopTimesByTrip: Record<string, StopTime[]> = {};
  const stopsByTrip: Record<string, Stop[]> = {};
  for (const row of stopTimeRows) {
    const stopTime: StopTime = {
      stopId: row.stopId,
      sequence: row.stopSequence,
      arrivalSec: parseGtfsTime(row.arrivalTime),
      departureSec: parseGtfsTime(row.departureTime),
    };
    const stop: Stop = {
      stopId: row.stopId,
      stopName: row.stopName,
      lat: row.stopLat,
      lon: row.stopLon,
      sequence: row.stopSequence,
    };

    if (!stopTimesByTrip[row.tripId]) stopTimesByTrip[row.tripId] = [];
    if (!stopsByTrip[row.tripId]) stopsByTrip[row.tripId] = [];

    stopTimesByTrip[row.tripId].push(stopTime);
    stopsByTrip[row.tripId].push(stop);
  }

  const shapesByTrip: Record<string, RouteCacheEntry["shapesByTrip"][string]> =
    {};
  if (shapeIds.length > 0) {
    const shapeRows = await db
      .select({
        shapeId: shapesTable.shapeId,
        shapePtLat: shapesTable.shapePtLat,
        shapePtLon: shapesTable.shapePtLon,
        shapePtSequence: shapesTable.shapePtSequence,
      })
      .from(shapesTable)
      .where(inArray(shapesTable.shapeId, shapeIds))
      .orderBy(asc(shapesTable.shapeId), asc(shapesTable.shapePtSequence));

    const shapesByShapeId: Record<
      string,
      RouteCacheEntry["shapesByTrip"][string]
    > = {};
    for (const row of shapeRows) {
      if (!shapesByShapeId[row.shapeId]) shapesByShapeId[row.shapeId] = [];
      shapesByShapeId[row.shapeId].push({
        lat: row.shapePtLat,
        lon: row.shapePtLon,
        sequence: row.shapePtSequence,
      });
    }

    for (const trip of trips) {
      shapesByTrip[trip.tripId] = shapesByShapeId[trip.shapeId] ?? [];
    }
  }

  const serviceCalendarById: RouteCacheEntry["serviceCalendarById"] = {};
  if (serviceIds.length > 0) {
    const calendarRows = await db
      .select({
        serviceId: calendarTable.serviceId,
        monday: calendarTable.monday,
        tuesday: calendarTable.tuesday,
        wednesday: calendarTable.wednesday,
        thursday: calendarTable.thursday,
        friday: calendarTable.friday,
        saturday: calendarTable.saturday,
        sunday: calendarTable.sunday,
      })
      .from(calendarTable)
      .where(inArray(calendarTable.serviceId, serviceIds));

    for (const row of calendarRows) {
      serviceCalendarById[row.serviceId] = {
        monday: Boolean(row.monday),
        tuesday: Boolean(row.tuesday),
        wednesday: Boolean(row.wednesday),
        thursday: Boolean(row.thursday),
        friday: Boolean(row.friday),
        saturday: Boolean(row.saturday),
        sunday: Boolean(row.sunday),
      };
    }
  }

  const canonicalTrips = getCanonicalTrips(trips, stopTimesByTrip);

  const payload: RouteCacheEntry = {
    routeId,
    route,
    trips,
    canonicalTrips,
    stopsByTrip,
    shapesByTrip,
    stopTimesByTrip,
    serviceCalendarById,
  };

  return Response.json(payload);
}
