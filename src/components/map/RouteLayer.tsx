"use client";

import { useMemo } from "react";
import { divIcon, type Marker as LeafletMarker } from "leaflet";
import { Marker, Polyline, CircleMarker, Tooltip } from "react-leaflet";
import { useTheme } from "@/components/theme-provider";
import type { ActiveRouteState } from "@/store/routeStore";

interface Props {
  active: ActiveRouteState;
  color: string;
  /** When true, full glow + opacity. When false, render with reduced emphasis. */
  isFocused: boolean;
  /** When true, stop markers become draggable. */
  isStopEditing: boolean;
  onStopMove: (
    routeId: string,
    stopId: string,
    sequence: number,
    lat: number,
    lon: number,
  ) => void;
}

/**
 * Renders one transit route on the map as three stacked polylines (outer halo,
 * inner halo, sharp main line) plus circle markers for each stop. The stacked
 * polyline approach produces a "glow" without SVG filters, which would lag
 * across many routes.
 */
export function RouteLayer({
  active,
  color,
  isFocused,
  isStopEditing,
  onStopMove,
}: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const stopIcon = useMemo(() => {
    const border = isDark ? "#09090b" : "#ffffff";
    const size = isFocused ? 14 : 12;
    const ring = isFocused ? 2 : 1.5;
    return divIcon({
      className: "route-stop-icon",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html: `
        <div style="
          width:${size}px;
          height:${size}px;
          border-radius:9999px;
          background:${color};
          border:${ring}px solid ${border};
          box-shadow:0 0 0 1px rgba(0,0,0,0.08);
          cursor:${isStopEditing ? "grab" : "default"};
          transform:translateZ(0);
        "></div>
      `,
    });
  }, [color, isDark, isFocused, isStopEditing]);

  const positions: [number, number][] = active.shapes.map((s) => [
    s.lat,
    s.lon,
  ]);
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

      {active.stops.map((stop) => {
        if (isStopEditing && isFocused) {
          return (
            <Marker
              key={`${active.routeId}-${stop.stopId}-${stop.sequence}`}
              position={[stop.lat, stop.lon]}
              icon={stopIcon}
              draggable
              eventHandlers={{
                dragend: (event) => {
                  const marker = event.target as LeafletMarker;
                  const next = marker.getLatLng();
                  onStopMove(
                    active.routeId,
                    stop.stopId,
                    stop.sequence,
                    next.lat,
                    next.lng,
                  );
                },
              }}
            >
              <Tooltip>{stop.stopName}</Tooltip>
            </Marker>
          );
        }

        return (
          <CircleMarker
            key={`${active.routeId}-${stop.stopId}-${stop.sequence}`}
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
        );
      })}
    </>
  );
}
