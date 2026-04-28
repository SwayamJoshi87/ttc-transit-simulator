import GtfsRealtimeBindings from "gtfs-realtime-bindings";

export const runtime = "nodejs";

const FEED_URL = "https://bustime.ttc.ca/gtfsrt/vehicles";

export interface VehiclePosition {
  vehicleId: string;
  routeId: string;
  lat: number;
  lon: number;
  bearing: number;
}

export async function GET() {
  const resp = await fetch(FEED_URL, {
    next: { revalidate: 15 },
    headers: { "User-Agent": "TTC-Transit-Simulator/1.0" },
  });

  if (!resp.ok) {
    return Response.json(
      { error: "Failed to fetch vehicle positions" },
      { status: 502 },
    );
  }

  const buffer = await resp.arrayBuffer();
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
    new Uint8Array(buffer),
  );

  const vehicles: VehiclePosition[] = feed.entity
    .filter((e) => e.vehicle?.position != null && e.vehicle?.trip?.routeId)
    .map((e) => ({
      vehicleId: e.vehicle!.vehicle?.id ?? "",
      routeId: e.vehicle!.trip!.routeId!,
      lat: e.vehicle!.position!.latitude,
      lon: e.vehicle!.position!.longitude,
      bearing: e.vehicle!.position!.bearing ?? 0,
    }));

  return Response.json(vehicles, {
    headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=30" },
  });
}
