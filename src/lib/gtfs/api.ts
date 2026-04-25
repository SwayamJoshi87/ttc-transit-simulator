import type { Route, RouteCacheEntry } from "@/store/routeStore";

interface RoutesResponse {
  routes: Route[];
}

interface RouteDetailsResponse {
  route: Route;
  routeId: string;
  trips: RouteCacheEntry["trips"];
  canonicalTrips: RouteCacheEntry["canonicalTrips"];
  stopsByTrip: RouteCacheEntry["stopsByTrip"];
  shapesByTrip: RouteCacheEntry["shapesByTrip"];
  stopTimesByTrip: RouteCacheEntry["stopTimesByTrip"];
  serviceCalendarById: RouteCacheEntry["serviceCalendarById"];
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${url}`);
  }
  return (await res.json()) as T;
}

export async function fetchRouteList() {
  const data = await fetchJson<RoutesResponse>("/api/gtfs/routes");
  return data.routes;
}

export async function fetchRouteDetails(
  routeId: string,
): Promise<RouteCacheEntry> {
  const data = await fetchJson<RouteDetailsResponse>(
    `/api/gtfs/routes/${encodeURIComponent(routeId)}`,
  );
  return {
    routeId: data.routeId,
    route: data.route,
    trips: data.trips,
    canonicalTrips: data.canonicalTrips,
    stopsByTrip: data.stopsByTrip,
    shapesByTrip: data.shapesByTrip,
    stopTimesByTrip: data.stopTimesByTrip,
    serviceCalendarById: data.serviceCalendarById,
  };
}
