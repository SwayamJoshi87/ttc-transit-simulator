"use client";

import { useMemo } from "react";
import { Source, Layer } from "react-map-gl/maplibre";
import type { FeatureCollection, Feature, Point } from "geojson";
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

  // Build a single GeoJSON FeatureCollection for all active vehicle sprites.
  // Per-feature `color` property drives MapLibre's data-driven circle-color expression.
  const spritesGeoJSON = useMemo((): FeatureCollection => {
    const features: Feature<Point>[] = [];

    if (!showSprites) return { type: "FeatureCollection", features };

    for (const active of activeRoutes.values()) {
      const cache = routeCache.get(active.routeId);
      if (!cache) continue;

      const route = routes.find((r) => r.routeId === active.routeId);
      if (!route) continue;

      const color = getRouteColor(route);

      // Show only the selected direction to avoid opposite-direction artifacts.
      const selectedCanonical = active.trips.find(
        (t) => t.tripId === active.tripId,
      );
      const selectedDirectionId = selectedCanonical?.directionId ?? 0;

      for (const trip of cache.trips) {
        if (trip.directionId !== selectedDirectionId) continue;

        const calendar = cache.serviceCalendarById[trip.serviceId];
        if (!calendar || !calendar[serviceDay]) continue;

        const stopTimes = cache.stopTimesByTrip[trip.tripId] ?? [];
        if (stopTimes.length < 2) continue;
        if (
          currentTimeSec < stopTimes[0].arrivalSec ||
          currentTimeSec > stopTimes[stopTimes.length - 1].arrivalSec
        )
          continue;

        if (active.stops.length === 0) continue;
        const stopMap = new Map(
          active.stops.map((stop) => [stop.stopId, stop]),
        );
        const pos = getSpritePosition(trip, stopTimes, stopMap, currentTimeSec);
        if (!pos) continue;

        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [pos.lon, pos.lat] },
          properties: {
            color,
            tripId: trip.tripId,
            routeId: route.routeId,
            routeShortName: route.routeShortName,
            tripHeadsign: trip.tripHeadsign,
          },
        });
      }
    }

    return { type: "FeatureCollection", features };
  }, [activeRoutes, routeCache, routes, currentTimeSec, serviceDay, showSprites]);

  if (!showSprites) return null;

  return (
    <Source id="sprites" type="geojson" data={spritesGeoJSON}>
      <Layer
        id="sprites-layer"
        type="circle"
        paint={{
          "circle-radius": 6,
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
          "circle-opacity": 1,
          "circle-stroke-opacity": 1,
        }}
      />
    </Source>
  );
}
