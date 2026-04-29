@AGENTS.md

# TTC Transit Simulator

A web app for viewing and editing TTC (Toronto Transit Commission) transit routes on an interactive map.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | SSR, file routing, server components |
| Map | MapLibre GL JS + react-map-gl v8 | WebGL rendering, no API key, open source |
| Geocoding | Nominatim (OSM) | Free reverse/forward geocoding, Toronto bbox |
| Transit data | TTC GTFS static feed + GTFS-RT | Static: routes, stops, shapes, trips; RT: live vehicle positions |
| Database | PostgreSQL (Aiven) + Drizzle ORM | Stores GTFS data; queried server-side via API routes |
| State | Zustand (`src/store/routeStore.ts`) | Lightweight, client-only route editing state |
| UI | shadcn/ui + Tailwind CSS | Accessible components, fast iteration |
| Language | TypeScript | Throughout |

## Project Structure

```
src/
  app/
    page.tsx               # SidebarProvider > RouteSidebar + SidebarInset > Map + TimeControls
    layout.tsx             # ThemeProvider + GtfsProvider + TooltipProvider
    api/
      gtfs/
        routes/
          route.ts         # GET /api/gtfs/routes — full route list from DB (24h edge cache)
          [routeId]/
            route.ts       # GET /api/gtfs/routes/:id — canonical trips, stops, shapes (24h edge cache)
        vehicles/
          route.ts         # GET /api/gtfs/vehicles — live positions via TTC GTFS-RT (15s cache)
      feedback/
        route.ts           # POST /api/feedback
  components/
    theme-provider.tsx     # next-themes wrapper (class strategy)
    theme-toggle.tsx       # Light/Dark/System dropdown in sidebar header
    map/
      TransitMap.tsx       # MapLibre Map: mapStyle + RouteLayers (Sources/Layers) + SimulationSprites
      MapWrapper.tsx       # dynamic() SSR-bypass wrapper (MapLibre is browser-only)
      RouteLayer.tsx       # One route's polylines (3 stacked = glow) + stop markers
      SimulationSprites.tsx# LiveVehicles: polls GTFS-RT every 15s; SimulationSprites: stop_times interpolation
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
      db.ts                # Drizzle client — lazy pg Pool, exports `db`
      schema.ts            # Drizzle table definitions + indices
      connection.ts        # Parses DATABASE_URL, strips sslmode for pg driver
    geocoding.ts           # reverseGeocode(), forwardGeocode() via Nominatim
```

## GTFS Data Setup (Required)

GTFS data is stored in a PostgreSQL database (Aiven) and served via API routes — the app no longer reads flat files at runtime.

Set `DATABASE_URL` in `.env.local`:
```
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
```

To seed the database, download the TTC GTFS feed:
1. Go to the TTC Open Data portal: https://open.toronto.ca/dataset/ttc-routes-and-schedules/
2. Download the GTFS zip and extract it
3. Run `npm run db:seed` to import all CSV files into the DB
4. Run `npm run db:mark-canonical` to pre-compute `is_canonical` + `stop_count` on the `trips` table (one-time, required after every GTFS re-seed)

### Database migrations

```bash
npx drizzle-kit generate   # generates SQL in ./drizzle/
npx drizzle-kit migrate    # applies pending migrations
```

**Note**: `drizzle-kit migrate` may hang when creating indices on large tables (e.g. `stop_times` with ~800k rows) over a remote connection. If it hangs, run the `CREATE INDEX` statements directly:
```bash
node -e "
const { Pool } = require('pg');
const url = require('fs').readFileSync('.env.local','utf8').match(/DATABASE_URL=(.+)/)[1].trim();
const parsed = new URL(url); parsed.searchParams.delete('sslmode');
const pool = new Pool({ connectionString: parsed.toString(), ssl: { rejectUnauthorized: false }, statement_timeout: 300000 });
const idxs = [
  'CREATE INDEX IF NOT EXISTS trips_route_id_idx ON trips(route_id)',
  'CREATE INDEX IF NOT EXISTS stop_times_trip_id_idx ON stop_times(trip_id)',
  'CREATE INDEX IF NOT EXISTS shapes_shape_id_idx ON shapes(shape_id)',
];
(async () => { for (const q of idxs) { process.stdout.write(q + ' ... '); await pool.query(q); console.log('done'); } await pool.end(); })();
"
```

## Key Architectural Decisions

