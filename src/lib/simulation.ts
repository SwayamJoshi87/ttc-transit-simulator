import type { ServiceCalendar, StopTime, Trip } from "@/store/routeStore";
import type { ServiceDay } from "@/store/simulationStore";

export interface SpritePosition {
  tripId: string;
  routeId: string;
  lat: number;
  lon: number;
  /** Heading in degrees, 0 = north, 90 = east. Useful if we ever want directional icons. */
  bearing: number;
  /** Progress through the trip 0–1, for fading newly-spawned / about-to-end sprites. */
  progress: number;
}

/** Returns the set of service_ids that operate on the given day. */
export function getActiveServiceIds(
  calendarByServiceId: Record<string, ServiceCalendar>,
  day: ServiceDay,
): Set<string> {
  return new Set(
    Object.entries(calendarByServiceId)
      .filter(([, calendar]) => calendar[day])
      .map(([serviceId]) => serviceId),
  );
}

/**
 * For a given route, returns all trips active at time T (in seconds-since-midnight)
 * filtered to those whose service_id is in `activeServiceIds`.
 */
export function getActiveTripsForRoute(
  routeId: string,
  timeSec: number,
  trips: Trip[],
  stopTimesByTrip: Map<string, StopTime[]>,
  activeServiceIds: Set<string>,
): { trip: Trip; stopTimes: StopTime[] }[] {
  const result: { trip: Trip; stopTimes: StopTime[] }[] = [];
  for (const t of trips) {
    if (t.routeId !== routeId) continue;
    if (!activeServiceIds.has(t.serviceId)) continue;
    const sts = stopTimesByTrip.get(t.tripId);
    if (!sts || sts.length < 2) continue;
    const first = sts[0].arrivalSec;
    const last = sts[sts.length - 1].arrivalSec;
    if (timeSec < first || timeSec > last) continue;
    result.push({ trip: t, stopTimes: sts });
  }
  return result;
}

interface StopWithCoord {
  stopId: string;
  lat: number;
  lon: number;
}

/**
 * Interpolates a sprite's position along a trip at time T using stop-to-stop linear
 * interpolation. We don't follow the shape because that requires shape_dist_traveled
 * which is optional in GTFS — stop-to-stop produces visually-good results.
 */
export function getSpritePosition(
  trip: Trip,
  stopTimes: StopTime[],
  stopMap: Map<string, StopWithCoord>,
  timeSec: number,
): SpritePosition | null {
  // Find segment [i, i+1] such that stopTimes[i].departureSec <= T <= stopTimes[i+1].arrivalSec.
  // If T is during a dwell at a stop, position = that stop.
  for (let i = 0; i < stopTimes.length - 1; i++) {
    const a = stopTimes[i];
    const b = stopTimes[i + 1];

    // Dwelling at stop a
    if (timeSec >= a.arrivalSec && timeSec <= a.departureSec) {
      const stop = stopMap.get(a.stopId);
      if (!stop) return null;
      return {
        tripId: trip.tripId,
        routeId: trip.routeId,
        lat: stop.lat,
        lon: stop.lon,
        bearing: 0,
        progress: i / (stopTimes.length - 1),
      };
    }

    // Travelling from a to b
    if (timeSec >= a.departureSec && timeSec <= b.arrivalSec) {
      const stopA = stopMap.get(a.stopId);
      const stopB = stopMap.get(b.stopId);
      if (!stopA || !stopB) return null;
      const span = b.arrivalSec - a.departureSec;
      const frac = span > 0 ? (timeSec - a.departureSec) / span : 0;
      const lat = stopA.lat + (stopB.lat - stopA.lat) * frac;
      const lon = stopA.lon + (stopB.lon - stopA.lon) * frac;
      const bearing =
        (Math.atan2(stopB.lon - stopA.lon, stopB.lat - stopA.lat) * 180) /
        Math.PI;
      return {
        tripId: trip.tripId,
        routeId: trip.routeId,
        lat,
        lon,
        bearing,
        progress: (i + frac) / (stopTimes.length - 1),
      };
    }
  }

  // Fallback: at the very last stop
  const last = stopTimes[stopTimes.length - 1];
  if (timeSec >= last.arrivalSec) {
    const stop = stopMap.get(last.stopId);
    if (!stop) return null;
    return {
      tripId: trip.tripId,
      routeId: trip.routeId,
      lat: stop.lat,
      lon: stop.lon,
      bearing: 0,
      progress: 1,
    };
  }

  return null;
}
