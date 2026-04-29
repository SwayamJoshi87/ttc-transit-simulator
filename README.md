# TTC Transit Simulator

A web app for viewing and simulating TTC (Toronto Transit Commission) transit routes on an interactive map. Select any route to see its shape, stops, and live vehicle positions.

## Features

- Interactive map of all TTC routes (Subway, Streetcar, Bus)
- Click a route to render its shape and stop list
- Pin multiple routes simultaneously
- Live vehicle positions for buses and streetcars, polled from TTC's official GTFS-RT feed every 15 seconds
- Time-of-day simulation with play/pause, speed control, and day-of-week selector
- Animated vehicle sprites interpolated from real stop_times data
- Light / Dark / System theme

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Map | MapLibre GL JS + react-map-gl v8 |
| Database | PostgreSQL (Aiven) + Drizzle ORM |
| Transit data | TTC GTFS static feed + GTFS-RT live feed |
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
  │           ├── RouteLayer (×N)   — polylines + stop circles per active route
  │           └── LiveVehicles      — real-time vehicle dots (buses + streetcars)
  └── TimeControls          — play/pause, slider, speed, day-of-week
```

### Data flow

**Route list** (`/api/gtfs/routes`) — fetched once on mount, cached at the edge for 24 hours. Powers the sidebar list.

**Per-route data** (`/api/gtfs/routes/[routeId]`) — fetched on first click for a route. Returns canonical trips, stops, and shapes in a single response. Cached at the edge for 24 hours and in Zustand client-side so the API is only hit once per route per session.

**Live vehicles** (`/api/gtfs/vehicles`) — proxies TTC's official GTFS-RT feed, discovered via the Toronto Open Data CKAN API. Polled every 15 seconds. Subway lines are not included because TTC does not publish subway GPS positions in GTFS-RT.

### Canonical trip pre-computation

GTFS routes contain many trip variants (express, short-turn, late-night). The canonical trip per `(direction_id, trip_headsign)` group is the one with the most stops. Rather than computing this at request time by counting `stop_times` rows, the `is_canonical` flag and `stop_count` are pre-computed once via `npm run db:mark-canonical` and stored on the `trips` table. Route API responses simply filter `WHERE is_canonical = true`.

### State stores (Zustand)

| Store | What it holds |
|---|---|
| `routeStore` | `activeRoutes` map, `focusedRouteId`, `pinnedRouteIds`, `routeCache` |
| `simulationStore` | `currentTimeSec`, `isPlaying`, `speed`, `serviceDay`, `showVehicles` |

**Focus vs pin model**: clicking a route sets it as focused (replaces the previous focus). Pinning a route keeps it in `activeRoutes` even when focus moves elsewhere. The map renders everything in `activeRoutes`; the sidebar acts only on the focused route.

### Map rendering (MapLibre GL JS)

All map content is rendered via WebGL through MapLibre GL JS, wrapped in `react-map-gl v8`.

**RouteLayer** — for each active route, three stacked `line` layers create the glow effect (outer halo → inner halo → sharp centerline) using `line-blur` and `line-width` paint properties. Stops are a `circle` layer on a GeoJSON source.

**LiveVehicles** — all active vehicle positions are combined into a single GeoJSON `FeatureCollection` on one MapLibre source. Filtered client-side to only show vehicles for currently active routes.

**Theme-aware tiles** — the map uses CartoDB Voyager (light) or CartoDB Dark Matter (dark) vector tile style URLs.

### Simulation

Simulation time is stored as **seconds since midnight** in `simulationStore.currentTimeSec`. The slider spans 04:00–28:00 (TTC's service day convention). When playing, `TimeControls` advances time on `requestAnimationFrame`: `Δt × speed`. `getSpritePosition()` linearly interpolates vehicle coordinates between stops.

### API routes

| Route | Purpose | Cache |
|---|---|---|
| `GET /api/gtfs/routes` | Full route list (id, name, type, color) | 24h edge cache |
| `GET /api/gtfs/routes/[routeId]` | Canonical trips, stops, shapes for one route | 24h edge cache |
| `GET /api/gtfs/vehicles` | Live vehicle positions from TTC GTFS-RT | 15s |
| `POST /api/feedback` | User feedback submission | — |

### Database

PostgreSQL (Aiven) accessed via Drizzle ORM. Tables mirror the GTFS spec: `routes`, `trips`, `stops`, `stop_times`, `shapes`, `calendar`. Key indices:

| Index | Purpose |
|---|---|
| `stop_times(trip_id)` | Fast stop lookup per trip |
| `trips(route_id)` | Fast trip lookup per route |
| `trips(route_id, is_canonical)` | Fast canonical trip filter |
| `shapes(shape_id)` | Fast shape point lookup |

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

Download the TTC GTFS feed from the [TTC Open Data portal](https://open.toronto.ca/dataset/ttc-routes-and-schedules/), extract the zip, then:

```bash
npm run db:seed          # imports routes, trips, stops, stop_times, shapes, calendar
npm run db:mark-canonical  # pre-computes is_canonical + stop_count on trips table (run once after seeding)
```

### 4. Apply migrations

```bash
npx drizzle-kit generate
```

Then apply the generated SQL directly if `drizzle-kit migrate` hangs on large tables over a remote connection (see [CLAUDE.md](CLAUDE.md#database-migrations)).

### 5. Run

```bash
npm run dev    # http://localhost:3000
npm run build
npm run lint
```
