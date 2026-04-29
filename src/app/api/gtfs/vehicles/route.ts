import GtfsRealtimeBindings from "gtfs-realtime-bindings";

export const runtime = "nodejs";

const CKAN_PACKAGE_ID = "9ab4c9af-652f-4a84-abac-afcf40aae882";
const CKAN_API = `https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=${CKAN_PACKAGE_ID}`;

export interface VehiclePosition {
  vehicleId: string;
  routeId: string;
  lat: number;
  lon: number;
  bearing: number;
}

// Resolved once per process lifetime from the CKAN package metadata.
let feedBaseUrl: string | null = null;

async function getFeedBaseUrl(): Promise<string> {
  if (feedBaseUrl) return feedBaseUrl;

  const resp = await fetch(CKAN_API, {
    headers: { "User-Agent": "TTC-Transit-Simulator/1.0" },
  });
  if (!resp.ok) throw new Error(`CKAN lookup failed: ${resp.status}`);

  const pkg = await resp.json();
  const resources: { url: string }[] = pkg?.result?.resources ?? [];
  const resource = resources[0];
  if (!resource?.url) throw new Error("No resource URL found in CKAN package");

  feedBaseUrl = resource.url.replace(/\/$/, "");
  return feedBaseUrl;
}

export async function GET() {
  let baseUrl: string;
  try {
    baseUrl = await getFeedBaseUrl();
  } catch {
    return Response.json(
      { error: "Failed to resolve GTFS-RT feed URL" },
      { status: 502 },
    );
  }

  const resp = await fetch(`${baseUrl}/vehicles/position?format=binary`, {
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
