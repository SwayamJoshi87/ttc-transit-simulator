# TTC Transit Simulator

A web app for viewing and simulating TTC (Toronto Transit Commission) transit routes on an interactive map. Select any route to see its shape, stops, and animated vehicle sprites following the real GTFS schedule.

## Features

- Interactive map of all TTC routes (Subway, Streetcar, Bus)
- Click a route to render its shape and stop list
- Pin multiple routes simultaneously
- Time-of-day simulation with play/pause, speed control, and day-of-week selector
- Animated vehicle sprites interpolated from real stop_times data
- Light / Dark / System theme

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Map | MapLibre GL JS + react-map-gl v8 |
| Database | PostgreSQL (Aiven) + Drizzle ORM |
| Transit data | TTC GTFS static feed |
| State | Zustand |
| UI | shadcn/ui + Tailwind CSS |

## Architecture

### Overview

The app is split into three logical layers: data fetching (server), state management (client), and rendering (map + sidebar).

```
Browser
  ├── RouteSidebar          — route list, search, pin/focus controls
  ├── MapWrapper            — dynamic() import (SSR bypass)
  │     └── TransitMap      — MapLibre GL JS map
  │           ├── RouteLayer (×N)        — polylines + stop circles per active route
  │           └── SimulationSprites      — all vehicle positions as one GeoJSON source
  └── TimeControls          — play/pause, slider, speed, day-of-week
```

### Data flow

**Route list** (`/api/gtfs/routes`) — fetched once on mount, stored in `routeStore.routeCache`. Powers the sidebar list.

**Per-route data** (`/api/gtfs/routes/[routeId]`) — fetched on first click for a route. Returns all trips, stop_times, shapes, and calendar in a single response. Cached in Zustand so the API is only hit once per route per session.

**GTFS data in React context** — `GtfsProvider` (wrapping `layout.tsx`) holds the large parsed GTFS maps (stop_times, shapes, calendar). These are deliberately kept outside Zustand because their size would make Zustand's reactivity expensive. Components read them via `useGtfs()`.

### State stores (Zustand)

| Store | What it holds |
|---|---|
| `routeStore` | `activeRoutes` map, `focusedRouteId`, `pinnedRouteIds`, `routeCache` |
| `simulationStore` | `currentTimeSec`, `isPlaying`, `speed`, `serviceDay`, `showSprites` |

**Focus vs pin model**: clicking a route sets it as focused (replaces the previous focus). Pinning a route keeps it in `activeRoutes` even when focus moves elsewhere. The map renders everything in `activeRoutes`; the sidebar acts only on the focused route.

### Map rendering (MapLibre GL JS)

All map content is rendered via WebGL through MapLibre GL JS, wrapped in `react-map-gl v8`.

**RouteLayer** — for each active route, three stacked `line` layers create the glow effect (outer halo → inner halo → sharp centerline) using `line-blur` and `line-width` paint properties. Stops are a `circle` layer on a GeoJSON source.

**SimulationSprites** — all active vehicle positions are combined into a single GeoJSON `FeatureCollection` and set on one MapLibre source. On each animation frame, the source data is updated and MapLibre redraws in one GPU call. Route color is stored as a feature property and read via a data-driven `circle-color` expression.

**Theme-aware tiles** — the map uses CartoDB Voyager (light) or CartoDB Dark Matter (dark) vector tile style URLs. The style URL is passed as the `mapStyle` prop and swaps when the theme changes.

### Simulation

Simulation time is stored as **seconds since midnight** in `simulationStore.currentTimeSec`. The slider spans 04:00–28:00 (TTC's service day convention — trips past midnight use times like 25:30:00). When playing, `TimeControls` advances time on `requestAnimationFrame`: `Δt × speed`.

On each frame, `getActiveTripsForRoute()` filters trips to those whose `service_id` runs on the selected day (`calendar` lookup) and whose departure/arrival window covers the current time. `getSpritePosition()` linearly interpolates the vehicle's coordinates between its previous and next stops.

### API routes

| Route | Purpose |
|---|---|
| `GET /api/gtfs/routes` | Full route list (id, name, type, color) |
| `GET /api/gtfs/routes/[routeId]` | All trips, stop_times, shapes, calendar for one route |
| `POST /api/feedback` | User feedback submission |

### Database

PostgreSQL (Aiven) accessed via Drizzle ORM. Tables mirror the GTFS spec: `routes`, `trips`, `stops`, `stop_times`, `shapes`, `calendar`. Indices on `stop_times(trip_id)`, `trips(route_id)`, and `shapes(shape_id)` are required — without them the `inArray` queries full-scan tables with 500k–800k rows.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env.local` in the project root:

```
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
```

### 3. Seed the database

Download the TTC GTFS feed from the [TTC Open Data portal](https://open.toronto.ca/dataset/ttc-routes-and-schedules/), extract the zip, and import the CSV files into the tables defined in `src/lib/gtfs/schema.ts`.

Then apply migrations:

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

> If `drizzle-kit migrate` hangs on large tables over a remote connection, see the workaround in [CLAUDE.md](CLAUDE.md#database-migrations).

### 4. Run

```bash
npm run dev    # http://localhost:3000
npm run build
npm run lint
```
