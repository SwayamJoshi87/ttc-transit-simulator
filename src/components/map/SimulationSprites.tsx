"use client";

import { useMemo } from "react";
import { CircleMarker, Tooltip } from "react-leaflet";
import { useRouteStore } from "@/store/routeStore";
import { useSimulationStore } from "@/store/simulationStore";
import { getRouteColor } from "@/lib/routeColors";
import { getSpritePosition } from "@/lib/simulation";

export function SimulationSprites() {
  const activeRoutes = useRouteStore((s) => s.activeRoutes);
  const routeCache = useRouteStore((s) => s.routeCache);
  const routes = useRouteStore((s) => s.routes);
  const showSprites = useSimulationStore((s) => s.showSprites);
  const currentTimeSec = useSimulationStore((s) => s.currentTimeSec);
  const serviceDay = useSimulationStore((s) => s.serviceDay);

  // For each active route on the map, find all trips active at currentTime and
  // compute sprite positions. Recomputed every time the slider/play tick fires.
  const sprites = useMemo(() => {
    if (!showSprites) return [];
    const out: {
      lat: number;
      lon: number;
      color: string;
      routeShortName: string;
      tripId: string;
      routeId: string;
      tripHeadsign: string;
    }[] = [];

    for (const active of activeRoutes.values()) {
      const cache = routeCache.get(active.routeId);
      if (!cache) continue;

      const route = routes.find((r) => r.routeId === active.routeId);
      if (!route) continue;

      const color = getRouteColor(route);

      for (const trip of cache.trips) {
        const calendar = cache.serviceCalendarById[trip.serviceId];
        if (!calendar || !calendar[serviceDay]) continue;

        const stopTimes = cache.stopTimesByTrip[trip.tripId] ?? [];
        if (stopTimes.length < 2) continue;

        const firstTime = stopTimes[0].arrivalSec;
        const lastTime = stopTimes[stopTimes.length - 1].arrivalSec;
        if (currentTimeSec < firstTime || currentTimeSec > lastTime) continue;

        const stops = cache.stopsByTrip[trip.tripId] ?? active.stops;
        if (stops.length === 0) continue;

        const stopMap = new Map(stops.map((stop) => [stop.stopId, stop]));
        const pos = getSpritePosition(trip, stopTimes, stopMap, currentTimeSec);

        if (!pos) continue;
        out.push({
          lat: pos.lat,
          lon: pos.lon,
          color,
          routeShortName: route.routeShortName,
          tripId: trip.tripId,
          routeId: route.routeId,
          tripHeadsign: trip.tripHeadsign,
        });
      }
    }
    return out;
  }, [
    activeRoutes,
    routeCache,
    routes,
    currentTimeSec,
    serviceDay,
    showSprites,
  ]);

  if (!showSprites) return null;

  return (
    <>
      {sprites.map((s) => (
        <CircleMarker
          key={`${s.routeId}-${s.tripId}`}
          center={[s.lat, s.lon]}
          radius={6}
          pathOptions={{
            color: "#ffffff",
            fillColor: s.color,
            fillOpacity: 1,
            weight: 2,
            opacity: 1,
          }}
        >
          <Tooltip>
            <div className="text-[11px]">
              <span className="font-bold">{s.routeShortName}</span>
              {s.tripHeadsign && (
                <span className="ml-1 text-muted-foreground">
                  → {s.tripHeadsign}
                </span>
              )}
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}