- **MapLibre GL JS is SSR-incompatible**: always import `TransitMap` via `dynamic(..., { ssr: false })` in `MapWrapper.tsx`
- **GTFS data lives in `GtfsProvider` (React context)**, not in Zustand. The parsed Maps are huge (thousands of entries) and would tank reactive performance. Anything that reads stop_times, shapes, calendar, or the trip list calls `useGtfs()`. Only derived per-route slices (stops/shapes for the selected trip) live in `routeStore`.
- **Multi-route model**: `routeStore` tracks `activeRoutes: Map<routeId, ActiveRouteState>` plus `focusedRouteId` and `pinnedRouteIds`. Click = focus (replaces previous focus unless pinned). Pin button keeps a route in `activeRoutes` when focus moves elsewhere. The map renders every entry of `activeRoutes`; the sidebar footer/edit panel acts only on the focused route.
- **Glow effect = 3 stacked MapLibre `line` layers** (outer halo, inner halo, sharp main line) using `line-blur` and `line-width` paint properties. Don't use SVG `filter: blur()` — it's slow with many routes.
- **Simulation time**: stored as seconds-since-midnight in `simulationStore.currentTimeSec`. GTFS times can exceed 24:00:00 for after-midnight trips — `parseGtfsTime()` handles that. The slider spans 04:00–28:00 (TTC service-day convention). When `isPlaying`, `TimeControls` advances time on rAF: `delta * speed`. Sprites read `currentTimeSec` and `serviceDay` to decide which trips are active and where they are.
- **Service day filtering**: `calendar.txt` maps `service_id → days_of_week`. `getActiveServiceIds(calendar, day)` returns which `service_id`s run on that day; trips not in that set are hidden from the simulation.
- **Nominatim rate limit**: 1 req/sec — debounce any geocoding calls; add `User-Agent: TTC-Transit-Simulator/1.0` to every Nominatim request (required by their ToS)
- **Route colors**: never read `route.routeColor` directly — always go through `getRouteColor(route)` from `src/lib/routeColors.ts`. It handles per-line subway colors (Line 1 yellow, Line 2 green, Line 4 purple), then falls back to GTFS `route_color`, then to per-type defaults (Streetcar red, Bus slate).
- **shadcn flavor uses `@base-ui/react`, not Radix**: APIs differ — e.g. base-ui Select's `onValueChange` is `(value: string | null) => void` (handle null), Collapsible exposes `data-open` (not `data-state="open"`), triggers accept a `render` prop instead of `asChild`.
- **Dark mode**: `next-themes` with `attribute="class"`. Tailwind v4 dark variant is wired via `@custom-variant dark (&:is(.dark *))` in `globals.css`. The map swaps to CartoDB Dark Matter vector style URL (light uses CartoDB Voyager) — the `<Map>` component receives `mapStyle` as a prop and re-renders when it changes.
- **Canonical trip pre-computation**: GTFS routes contain many trip variants (express, short-turn, late-night, test). The canonical trip per `(directionId, tripHeadsign)` is the one with the most stops. This is pre-computed once by `scripts/mark-canonical-trips.ts` which sets `is_canonical = true` and `stop_count` on the `trips` table. The route API filters `WHERE is_canonical = true` — no runtime COUNT over `stop_times` needed. Run `npm run db:mark-canonical` after every GTFS re-seed.
- **CSV parsing**: GTFS CSV fields can contain commas inside quotes (e.g., `"Don Mills Stn, Bay 1"`). Always parse via `papaparse` (not naive `.split(",")`) — see `src/lib/gtfs/parser.ts`.
- **Database indices**: `stop_times(trip_id)`, `trips(route_id)`, `trips(route_id, is_canonical)`, and `shapes(shape_id)` all have indices. Without them the `inArray` queries full-scan tables with 500k–800k rows. Defined in `src/lib/gtfs/schema.ts`.
- **Route API data flow**: `GET /api/gtfs/routes/[routeId]` returns `RouteCacheEntry` (canonical trips + stops + shapes) in one request; stops and shapes are fetched in parallel via `Promise.all`. `RouteSidebar` fetches on first route click and caches in Zustand. Both route API routes set `revalidate = 86400` (24h edge cache) since GTFS updates ~every 6 weeks.
- **Live vehicles**: `GET /api/gtfs/vehicles` proxies TTC's official GTFS-RT feed at `https://gtfsrt.ttc.ca/vehicles/position`. The base URL is discovered from the Toronto Open Data CKAN package (`9ab4c9af-652f-4a84-abac-afcf40aae882`) on first request and cached for the process lifetime. Subway lines are absent from this feed — TTC does not publish subway GPS positions in GTFS-RT.

