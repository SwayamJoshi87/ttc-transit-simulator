import type { Route } from "@/store/routeStore";

// Official TTC subway line colors
const SUBWAY_LINE_COLORS: Record<string, string> = {
  "1": "#FFCB0C", // Line 1 Yonge-University - Yellow
  "2": "#2E944D", // Line 2 Bloor-Danforth - Green
  "3": "#0073AB", // Line 3 Scarborough (decommissioned) - Blue
  "4": "#A12184", // Line 4 Sheppard - Purple
};

// Default colors per route type
const DEFAULT_TYPE_COLOR: Record<number, string> = {
  0: "#DA291C", // Streetcar - TTC red
  1: "#FFCB0C", // Subway fallback - yellow
  3: "#1F2937", // Bus - slate
};

export function getRouteColor(route: Route): string {
  // Subway: prefer per-line color
  if (route.routeType === 1) {
    const lineColor = SUBWAY_LINE_COLORS[route.routeShortName];
    if (lineColor) return lineColor;
  }

  // Use GTFS-provided color if present
  if (route.routeColor && route.routeColor.length === 6) {
    return `#${route.routeColor}`;
  }

  return DEFAULT_TYPE_COLOR[route.routeType] ?? "#6B7280";
}

export const ROUTE_TYPE_LABEL: Record<number, string> = {
  0: "Streetcar",
  1: "Subway",
  3: "Bus",
};

export const ROUTE_TYPE_GROUPS: { type: number; label: string }[] = [
  { type: 1, label: "Subway" },
  { type: 0, label: "Streetcar" },
  { type: 3, label: "Bus" },
];
