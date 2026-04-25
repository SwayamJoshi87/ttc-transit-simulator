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
    page.tsx               # SidebarProvider > RouteSidebar + SidebarInset > Map + TimeControls
    layout.tsx             # ThemeProvider + GtfsProvider + TooltipProvider
  components/
    theme-provider.tsx     # next-themes wrapper (class strategy)
    theme-toggle.tsx       # Light/Dark/System dropdown in sidebar header
    map/
      TransitMap.tsx       # Leaflet map: tiles + RouteLayers + SimulationSprites
      MapWrapper.tsx       # dynamic() SSR-bypass wrapper for Leaflet
      RouteLayer.tsx       # One route's polylines (3 stacked = glow) + stop markers
      SimulationSprites.tsx# Per-trip animated markers based on stop_times + sim time
      TimeControls.tsx     # Bottom-of-map overlay: play/pause, slider, speed, day, sprites toggle
    sidebar/
      RouteSidebar.tsx     # Routes grouped Subway/Streetcar/Bus, search, pin button,
                           # active-routes chips, focused-route footer
  store/
    routeStore.ts          # Multi-route store: activeRoutes Map, focusedRouteId, pinnedRouteIds
    simulationStore.ts     # currentTimeSec, isPlaying, speed, serviceDay, showSprites
  lib/
    routeColors.ts         # getRouteColor() — per-line subway, GTFS color, type fallback
    simulation.ts          # getActiveTripsForRoute(), getSpritePosition() — pure
    gtfs/
      parser.ts            # loadGTFS(), getStopsForTrip(), getCanonicalTrips(), parseGtfsTime()
      GtfsProvider.tsx     # React context — loads GTFS once, exposes via useGtfs()
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
   - `calendar.txt` (required for the simulation's day-of-week filter)

## Key Architectural Decisions

- **Leaflet is SSR-incompatible**: always import `TransitMap` via `dynamic(..., { ssr: false })` in `MapWrapper.tsx`
- **GTFS data lives in `GtfsProvider` (React context)**, not in Zustand. The parsed Maps are huge (thousands of entries) and would tank reactive performance. Anything that reads stop_times, shapes, calendar, or the trip list calls `useGtfs()`. Only derived per-route slices (stops/shapes for the selected trip) live in `routeStore`.
- **Multi-route model**: `routeStore` tracks `activeRoutes: Map<routeId, ActiveRouteState>` plus `focusedRouteId` and `pinnedRouteIds`. Click = focus (replaces previous focus unless pinned). Pin button keeps a route in `activeRoutes` when focus moves elsewhere. The map renders every entry of `activeRoutes`; the sidebar footer/edit panel acts only on the focused route.
- **Glow effect = 3 stacked polylines** (outer halo, inner halo, sharp main line). Don't use SVG `filter: blur()` — it's slow with many routes.
- **Simulation time**: stored as seconds-since-midnight in `simulationStore.currentTimeSec`. GTFS times can exceed 24:00:00 for after-midnight trips — `parseGtfsTime()` handles that. The slider spans 04:00–28:00 (TTC service-day convention). When `isPlaying`, `TimeControls` advances time on rAF: `delta * speed`. Sprites read `currentTimeSec` and `serviceDay` to decide which trips are active and where they are.
- **Service day filtering**: `calendar.txt` maps `service_id → days_of_week`. `getActiveServiceIds(calendar, day)` returns which `service_id`s run on that day; trips not in that set are hidden from the simulation.
- **Nominatim rate limit**: 1 req/sec — debounce any geocoding calls; add `User-Agent: TTC-Transit-Simulator/1.0` to every Nominatim request (required by their ToS)
- **Route colors**: never read `route.routeColor` directly — always go through `getRouteColor(route)` from `src/lib/routeColors.ts`. It handles per-line subway colors (Line 1 yellow, Line 2 green, Line 4 purple), then falls back to GTFS `route_color`, then to per-type defaults (Streetcar red, Bus slate).
- **shadcn flavor uses `@base-ui/react`, not Radix**: APIs differ — e.g. base-ui Select's `onValueChange` is `(value: string | null) => void` (handle null), Collapsible exposes `data-open` (not `data-state="open"`), triggers accept a `render` prop instead of `asChild`.
- **Dark mode**: `next-themes` with `attribute="class"`. Tailwind v4 dark variant is wired via `@custom-variant dark (&:is(.dark *))` in `globals.css`. The map swaps to CartoDB Dark Matter tiles (light uses CartoDB Voyager) — the `<TileLayer>` has a `key` so it re-mounts on theme change.
- **react-leaflet `Polyline` color**: pass styling through `pathOptions={{ color, weight, opacity }}` rather than direct `color`/`weight` props. The direct props don't always propagate updates to the underlying Leaflet layer; `pathOptions` does. Add a `key` containing the color (or route ID) to force remount when the value changes — relying on prop diffing alone has caused stale visuals.
- **Canonical trip selection**: GTFS routes contain many trip variants (express, short-turn, late-night, test). Picking the *first* trip per direction surfaces these and produces broken visuals (e.g., Line 4 showing only 2 stops). Always reduce to the longest trip per `(directionId, tripHeadsign)` via `getCanonicalTrips()` in `src/lib/gtfs/parser.ts` before exposing trips to the UI.
- **CSV parsing**: GTFS CSV fields can contain commas inside quotes (e.g., `"Don Mills Stn, Bay 1"`). Always parse via `papaparse` (not naive `.split(",")`) — see `src/lib/gtfs/parser.ts`.

## Scope

- [x] Map centered on Toronto with theme-aware tiles
- [x] Sidebar (shadcn) with collapsible Subway/Streetcar/Bus groups + route search
- [x] Click route → renders shape + stops; pin to keep multiple routes visible
- [x] Direction selector (by trip headsign)
- [x] Stop list in sidebar
- [x] Dark/Light/System theme toggle
- [x] Per-line route colors (Line 1 yellow, Line 2 green, etc.)
- [x] Glow effect on routes (3 stacked polylines)
- [x] Multi-route display with focus + pin model
- [x] Time-of-day simulation: play/pause, slider, speed control, day-of-week selector
- [x] Animated vehicle sprites following stop_times schedules
- [ ] Edit mode: drag stops to new positions
- [ ] Edit mode: add/remove stops with reverse geocoding
- [ ] Export edited route as GTFS or GeoJSON

## Running

```bash
npm run dev    # http://localhost:3000
npm run build
npm run lint
```
