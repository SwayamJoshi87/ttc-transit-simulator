import Papa from "papaparse";
import type { Route, Trip, Stop, Shape } from "@/store/routeStore";

export interface StopTime {
  stopId: string;
  sequence: number;
  /** Seconds since service-day start (00:00). Can exceed 86400 for after-midnight trips. */
  arrivalSec: number;
  departureSec: number;
}

export interface CalendarService {
  serviceId: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  startDate: string; // YYYYMMDD
  endDate: string;   // YYYYMMDD
}

async function fetchAndParse(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url);
  if (!res.ok) return [];
  const text = await res.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  });
  return parsed.data;
}

/** Parse "HH:MM:SS" → seconds since service-day start. Handles >24:00:00. */
export function parseGtfsTime(t: string): number {
  const parts = t.split(":");
  if (parts.length !== 3) return 0;
  return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
}

export async function loadGTFS() {
  const base = "/gtfs";

  const [rawRoutes, rawTrips, rawStops, rawStopTimes, rawShapes, rawCalendar] = await Promise.all([
    fetchAndParse(`${base}/routes.txt`),
    fetchAndParse(`${base}/trips.txt`),
    fetchAndParse(`${base}/stops.txt`),
    fetchAndParse(`${base}/stop_times.txt`),
    fetchAndParse(`${base}/shapes.txt`),
    fetchAndParse(`${base}/calendar.txt`),
  ]);

  const routes: Route[] = rawRoutes.map((r) => ({
    routeId: r.route_id,
    routeShortName: r.route_short_name,
    routeLongName: r.route_long_name,
    routeType: parseInt(r.route_type),
    routeColor: r.route_color || undefined,
    routeTextColor: r.route_text_color || undefined,
  }));

  const trips: Trip[] = rawTrips.map((t) => ({
    tripId: t.trip_id,
    routeId: t.route_id,
    shapeId: t.shape_id,
    tripHeadsign: t.trip_headsign,
    directionId: parseInt(t.direction_id),
    serviceId: t.service_id,
  }));

  const stopMap = new Map(
    rawStops.map((s) => [
      s.stop_id,
      { stopId: s.stop_id, stopName: s.stop_name, lat: parseFloat(s.stop_lat), lon: parseFloat(s.stop_lon) },
    ])
  );

  const stopTimesByTrip = new Map<string, StopTime[]>();
  for (const st of rawStopTimes) {
    const arr = stopTimesByTrip.get(st.trip_id) ?? [];
    arr.push({
      stopId: st.stop_id,
      sequence: parseInt(st.stop_sequence),
      arrivalSec: parseGtfsTime(st.arrival_time),
      departureSec: parseGtfsTime(st.departure_time),
    });
    stopTimesByTrip.set(st.trip_id, arr);
  }
  // Sort each trip's stop times once, here, so consumers don't have to.
  for (const arr of stopTimesByTrip.values()) {
    arr.sort((a, b) => a.sequence - b.sequence);
  }

  const shapesByShapeId = new Map<string, Shape[]>();
  for (const s of rawShapes) {
    const arr = shapesByShapeId.get(s.shape_id) ?? [];
    arr.push({ lat: parseFloat(s.shape_pt_lat), lon: parseFloat(s.shape_pt_lon), sequence: parseInt(s.shape_pt_sequence) });
    shapesByShapeId.set(s.shape_id, arr);
  }
  for (const arr of shapesByShapeId.values()) {
    arr.sort((a, b) => a.sequence - b.sequence);
  }

  const calendar: CalendarService[] = rawCalendar.map((c) => ({
    serviceId: c.service_id,
    monday: c.monday === "1",
    tuesday: c.tuesday === "1",
    wednesday: c.wednesday === "1",
    thursday: c.thursday === "1",
    friday: c.friday === "1",
    saturday: c.saturday === "1",
    sunday: c.sunday === "1",
    startDate: c.start_date,
    endDate: c.end_date,
  }));

  return { routes, trips, stopMap, stopTimesByTrip, shapesByShapeId, calendar };
}

export function getStopsForTrip(
  tripId: string,
  stopTimesByTrip: Map<string, StopTime[]>,
  stopMap: Map<string, { stopId: string; stopName: string; lat: number; lon: number }>
): Stop[] {
  const times = stopTimesByTrip.get(tripId) ?? [];
  return times.flatMap((t) => {
    const stop = stopMap.get(t.stopId);
    return stop ? [{ ...stop, sequence: t.sequence }] : [];
  });
}

export function getShapesForTrip(
  shapeId: string,
  shapesByShapeId: Map<string, Shape[]>
): Shape[] {
  return shapesByShapeId.get(shapeId) ?? [];
}

/**
 * For a route, returns the canonical (longest) trip per (directionId, tripHeadsign) combo.
 * This avoids surfacing short-turn or test trips as the route's representative variant.
 */
export function getCanonicalTrips(
  trips: Trip[],
  stopTimesByTrip: Map<string, StopTime[]>
): Trip[] {
  const groups = new Map<string, Trip[]>();
  for (const t of trips) {
    const key = `${t.directionId}|${t.tripHeadsign}`;
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }

  const stopCount = (tripId: string) => stopTimesByTrip.get(tripId)?.length ?? 0;

  return Array.from(groups.values())
    .map((group) =>
      group.reduce((longest, t) => (stopCount(t.tripId) > stopCount(longest.tripId) ? t : longest))
    )
    .sort((a, b) => a.directionId - b.directionId);
}
