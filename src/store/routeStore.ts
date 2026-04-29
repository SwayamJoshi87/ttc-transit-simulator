import { create } from "zustand";

export interface Stop {
  stopId: string;
  stopName: string;
  lat: number;
  lon: number;
  sequence: number;
}

export interface Shape {
  lat: number;
  lon: number;
  sequence: number;
}

export interface Route {
  routeId: string;
  routeShortName: string;
  routeLongName: string;
  routeType: number;
  routeColor?: string;
  routeTextColor?: string;
}

export interface Trip {
  tripId: string;
  routeId: string;
  shapeId: string;
  tripHeadsign: string;
  directionId: number;
}

export interface RouteCacheEntry {
  routeId: string;
  route: Route;
  canonicalTrips: Trip[];
  stopsByTrip: Record<string, Stop[]>;
  shapesByTrip: Record<string, Shape[]>;
}

/**
 * State for one route currently shown on the map. The map renders one of these
 * for every entry in `activeRoutes`.
 */
export interface ActiveRouteState {
  routeId: string;
  tripId: string;
  trips: Trip[]; // canonical (longest) trips per direction for this route
  stops: Stop[]; // stops for the currently selected trip
  shapes: Shape[]; // shape points for the currently selected trip
}

export interface StopCameraTarget {
  routeId: string;
  stopId: string;
  sequence: number;
  lat: number;
  lon: number;
  requestId: number;
}

type StopOverride = Pick<Stop, "lat" | "lon">;

function getStopOverrideKey(stopId: string, sequence: number): string {
  return `${stopId}::${sequence}`;
}

function applyStopOverrides(
  stops: Stop[],
  overrides?: Map<string, StopOverride>,
) {
  if (!overrides || overrides.size === 0) return stops;
  return stops.map((stop) => {
    const override = overrides.get(
      getStopOverrideKey(stop.stopId, stop.sequence),
    );
    return override ? { ...stop, lat: override.lat, lon: override.lon } : stop;
  });
}

function stopsToShape(stops: Stop[]): Shape[] {
  return stops.map((stop) => ({
    lat: stop.lat,
    lon: stop.lon,
    sequence: stop.sequence,
  }));
}

interface RouteStore {
  routes: Route[];
  /**
   * Routes currently displayed on the map. A route is in here if it's either
   * focused or pinned. Removing focus from an unpinned route removes it.
   */
  activeRoutes: Map<string, ActiveRouteState>;
  /** The route the footer/edit panel acts on. Single-select. */
  focusedRouteId: string | null;
  /** Pinned routes stay on the map even when not focused. */
  pinnedRouteIds: Set<string>;
  /** Session-only stop position edits, keyed by route and stop. */
  stopOverrides: Map<string, Map<string, StopOverride>>;
  /** Per-route GTFS payload cache loaded on demand from API. */
  routeCache: Map<string, RouteCacheEntry>;
  stopCameraTarget: StopCameraTarget | null;
  isLoading: boolean;
  isStopEditMode: boolean;

  setRoutes: (routes: Route[]) => void;
  setRouteCache: (entry: RouteCacheEntry) => void;
  setLoading: (loading: boolean) => void;
  setStopEditMode: (enabled: boolean) => void;

  /** Add a route to active set with its data, focus it. Replaces previous focus if unpinned. */
  setActiveRoute: (state: ActiveRouteState) => void;
  /** Change focused route (must already be in activeRoutes). */
  setFocusedRoute: (routeId: string | null) => void;
  /** Update the selected trip for an already-active route. */
  setActiveTrip: (
    routeId: string,
    tripId: string,
    stops: Stop[],
    shapes: Shape[],
  ) => void;
  /** Update a single stop position for an active route. */
  updateStopPosition: (
    routeId: string,
    stopId: string,
    sequence: number,
    lat: number,
    lon: number,
  ) => void;
  focusStopOnMap: (
    routeId: string,
    stopId: string,
    sequence: number,
    lat: number,
    lon: number,
  ) => void;
  /** Toggle pinned state for a route. Unpinning + not focused removes from active. */
  togglePin: (routeId: string) => void;
  /** Remove a route from the active set entirely. */
  removeActiveRoute: (routeId: string) => void;
  /** Clear all currently active/pinned routes and session route edits. */
  resetAllRoutes: () => void;
}

