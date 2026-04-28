"use client";

import { useEffect, useRef, useState } from "react";
import Map, { Popup, useMap } from "react-map-gl/maplibre";
import type { MapLayerMouseEvent } from "react-map-gl/maplibre";
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

export default function TransitMap() {
  const { resolvedTheme } = useTheme();
  const activeRoutes = useRouteStore((s) => s.activeRoutes);
  const focusedRouteId = useRouteStore((s) => s.focusedRouteId);
  const routes = useRouteStore((s) => s.routes);
  const isStopEditMode = useRouteStore((s) => s.isStopEditMode);
  const updateStopPosition = useRouteStore((s) => s.updateStopPosition);

  const [hoveredStop, setHoveredStop] = useState<{
    lon: number;
    lat: number;
    name: string;
  } | null>(null);

  const isDark = resolvedTheme === "dark";

  // Focused route renders last so it stacks on top of pinned routes.
  const sortedActive = Array.from(activeRoutes.values()).sort((a) =>
    a.routeId === focusedRouteId ? 1 : -1,
  );

  // Only stop-circle layers are interactive (hover tooltips).
  const stopLayerIds = sortedActive.map((a) => `${a.routeId}-stops-circle`);

  function handleMouseEnterStop(e: MapLayerMouseEvent) {
    const feature = e.features?.[0];
    if (!feature || feature.geometry.type !== "Point") return;
    const coords = (feature.geometry as GeoJSON.Point).coordinates;
    setHoveredStop({
      lon: coords[0],
      lat: coords[1],
      name: (feature.properties?.stopName as string) ?? "",
    });
  }

  return (
    <Map
      id="main"
      initialViewState={{ longitude: -79.42, latitude: 43.7, zoom: 12 }}
      style={{ width: "100%", height: "100%" }}
      mapStyle={isDark ? DARK_STYLE : LIGHT_STYLE}
      interactiveLayerIds={stopLayerIds}
      onMouseEnter={handleMouseEnterStop}
      onMouseLeave={() => setHoveredStop(null)}
    >
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

      <LiveVehicles />

      {hoveredStop && (
        <Popup
          longitude={hoveredStop.lon}
          latitude={hoveredStop.lat}
          closeButton={false}
          closeOnClick={false}
          offset={12}
          style={{ pointerEvents: "none" }}
        >
          <span className="text-xs">{hoveredStop.name}</span>
        </Popup>
      )}
    </Map>
  );
}
