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
| Map | react-leaflet + OpenStreetMap |
| Database | PostgreSQL (Aiven) + Drizzle ORM |
| Transit data | TTC GTFS static feed |
| State | Zustand |
| UI | shadcn/ui + Tailwind CSS |

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
