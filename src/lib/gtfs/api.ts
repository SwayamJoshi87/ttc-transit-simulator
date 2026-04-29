import type { Route, RouteCacheEntry } from "@/store/routeStore";

interface RoutesResponse {
  routes: Route[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
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
  return fetchJson<RouteCacheEntry>(
    `/api/gtfs/routes/${encodeURIComponent(routeId)}`,
  );
}
