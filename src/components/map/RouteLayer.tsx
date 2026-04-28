"use client";

import { useMemo } from "react";
import { Source, Layer, Marker } from "react-map-gl/maplibre";
import type { MarkerDragEvent } from "react-map-gl/maplibre";
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
 * Renders one transit route as three stacked MapLibre line layers (outer halo,
 * inner halo, sharp main line) plus circle markers for each stop.
 *
 * In edit mode, stop markers become individual draggable Marker components.
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
  const focusMul = isFocused ? 1 : 0.55;
  const id = active.routeId;

  const routeGeoJSON = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features:
        active.shapes.length > 1
          ? [
              {
                type: "Feature" as const,
                geometry: {
                  type: "LineString" as const,
                  coordinates: active.shapes.map((s) => [s.lon, s.lat]),
                },
                properties: {},
              },
            ]
          : [],
    }),
    [active.shapes],
  );

  const stopsGeoJSON = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: active.stops.map((stop) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [stop.lon, stop.lat],
        },
        properties: {
          stopId: stop.stopId,
          stopName: stop.stopName,
          sequence: stop.sequence,
        },
      })),
    }),
    [active.stops],
  );

  if (active.shapes.length === 0) return null;

  const stopFill = isDark ? "#0a0a0a" : "#ffffff";

  return (
    <>
      {/* Route shape: 3 line layers for glow effect */}
      <Source id={`${id}-route`} type="geojson" data={routeGeoJSON}>
        <Layer
          id={`${id}-halo-outer`}
          type="line"
          paint={{
            "line-color": color,
            "line-width": 14,
            "line-opacity": 0.12 * focusMul,
            "line-blur": 6,
          }}
          layout={{ "line-cap": "round", "line-join": "round" }}
        />
        <Layer
          id={`${id}-halo-inner`}
          type="line"
          paint={{
            "line-color": color,
            "line-width": 8,
            "line-opacity": 0.28 * focusMul,
            "line-blur": 2,
          }}
          layout={{ "line-cap": "round", "line-join": "round" }}
        />
        <Layer
          id={`${id}-main`}
          type="line"
          paint={{
            "line-color": color,
            "line-width": isFocused ? 4 : 3,
            "line-opacity": isFocused ? 1 : 0.85,
          }}
          layout={{ "line-cap": "round", "line-join": "round" }}
        />
      </Source>

      {/* Stop markers: draggable in edit mode, circle layer in view mode */}
      {isStopEditing && isFocused ? (
        active.stops.map((stop) => (
          <Marker
            key={`${id}-${stop.stopId}-${stop.sequence}`}
            longitude={stop.lon}
            latitude={stop.lat}
            draggable
            onDragEnd={(e: MarkerDragEvent) =>
              onStopMove(
                id,
                stop.stopId,
                stop.sequence,
                e.lngLat.lat,
                e.lngLat.lng,
              )
            }
          >
            <div
              title={stop.stopName}
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: color,
                border: `2px solid ${stopFill}`,
                boxShadow: "0 0 0 1px rgba(0,0,0,0.08)",
                cursor: "grab",
              }}
            />
          </Marker>
        ))
      ) : (
        <Source id={`${id}-stops`} type="geojson" data={stopsGeoJSON}>
          <Layer
            id={`${id}-stops-circle`}
            type="circle"
            paint={{
              "circle-radius": isFocused ? 5 : 3.5,
              "circle-color": stopFill,
              "circle-stroke-color": color,
              "circle-stroke-width": 2,
              "circle-opacity": isFocused ? 1 : 0.7,
              "circle-stroke-opacity": isFocused ? 1 : 0.7,
            }}
          />
        </Source>
      )}
    </>
  );
}