## Scope

### Done
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
- [x] Map rendering migrated from react-leaflet to MapLibre GL JS (WebGL, GPU draw calls)
- [x] PostgreSQL database backend with Drizzle ORM (replaced flat-file GTFS reads)
- [x] Per-route API (`/api/gtfs/routes/[routeId]`) serving trips, stop_times, shapes, calendar on demand
- [x] DB indices on `stop_times(trip_id)`, `trips(route_id)`, `shapes(shape_id)` for fast route loads
- [x] Live vehicle positions from TTC GTFS-RT feed (buses + streetcars, 15s poll)
- [x] GTFS-RT feed URL discovered from Toronto Open Data CKAN API (resilient to URL changes)
- [x] Canonical trip pre-computation (`is_canonical` + `stop_count` on `trips` table) — eliminates runtime COUNT over stop_times
- [x] 24h edge cache on route list and per-route detail API routes
- [x] Stops and shapes fetched in parallel on route load

### To Do
- [ ] Edit mode: drag stops to new positions
- [ ] Edit mode: add/remove stops with reverse geocoding
- [ ] Export edited route as GTFS or GeoJSON

## Running

```bash
npm run dev    # http://localhost:3000
npm run build
npm run lint
```

Requires `DATABASE_URL` in `.env.local` — see GTFS Data Setup above.

-----

## Phase 2: Transit Accessibility Analysis Platform

The project is evolving from a GTFS visualizer into a **transit accessibility analysis tool** — a platform where users can edit transit routes/stops, save those edits as named scenarios, and run accessibility calculations to see how changes affect what populations can reach by transit.

The north star is: *"A user edits a bus route, adds a stop, and immediately sees a choropleth of how many more people can reach downtown in 45 minutes."*

-----

## Map Library: MapLibre GL JS (migrated from Leaflet)

### Why we are leaving Leaflet

Leaflet is DOM/Canvas-based. Every polyline, marker, and polygon is an individual DOM element. This worked fine for the initial route viewer, but Phase 2 adds:

- Accessibility choropleths (thousands of dissemination block polygons, updated on every scenario change)
- Isochrone GeoJSON polygons from R5
- Animated vehicle sprites across all active routes simultaneously
- Potentially deck.gl arc/hex layers for population and flow visualization

At that data volume, Leaflet's per-element rendering model becomes a bottleneck. Updating a choropleth means touching thousands of DOM nodes. MapLibre renders everything as a single GPU draw call via WebGL.

### Why MapLibre GL JS specifically

- **WebGL rendering** — hardware-accelerated, handles tens of thousands of features with no perceptible frame drop
- **Data-driven styling** — color every dissemination block by accessibility score using a single layer expression; updating scores means swapping a GeoJSON source, not re-rendering React components
- **Fully free and open source** — MIT license, no API key required for rendering, compatible with the same OpenStreetMap tile sources already in use
- **Pitch and rotation** — tilt the map for 3D building extrusion context, useful for visualizing accessibility in dense urban areas
- **deck.gl compatibility** — deck.gl layers (H3 hexagons, arc flows, column layers) mount directly on MapLibre's WebGL context for GPU-accelerated analysis visualizations
- **react-map-gl wrapper** — provides a React component API; migration from react-leaflet is real work but follows a clear pattern (sources + layers replace component trees)

### Migration approach

Do the MapLibre migration **before** building the analysis UI layers, not after. The choropleth and isochrone layers are the primary reason to migrate and are dramatically simpler to build in MapLibre. Building them in Leaflet first would mean doing the work twice.

Migration pattern:

- `MapWrapper.tsx` / `TransitMap.tsx` → replace react-leaflet `MapContainer` with react-map-gl `Map` (MapLibre flavor)
- `RouteLayer.tsx` → replace `Polyline` components with MapLibre `Source` + `Layer` (type `line`). The 3-polyline glow trick becomes a `line-blur` + `line-width` paint expression — cleaner
- `SimulationSprites.tsx` → replace per-marker `setLatLng` with a GeoJSON `Source` that updates on rAF; MapLibre handles GPU animation
- Stop markers → `circle` layer or `symbol` layer on a GeoJSON source, not individual marker components
- Keep the `dynamic(..., { ssr: false })` SSR bypass — MapLibre is also browser-only