export const useRouteStore = create<RouteStore>((set) => ({
  routes: [],
  activeRoutes: new Map(),
  focusedRouteId: null,
  pinnedRouteIds: new Set(),
  stopOverrides: new Map(),
  routeCache: new Map(),
  stopCameraTarget: null,
  isLoading: false,
  isStopEditMode: false,

  setRoutes: (routes) => set({ routes }),
  setRouteCache: (entry) =>
    set((s) => {
      const routeCache = new Map(s.routeCache);
      routeCache.set(entry.routeId, entry);
      return { routeCache };
    }),
  setLoading: (isLoading) => set({ isLoading }),
  setStopEditMode: (isStopEditMode) => set({ isStopEditMode }),

  setActiveRoute: (newState) =>
    set((s) => {
      const overrides = s.stopOverrides.get(newState.routeId);
      const stops = applyStopOverrides(newState.stops, overrides);
      const shapes = overrides ? stopsToShape(stops) : newState.shapes;
      const next = new Map(s.activeRoutes);
      // If the previously focused route was unpinned, remove it.
      if (
        s.focusedRouteId &&
        s.focusedRouteId !== newState.routeId &&
        !s.pinnedRouteIds.has(s.focusedRouteId)
      ) {
        next.delete(s.focusedRouteId);
      }
      next.set(newState.routeId, { ...newState, stops, shapes });
      return { activeRoutes: next, focusedRouteId: newState.routeId };
    }),

  setFocusedRoute: (routeId) =>
    set((s) => {
      // Drop previous focus if it was unpinned and exists in active set.
      const next = new Map(s.activeRoutes);
      if (
        s.focusedRouteId &&
        s.focusedRouteId !== routeId &&
        !s.pinnedRouteIds.has(s.focusedRouteId)
      ) {
        next.delete(s.focusedRouteId);
      }
      return { activeRoutes: next, focusedRouteId: routeId };
    }),

  setActiveTrip: (routeId, tripId, stops, shapes) =>
    set((s) => {
      const next = new Map(s.activeRoutes);
      const existing = next.get(routeId);
      if (!existing) return s;
      const overrides = s.stopOverrides.get(routeId);
      const nextStops = applyStopOverrides(stops, overrides);
      next.set(routeId, {
        ...existing,
        tripId,
        stops: nextStops,
        shapes: overrides ? stopsToShape(nextStops) : shapes,
      });
      return { activeRoutes: next };
    }),

  updateStopPosition: (routeId, stopId, sequence, lat, lon) =>
    set((s) => {
      const existing = s.activeRoutes.get(routeId);
      if (!existing) return s;

      const routeOverrides = new Map(s.stopOverrides.get(routeId) ?? []);
      routeOverrides.set(getStopOverrideKey(stopId, sequence), { lat, lon });

      const stopOverrides = new Map(s.stopOverrides);
      stopOverrides.set(routeId, routeOverrides);

      const nextStops = existing.stops.map((stop) =>
        stop.stopId === stopId && stop.sequence === sequence
          ? { ...stop, lat, lon }
          : stop,
      );

      const next = new Map(s.activeRoutes);
      next.set(routeId, {
        ...existing,
        stops: nextStops,
        shapes: stopsToShape(nextStops),
      });

      return { activeRoutes: next, stopOverrides };
    }),

  focusStopOnMap: (routeId, stopId, sequence, lat, lon) =>
    set((s) => ({
      stopCameraTarget: {
        routeId,
        stopId,
        sequence,
        lat,
        lon,
        requestId: (s.stopCameraTarget?.requestId ?? 0) + 1,
      },
    })),

  togglePin: (routeId) =>
    set((s) => {
      const pinned = new Set(s.pinnedRouteIds);
      const wasPinned = pinned.has(routeId);
      if (wasPinned) pinned.delete(routeId);
      else pinned.add(routeId);

      // If we just unpinned a route that isn't focused, remove from active.
      const active = new Map(s.activeRoutes);
      if (wasPinned && s.focusedRouteId !== routeId) {
        active.delete(routeId);
      }
      return { pinnedRouteIds: pinned, activeRoutes: active };
    }),

  removeActiveRoute: (routeId) =>
    set((s) => {
      const next = new Map(s.activeRoutes);
      next.delete(routeId);
      const pinned = new Set(s.pinnedRouteIds);
      pinned.delete(routeId);
      return {
        activeRoutes: next,
        pinnedRouteIds: pinned,
        focusedRouteId: s.focusedRouteId === routeId ? null : s.focusedRouteId,
      };
    }),

  resetAllRoutes: () =>
    set({
      activeRoutes: new Map(),
      focusedRouteId: null,
      pinnedRouteIds: new Set(),
      stopOverrides: new Map(),
      isStopEditMode: false,
    }),
}));
