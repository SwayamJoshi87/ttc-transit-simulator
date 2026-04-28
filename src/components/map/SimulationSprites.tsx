"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Source, Layer } from "react-map-gl/maplibre";
import type { FeatureCollection, Feature, Point } from "geojson";
import { useRouteStore } from "@/store/routeStore";
import { useSimulationStore } from "@/store/simulationStore";
import { getRouteColor } from "@/lib/routeColors";
import type { VehiclePosition } from "@/app/api/gtfs/vehicles/route";

const POLL_INTERVAL_MS = 15_000;

export function LiveVehicles() {
  const activeRoutes = useRouteStore((s) => s.activeRoutes);
  const routes = useRouteStore((s) => s.routes);
  const showVehicles = useSimulationStore((s) => s.showVehicles);
  const [geojson, setGeojson] = useState<FeatureCollection>({
    type: "FeatureCollection",
    features: [],
  });

  // Keep a ref so the interval callback always sees current active routes
  // without restarting the interval on every route change.
  const activeRouteIdsRef = useRef(new Set<string>());
  useEffect(() => {
    activeRouteIdsRef.current = new Set(activeRoutes.keys());
  }, [activeRoutes]);

  const routeColorMapRef = useRef(new Map<string, string>());
  useEffect(() => {
    routeColorMapRef.current = new Map(
      routes.map((r) => [r.routeId, getRouteColor(r)]),
    );
  }, [routes]);

  const poll = useCallback(async () => {
    if (activeRouteIdsRef.current.size === 0) {
      setGeojson({ type: "FeatureCollection", features: [] });
      return;
    }
    try {
      const resp = await fetch("/api/gtfs/vehicles");
      if (!resp.ok) return;
      const all: VehiclePosition[] = await resp.json();

      const features: Feature<Point>[] = all
        .filter((v) => activeRouteIdsRef.current.has(v.routeId))
        .map((v) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [v.lon, v.lat] },
          properties: {
            color: routeColorMapRef.current.get(v.routeId) ?? "#888888",
            vehicleId: v.vehicleId,
            bearing: v.bearing,
          },
        }));

      setGeojson({ type: "FeatureCollection", features });
    } catch {
      // silently ignore network errors between polls
    }
  }, []);

  // Poll immediately when active routes change, then on a fixed interval.
  useEffect(() => {
    if (!showVehicles) {
      setGeojson({ type: "FeatureCollection", features: [] });
      return;
    }
    void poll();
    const id = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [showVehicles, activeRoutes, poll]);

  if (!showVehicles) return null;

  return (
    <Source id="live-vehicles" type="geojson" data={geojson}>
      <Layer
        id="live-vehicles-layer"
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
