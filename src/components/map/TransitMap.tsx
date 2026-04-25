"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { useTheme } from "@/components/theme-provider";
import { useRouteStore } from "@/store/routeStore";
import { getRouteColor } from "@/lib/routeColors";
import { RouteLayer } from "./RouteLayer";
import { SimulationSprites } from "./SimulationSprites";
import "leaflet/dist/leaflet.css";

const TORONTO_CENTER: [number, number] = [43.7, -79.42];

const LIGHT_TILES = {
  url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
};

const DARK_TILES = {
  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
};

/** Auto-fit map to the focused route's stops whenever it changes. */
function FlyToFocused() {
  const map = useMap();
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
    if (!focusedRouteId) return;
    const focused = activeRoutesRef.current.get(focusedRouteId);
    if (!focused || focused.stops.length === 0) return;
    const lats = focused.stops.map((s) => s.lat);
    const lons = focused.stops.map((s) => s.lon);
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)],
      ],
      { padding: [40, 40] },
    );
  }, [focusedRouteId, focusedTripId, map]);

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
  const tiles = isDark ? DARK_TILES : LIGHT_TILES;
  const tileKey = isDark ? "dark" : "light";

  // Render order: focused route LAST so it stacks on top.
  const sortedActive = Array.from(activeRoutes.values()).sort((a) =>
    a.routeId === focusedRouteId ? 1 : -1,
  );

  return (
    <MapContainer
      center={TORONTO_CENTER}
      zoom={12}
      className="h-full w-full"
      zoomControl
    >
      <TileLayer
        key={tileKey}
        attribution={tiles.attribution}
        url={tiles.url}
      />
      <FlyToFocused />

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

      <SimulationSprites />
    </MapContainer>
  );
}