### New layers to add (MapLibre + deck.gl)

|Layer                    |Library                 |Purpose                                        |
|-------------------------|------------------------|-----------------------------------------------|
|Route polylines          |MapLibre `line`         |Existing routes, glow via paint expressions    |
|Stop markers             |MapLibre `circle`       |Existing stops                                 |
|Isochrone polygons       |MapLibre `fill`         |R5 output, travel-time contours                |
|Block choropleth         |MapLibre `fill`         |Accessibility scores per dissemination block   |
|Accessibility hex columns|deck.gl `H3HexagonLayer`|3D columns, height = accessibility score       |
|Population density       |deck.gl `H3HexagonLayer`|3D columns, height = population count          |
|Transit flow arcs        |deck.gl `ArcLayer`      |Origin → destination flows                     |
|Vehicle sprites          |MapLibre GeoJSON source |Existing simulation, rewritten as source update|

-----

## Backend: R5 / r5py for Accessibility Analysis

### Why R5

The project goal is transit accessibility analysis: given a modified transit network, compute how many people can reach opportunities (jobs, hospitals, schools) within a travel-time cutoff, and show how that changes versus the baseline TTC network.

R5 (Rapid Realistic Routing) is the industry-standard open-source engine for this. It is what Conveyal Analysis is built on, and is used by transit agencies and planning researchers worldwide. Key capabilities relevant to this project:

- **Realistic departure-time modeling** — samples many departures across a time window (e.g. 7:00–9:00 AM) and returns percentile travel times, not a single optimistic trip. Captures real waiting and missed connections.
- **Many-to-many travel time matrices** — compute travel time from every origin cell to every destination in one pass. The basis for all accessibility scoring.
- **Cumulative opportunity accessibility** — "how many jobs reachable in 45 minutes" per origin. The standard transit equity metric.
- **Gravity-based accessibility** — opportunities weighted by distance using decay functions (logistic, exponential). More realistic than hard cutoffs.
- **Scenario modifications** — apply edits (add stop, reroute, change frequency) to a base network without regenerating the GTFS feed. Modifications are applied at analysis time.
- **GTFS ingestion** — R5 parses the GTFS zip directly into its routing graph. No additional ETL required beyond what already loads into Postgres for the UI.
- **Multi-feed support** — multiple GTFS feeds (TTC + GO Transit + MiWay) can be loaded into a single network.

### Why r5py (Python wrapper) over raw R5 (Java)

r5py wraps R5's Java engine in a Python interface, exposing `TransportNetwork`, `TravelTimeMatrixComputer`, and `DetailedItinerariesComputer` as clean Python objects. This lets the R5 service be written as a **FastAPI app** rather than a Java service, which:

- Is easier to develop and deploy alongside the Next.js app
- Integrates naturally with pandas/geopandas for population data and accessibility scoring
- Makes the H3 hexagon aggregation (bucketing scores into Uber's hex grid for visualization) a one-liner
- Is what most current academic and planning-tool projects use

### What R5 is NOT being used for here

R5 is a planning/analysis engine, not a live trip planner. It does not:

- Provide real-time GTFS-RT updates
- Generate turn-by-turn directions for a navigation app
- Replace the existing GTFS-in-Postgres setup for the map UI

The Postgres + Drizzle setup for route rendering, stop lists, and sprite animation is unchanged. R5 has its own in-memory copy of the network for analysis only.

### Why NOT just OSRM or Valhalla

OSRM and Valhalla do street routing (A→B path on a road network). They cannot compute transit travel times, model waiting for buses, or produce accessibility matrices across a population grid. They would be appropriate only for snapping a dragged stop to the nearest street — a much simpler problem. Since R5 also exposes the street network for this purpose, adding OSRM would be redundant.

### Architecture: R5 as a sidecar service

R5 / r5py runs as a **separate Python/FastAPI service** alongside the Next.js app. The browser never touches R5 directly. All R5 calls go through Next.js API routes that proxy to the FastAPI service.

```
Browser (MapLibre map)
  → POST /api/analysis/isochrone { scenario_id, origin, cutoffs }
  → Next.js API route (auth, validation, thin proxy)
  → FastAPI r5py service (network build, routing, accessibility math)
  → returns GeoJSON / accessibility JSON
  → Next.js passes through to browser
  → Browser updates MapLibre source → layer re-renders
```

The R5 FastAPI service is stateful: it holds the base `TransportNetwork` in memory after startup (~30s–2min build for Toronto). Subsequent analysis requests reuse the in-memory network. Network is only rebuilt when the base TTC GTFS feed updates (quarterly).

### R5 service structure

```
services/
  r5/
    app/
      main.py          # FastAPI: /isochrone, /travel-time-matrix, /accessibility, /network/build
      networks.py      # In-memory TransportNetwork cache keyed by scenario_id
      scenarios.py     # Load scenario edits from Postgres, build R5 modification list
      population.py    # Load Statistics Canada 2021 dissemination block data for Toronto
    data/
      osm/toronto.osm.pbf        # Clipped to GTA bbox (-80.0,43.4,-78.9,44.1)
      gtfs/ttc-base.zip          # Base TTC GTFS feed
      pop/toronto-blocks.gpkg    # StatCan 2021 dissemination blocks with population
    Dockerfile         # python:3.11-slim + r5py + JVM (r5py ships the JVM jar)
```

### Scenario / edit data model

Edits are stored in Postgres as R5 modification JSON, not as mutated GTFS files. The base GTFS feed is never modified. When analysis is requested, edits are replayed on top of the base network at R5 analysis time.

```sql
-- New tables alongside existing GTFS tables

CREATE TABLE scenarios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE scenario_edits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE,
  sequence    INTEGER NOT NULL,           -- replay order
  edit_type   TEXT NOT NULL,              -- 'reroute' | 'add-trips' | 'remove-stops' | 'adjust-frequency' | 'adjust-speed'
  route_id    TEXT,                       -- TTC route_id this edit targets
  payload     JSONB NOT NULL,             -- full R5 modification JSON
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE analysis_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID REFERENCES scenarios(id),
  run_type    TEXT NOT NULL,              -- 'isochrone' | 'travel-time-matrix' | 'accessibility'
  params      JSONB NOT NULL,             -- departure time window, cutoffs, modes, opportunity field
  result_path TEXT,                       -- path to stored result (GeoJSON / Parquet)
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

An "add stop" edit on route 506 is stored as:

```json
{
  "type": "reroute",
  "route": "TTC:506",
  "fromStop": "STOP_1234",
  "toStop": "STOP_1235",
  "stops": [
    { "id": "user_new_1", "lat": 43.661, "lon": -79.389 }
  ],
  "dwellTime": 15
}
```

### Population data

Statistics Canada 2021 Census dissemination blocks are used as both origins (where people are) and opportunity data (employment by block). The `population.py` module loads these as a geopandas GeoDataFrame. r5py's `TravelTimeMatrixComputer` accepts origins and destinations as GeoDataFrames directly.

For employment/opportunity data: City of Toronto Open Data has employment by ward. StatCan has place-of-work flows at the dissemination area level.

### Key R5 OSM note

Clip the OSM PBF to the GTA bounding box before handing to R5:

```bash
osmium extract --bbox=-80.0,43.4,-78.9,44.1 ontario-latest.osm.pbf -o toronto-gta.osm.pbf
```

Full Ontario PBF works but wastes RAM and extends network build time. Clipped GTA PBF is ~150MB and builds in under a minute.

### Streetcar / subway edit constraints

R5's `reroute` modification for rail modes is constrained to the rail network present in the OSM data. Toronto's OSM streetcar track coverage is adequate but imperfect; subway tunnels are poorly mapped. For rail route edits, restrict the UI to **stop position adjustment along the existing GTFS shape** rather than free rerouting. Free rerouting via R5 is appropriate for bus routes only, where the OSM street network is complete.

-----

## Summary of what is NOT changing

- Postgres + Drizzle ORM for GTFS data (route list, shapes, stop_times for sprite animation)
- Zustand stores (`routeStore`, `simulationStore`) — structure unchanged, sprite/route logic unchanged
- `GtfsProvider` React context — unchanged
- The focus/pin multi-route model — unchanged
- shadcn/ui + Tailwind — unchanged
- Next.js App Router — unchanged
- The simulation (sprites following stop_times) — logic unchanged, rendering moves from per-marker to MapLibre GeoJSON source
- SSR bypass via `dynamic(..., { ssr: false })` — still required, MapLibre is also browser-only
