"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from "react-leaflet";
import { useTheme } from "next-themes";
import { useRouteStore } from "@/store/routeStore";
import { getRouteColor } from "@/lib/routeColors";
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

function FlyToRoute() {
  const map = useMap();
  const stopsForTrip = useRouteStore((s) => s.stopsForTrip);

  useEffect(() => {
    if (stopsForTrip.length === 0) return;
    const lats = stopsForTrip.map((s) => s.lat);
    const lons = stopsForTrip.map((s) => s.lon);
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)],
      ],
      { padding: [40, 40] }
    );
  }, [stopsForTrip, map]);

  return null;
}

export default function TransitMap() {
  const { resolvedTheme } = useTheme();
  const shapesForTrip = useRouteStore((s) => s.shapesForTrip);
  const stopsForTrip = useRouteStore((s) => s.stopsForTrip);
  const selectedRouteId = useRouteStore((s) => s.selectedRouteId);
  const routes = useRouteStore((s) => s.routes);

  const selectedRoute = routes.find((r) => r.routeId === selectedRouteId);
  const routeColor = selectedRoute ? getRouteColor(selectedRoute) : "#DA291C";
  const isDark = resolvedTheme === "dark";
  const tiles = isDark ? DARK_TILES : LIGHT_TILES;
  // Swap tile layer key to force re-mount on theme change
  const tileKey = isDark ? "dark" : "light";

  const shapePositions: [number, number][] = shapesForTrip.map((s) => [s.lat, s.lon]);

  return (
    <MapContainer
      center={TORONTO_CENTER}
      zoom={12}
      className="h-full w-full"
      zoomControl={true}
    >
      <TileLayer key={tileKey} attribution={tiles.attribution} url={tiles.url} />
      <FlyToRoute />

      {shapePositions.length > 0 && (
        <Polyline
          key={`${selectedRouteId}-${routeColor}`}
          positions={shapePositions}
          pathOptions={{ color: routeColor, weight: 4, opacity: 0.9 }}
        />
      )}

      {stopsForTrip.map((stop) => (
        <CircleMarker
          key={stop.stopId}
          center={[stop.lat, stop.lon]}
          radius={5}
          pathOptions={{
            color: routeColor,
            fillColor: isDark ? "#0a0a0a" : "#ffffff",
            fillOpacity: 1,
            weight: 2,
          }}
        >
          <Tooltip>{stop.stopName}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
