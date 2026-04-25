@AGENTS.md

# TTC Transit Simulator

A web app for viewing and editing TTC (Toronto Transit Commission) transit routes on an interactive map.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | SSR, file routing, server components |
| Map | react-leaflet + OpenStreetMap | Free, no API key, sufficient for MVP |
| Geocoding | Nominatim (OSM) | Free reverse/forward geocoding, Toronto bbox |
| Transit data | TTC GTFS static feed | Official TTC data: routes, stops, shapes, trips |
| State | Zustand (`src/store/routeStore.ts`) | Lightweight, client-only route editing state |
| UI | shadcn/ui + Tailwind CSS | Accessible components, fast iteration |
| Language | TypeScript | Throughout |

## Project Structure

```
src/
  app/
    page.tsx               # Root page: SidebarProvider > RouteSidebar + SidebarInset > Map
    layout.tsx             # Root layout: ThemeProvider + TooltipProvider
  components/
    theme-provider.tsx     # next-themes wrapper (class strategy)
    theme-toggle.tsx       # Light/Dark/System dropdown in sidebar header
    map/
      TransitMap.tsx       # Leaflet map (client). Swaps tile layer based on theme.
      MapWrapper.tsx       # dynamic() wrapper to bypass SSR for Leaflet
    sidebar/
      RouteSidebar.tsx     # shadcn Sidebar with collapsible Subway/Streetcar/Bus groups,
                           # search input, direction selector, stop list
  store/
    routeStore.ts          # Zustand store: routes, selected route/trip, stops, shapes
  lib/
    routeColors.ts         # getRouteColor() — handles per-line subway colors,
                           # GTFS route_color, and per-type fallbacks
    gtfs/
      parser.ts            # loadGTFS(), getStopsForTrip(), getShapesForTrip()
    geocoding.ts           # reverseGeocode(), forwardGeocode() via Nominatim
```

## GTFS Data Setup (Required)

The app reads TTC GTFS files from `public/gtfs/`. Download the static GTFS feed:

1. Go to the TTC Open Data portal: https://open.toronto.ca/dataset/ttc-routes-and-schedules/
2. Download the GTFS zip
3. Extract into `public/gtfs/` — needed files:
   - `routes.txt`
   - `trips.txt`
   - `stops.txt`
   - `stop_times.txt`
   - `shapes.txt`

## Key Architectural Decisions

- **Leaflet is SSR-incompatible**: always import `TransitMap` via `dynamic(..., { ssr: false })` in `MapWrapper.tsx`
- **GTFS data is held in a React ref** inside `RouteSidebar` (not Zustand) because the raw parsed data is too large for reactive state — only the derived UI-visible slices (stops, shapes for selected trip) live in Zustand
- **Nominatim rate limit**: 1 req/sec — debounce any geocoding calls; add `User-Agent: TTC-Transit-Simulator/1.0` to every Nominatim request (required by their ToS)
- **Route colors**: never read `route.routeColor` directly — always go through `getRouteColor(route)` from `src/lib/routeColors.ts`. It handles per-line subway colors (Line 1 yellow, Line 2 green, Line 4 purple), then falls back to GTFS `route_color`, then to per-type defaults (Streetcar red, Bus slate).
- **shadcn flavor uses `@base-ui/react`, not Radix**: APIs differ — e.g. base-ui Select's `onValueChange` is `(value: string | null) => void` (handle null), Collapsible exposes `data-open` (not `data-state="open"`), triggers accept a `render` prop instead of `asChild`.
- **Dark mode**: `next-themes` with `attribute="class"`. Tailwind v4 dark variant is wired via `@custom-variant dark (&:is(.dark *))` in `globals.css`. The map swaps to CartoDB Dark Matter tiles (light uses CartoDB Voyager) — the `<TileLayer>` has a `key` so it re-mounts on theme change.
- **react-leaflet `Polyline` color**: pass styling through `pathOptions={{ color, weight, opacity }}` rather than direct `color`/`weight` props. The direct props don't always propagate updates to the underlying Leaflet layer; `pathOptions` does. Add a `key` containing the color (or route ID) to force remount when the value changes — relying on prop diffing alone has caused stale visuals.
- **Canonical trip selection**: GTFS routes contain many trip variants (express, short-turn, late-night, test). Picking the *first* trip per direction surfaces these and produces broken visuals (e.g., Line 4 showing only 2 stops). Always reduce to the longest trip per `(directionId, tripHeadsign)` via `getCanonicalTrips()` in `src/lib/gtfs/parser.ts` before exposing trips to the UI.
- **CSV parsing**: GTFS CSV fields can contain commas inside quotes (e.g., `"Don Mills Stn, Bay 1"`). Always parse via `papaparse` (not naive `.split(",")`) — see `src/lib/gtfs/parser.ts`.

## MVP Scope

- [x] Map centered on Toronto with theme-aware tiles
- [x] Sidebar (shadcn) with collapsible Subway/Streetcar/Bus groups + route search
- [x] Click route → auto-selects first trip, renders shape + stops on map
- [x] Direction selector (by trip headsign)
- [x] Stop list in sidebar
- [x] Dark/Light/System theme toggle
- [x] Per-line route colors (Line 1 yellow, Line 2 green, etc.)
- [ ] Edit mode: drag stops to new positions
- [ ] Edit mode: add/remove stops with reverse geocoding
- [ ] Export edited route as GTFS or GeoJSON

## Running

```bash
npm run dev    # http://localhost:3000
npm run build
npm run lint
```
