"use client";

import { useMemo } from "react";
import { CircleMarker, Tooltip } from "react-leaflet";
import { useRouteStore } from "@/store/routeStore";
import { useSimulationStore } from "@/store/simulationStore";
import { useGtfs } from "@/lib/gtfs/GtfsProvider";
import { getRouteColor } from "@/lib/routeColors";
import { getActiveServiceIds, getActiveTripsForRoute, getSpritePosition } from "@/lib/simulation";

export function SimulationSprites() {
  const { data: gtfs } = useGtfs();
  const activeRoutes = useRouteStore((s) => s.activeRoutes);
  const routes = useRouteStore((s) => s.routes);
  const showSprites = useSimulationStore((s) => s.showSprites);
  const currentTimeSec = useSimulationStore((s) => s.currentTimeSec);
  const serviceDay = useSimulationStore((s) => s.serviceDay);

  const activeServiceIds = useMemo(
    () => (gtfs ? getActiveServiceIds(gtfs.calendar, serviceDay) : new Set<string>()),
    [gtfs, serviceDay]
  );

  // For each active route on the map, find all trips active at currentTime and
  // compute sprite positions. Recomputed every time the slider/play tick fires.
  const sprites = useMemo(() => {
    if (!gtfs || !showSprites) return [];
    const out: { lat: number; lon: number; color: string; routeShortName: string; tripId: string; routeId: string; tripHeadsign: string }[] = [];
    for (const active of activeRoutes.values()) {
      const route = routes.find((r) => r.routeId === active.routeId);
      if (!route) continue;
      const color = getRouteColor(route);
      const trips = getActiveTripsForRoute(
        active.routeId,
        currentTimeSec,
        gtfs.trips,
        gtfs.stopTimesByTrip,
        activeServiceIds
      );
      for (const { trip, stopTimes } of trips) {
        const pos = getSpritePosition(trip, stopTimes, gtfs.stopMap, currentTimeSec);
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
  }, [gtfs, activeRoutes, routes, currentTimeSec, activeServiceIds, showSprites]);

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
              {s.tripHeadsign && <span className="ml-1 text-muted-foreground">→ {s.tripHeadsign}</span>}
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}
