"use client";

import { useEffect, useRef } from "react";
import Map, { useMap } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "@/components/theme-provider";
import { useRouteStore } from "@/store/routeStore";
import { getRouteColor } from "@/lib/routeColors";
import { RouteLayer } from "./RouteLayer";
import { LiveVehicles } from "./SimulationSprites";

const LIGHT_STYLE =
  "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const DARK_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

/** Auto-fits the map to the focused route's stops whenever the focused route or trip changes. */
function FlyToFocused() {
  const { current: map } = useMap();
  const focusedRouteId = useRouteStore((s) => s.focusedRouteId);
  const activeRoutes = useRouteStore((s) => s.activeRoutes);
  const focusedTripId = focusedRouteId
    ? activeRoutes.get(focusedRouteId)?.tripId
    : null;
  const activeRoutesRef = useRef(activeRoutes);

  useEffect(() => {
    activeRoutesRef.current = activeRoutes;
  }, [activeRoutes]);

  useEffect(() => {
    if (!map || !focusedRouteId) return;
    const focused = activeRoutesRef.current.get(focusedRouteId);
    if (!focused || focused.stops.length === 0) return;
    const lons = focused.stops.map((s) => s.lon);
    const lats = focused.stops.map((s) => s.lat);
    map.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { padding: 40, duration: 800 },
    );
  }, [focusedRouteId, focusedTripId, map]);

  return null;
}

function FlyToStop() {
  const { current: map } = useMap();
  const stopCameraTarget = useRouteStore((s) => s.stopCameraTarget);

  useEffect(() => {
    if (!map || !stopCameraTarget) return;

    map.flyTo({
      center: [stopCameraTarget.lon, stopCameraTarget.lat],
      zoom: Math.max(map.getZoom(), 15),
      duration: 700,
      essential: true,
    });
  }, [map, stopCameraTarget]);

  return null;
}

export default function TransitMap() {
  const { resolvedTheme } = useTheme();
  const activeRoutes = useRouteStore((s) => s.activeRoutes);
  const focusedRouteId = useRouteStore((s) => s.focusedRouteId);
  const routes = useRouteStore((s) => s.routes);
  const isStopEditMode = useRouteStore((s) => s.isStopEditMode);
  const updateStopPosition = useRouteStore((s) => s.updateStopPosition);

  const isDark = resolvedTheme === "dark";

  // Focused route renders last so it stacks on top of pinned routes.
  const sortedActive = Array.from(activeRoutes.values()).sort((a) =>
    a.routeId === focusedRouteId ? 1 : -1,
  );

  return (
    <Map
      id="main"
      initialViewState={{ longitude: -79.42, latitude: 43.7, zoom: 12 }}
      style={{ width: "100%", height: "100%" }}
      mapStyle={isDark ? DARK_STYLE : LIGHT_STYLE}
    >
      <FlyToFocused />
      <FlyToStop />

      {sortedActive.map((active) => {
        const route = routes.find((r) => r.routeId === active.routeId);
        if (!route) return null;
        return (
          <RouteLayer
            key={active.routeId}
            active={active}
            color={getRouteColor(route)}
            isFocused={active.routeId === focusedRouteId}
            isStopEditing={isStopEditMode}
            onStopMove={updateStopPosition}
          />
        );
      })}

      <LiveVehicles />
    </Map>
  );
}
