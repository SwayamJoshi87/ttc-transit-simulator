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
  serviceId: string;
}

/**
 * State for one route currently shown on the map. The map renders one of these
 * for every entry in `activeRoutes`.
 */
export interface ActiveRouteState {
  routeId: string;
  tripId: string;
  trips: Trip[];      // canonical (longest) trips per direction for this route
  stops: Stop[];      // stops for the currently selected trip
  shapes: Shape[];    // shape points for the currently selected trip
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
  isLoading: boolean;

  setRoutes: (routes: Route[]) => void;
  setLoading: (loading: boolean) => void;

  /** Add a route to active set with its data, focus it. Replaces previous focus if unpinned. */
  setActiveRoute: (state: ActiveRouteState) => void;
  /** Change focused route (must already be in activeRoutes). */
  setFocusedRoute: (routeId: string | null) => void;
  /** Update the selected trip for an already-active route. */
  setActiveTrip: (routeId: string, tripId: string, stops: Stop[], shapes: Shape[]) => void;
  /** Toggle pinned state for a route. Unpinning + not focused removes from active. */
  togglePin: (routeId: string) => void;
  /** Remove a route from the active set entirely. */
  removeActiveRoute: (routeId: string) => void;
}

export const useRouteStore = create<RouteStore>((set) => ({
  routes: [],
  activeRoutes: new Map(),
  focusedRouteId: null,
  pinnedRouteIds: new Set(),
  isLoading: false,

  setRoutes: (routes) => set({ routes }),
  setLoading: (isLoading) => set({ isLoading }),

  setActiveRoute: (newState) =>
    set((s) => {
      const next = new Map(s.activeRoutes);
      // If the previously focused route was unpinned, remove it.
      if (s.focusedRouteId && s.focusedRouteId !== newState.routeId && !s.pinnedRouteIds.has(s.focusedRouteId)) {
        next.delete(s.focusedRouteId);
      }
      next.set(newState.routeId, newState);
      return { activeRoutes: next, focusedRouteId: newState.routeId };
    }),

  setFocusedRoute: (routeId) =>
    set((s) => {
      // Drop previous focus if it was unpinned and exists in active set.
      const next = new Map(s.activeRoutes);
      if (s.focusedRouteId && s.focusedRouteId !== routeId && !s.pinnedRouteIds.has(s.focusedRouteId)) {
        next.delete(s.focusedRouteId);
      }
      return { activeRoutes: next, focusedRouteId: routeId };
    }),

  setActiveTrip: (routeId, tripId, stops, shapes) =>
    set((s) => {
      const next = new Map(s.activeRoutes);
      const existing = next.get(routeId);
      if (!existing) return s;
      next.set(routeId, { ...existing, tripId, stops, shapes });
      return { activeRoutes: next };
    }),

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
}));
