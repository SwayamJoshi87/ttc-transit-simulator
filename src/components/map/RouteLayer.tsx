"use client";

import { Polyline, CircleMarker, Tooltip } from "react-leaflet";
import { useTheme } from "next-themes";
import type { ActiveRouteState } from "@/store/routeStore";

interface Props {
  active: ActiveRouteState;
  color: string;
  /** When true, full glow + opacity. When false, render with reduced emphasis. */
  isFocused: boolean;
}

/**
 * Renders one transit route on the map as three stacked polylines (outer halo,
 * inner halo, sharp main line) plus circle markers for each stop. The stacked
 * polyline approach produces a "glow" without SVG filters, which would lag
 * across many routes.
 */
export function RouteLayer({ active, color, isFocused }: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const positions: [number, number][] = active.shapes.map((s) => [s.lat, s.lon]);
  if (positions.length === 0) return null;

  // Halos are softer when not focused so pinned-but-background routes stay readable.
  const focusMul = isFocused ? 1 : 0.55;

  // Unique key combining color forces remount when color changes,
  // which works around react-leaflet's stale pathOptions.
  const baseKey = `${active.routeId}-${color}-${isFocused ? "f" : "b"}`;

  return (
    <>
      <Polyline
        key={`${baseKey}-halo-outer`}
        positions={positions}
        pathOptions={{
          color,
          weight: 14,
          opacity: 0.12 * focusMul,
          lineCap: "round",
          lineJoin: "round",
        }}
      />
      <Polyline
        key={`${baseKey}-halo-inner`}
        positions={positions}
        pathOptions={{
          color,
          weight: 8,
          opacity: 0.28 * focusMul,
          lineCap: "round",
          lineJoin: "round",
        }}
      />
      <Polyline
        key={`${baseKey}-main`}
        positions={positions}
        pathOptions={{
          color,
          weight: isFocused ? 4 : 3,
          opacity: isFocused ? 1 : 0.85,
          lineCap: "round",
          lineJoin: "round",
        }}
      />

      {active.stops.map((stop) => (
        <CircleMarker
          key={`${active.routeId}-${stop.stopId}`}
          center={[stop.lat, stop.lon]}
          radius={isFocused ? 5 : 3.5}
          pathOptions={{
            color,
            fillColor: isDark ? "#0a0a0a" : "#ffffff",
            fillOpacity: 1,
            weight: 2,
            opacity: isFocused ? 1 : 0.7,
          }}
        >
          <Tooltip>{stop.stopName}</Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}
