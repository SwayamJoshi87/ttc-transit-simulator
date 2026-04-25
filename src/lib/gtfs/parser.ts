import Papa from "papaparse";
import type { Route, Trip, Stop, Shape } from "@/store/routeStore";

async function fetchAndParse(url: string): Promise<Record<string, string>[]> {
  const text = await fetch(url).then((r) => r.text());
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  });
  return parsed.data;
}

export async function loadGTFS() {
  const base = "/gtfs";

  const [rawRoutes, rawTrips, rawStops, rawStopTimes, rawShapes] = await Promise.all([
    fetchAndParse(`${base}/routes.txt`),
    fetchAndParse(`${base}/trips.txt`),
    fetchAndParse(`${base}/stops.txt`),
    fetchAndParse(`${base}/stop_times.txt`),
    fetchAndParse(`${base}/shapes.txt`),
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
  }));

  const stopMap = new Map(
    rawStops.map((s) => [
      s.stop_id,
      { stopId: s.stop_id, stopName: s.stop_name, lat: parseFloat(s.stop_lat), lon: parseFloat(s.stop_lon) },
    ])
  );

  const stopTimesByTrip = new Map<string, { stopId: string; sequence: number }[]>();
  for (const st of rawStopTimes) {
    const arr = stopTimesByTrip.get(st.trip_id) ?? [];
    arr.push({ stopId: st.stop_id, sequence: parseInt(st.stop_sequence) });
    stopTimesByTrip.set(st.trip_id, arr);
  }

  const shapesByShapeId = new Map<string, Shape[]>();
  for (const s of rawShapes) {
    const arr = shapesByShapeId.get(s.shape_id) ?? [];
    arr.push({ lat: parseFloat(s.shape_pt_lat), lon: parseFloat(s.shape_pt_lon), sequence: parseInt(s.shape_pt_sequence) });
    shapesByShapeId.set(s.shape_id, arr);
  }

  return { routes, trips, stopMap, stopTimesByTrip, shapesByShapeId };
}

export function getStopsForTrip(
  tripId: string,
  stopTimesByTrip: Map<string, { stopId: string; sequence: number }[]>,
  stopMap: Map<string, { stopId: string; stopName: string; lat: number; lon: number }>
): Stop[] {
  const times = stopTimesByTrip.get(tripId) ?? [];
  return times
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .flatMap((t) => {
      const stop = stopMap.get(t.stopId);
      return stop ? [{ ...stop, sequence: t.sequence }] : [];
    });
}

export function getShapesForTrip(
  shapeId: string,
  shapesByShapeId: Map<string, Shape[]>
): Shape[] {
  return (shapesByShapeId.get(shapeId) ?? []).slice().sort((a, b) => a.sequence - b.sequence);
}

/**
 * For a route, returns the canonical (longest) trip per (directionId, tripHeadsign) combo.
 * This avoids surfacing short-turn or test trips as the route's representative variant.
 */
export function getCanonicalTrips(
  trips: Trip[],
  stopTimesByTrip: Map<string, { stopId: string; sequence: number }[]>
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
