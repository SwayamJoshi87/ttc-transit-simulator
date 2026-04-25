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

interface RouteStore {
  routes: Route[];
  selectedRouteId: string | null;
  selectedTripId: string | null;
  tripsForRoute: Trip[];
  stopsForTrip: Stop[];
  shapesForTrip: Shape[];
  isLoading: boolean;
  isEditing: boolean;

  setRoutes: (routes: Route[]) => void;
  selectRoute: (routeId: string | null) => void;
  selectTrip: (tripId: string | null) => void;
  setTripsForRoute: (trips: Trip[]) => void;
  setStopsForTrip: (stops: Stop[]) => void;
  setShapesForTrip: (shapes: Shape[]) => void;
  setLoading: (loading: boolean) => void;
  setEditing: (editing: boolean) => void;
  updateStop: (stopId: string, lat: number, lon: number) => void;
  addStop: (stop: Stop) => void;
  removeStop: (stopId: string) => void;
}

export const useRouteStore = create<RouteStore>((set) => ({
  routes: [],
  selectedRouteId: null,
  selectedTripId: null,
  tripsForRoute: [],
  stopsForTrip: [],
  shapesForTrip: [],
  isLoading: false,
  isEditing: false,

  setRoutes: (routes) => set({ routes }),
  selectRoute: (routeId) =>
    set({ selectedRouteId: routeId, selectedTripId: null, tripsForRoute: [], stopsForTrip: [], shapesForTrip: [] }),
  selectTrip: (tripId) => set({ selectedTripId: tripId }),
  setTripsForRoute: (trips) => set({ tripsForRoute: trips }),
  setStopsForTrip: (stops) => set({ stopsForTrip: stops }),
  setShapesForTrip: (shapes) => set({ shapesForTrip: shapes }),
  setLoading: (isLoading) => set({ isLoading }),
  setEditing: (isEditing) => set({ isEditing }),

  updateStop: (stopId, lat, lon) =>
    set((state) => ({
      stopsForTrip: state.stopsForTrip.map((s) =>
        s.stopId === stopId ? { ...s, lat, lon } : s
      ),
    })),

  addStop: (stop) =>
    set((state) => ({
      stopsForTrip: [...state.stopsForTrip, stop].sort((a, b) => a.sequence - b.sequence),
    })),

  removeStop: (stopId) =>
    set((state) => ({
      stopsForTrip: state.stopsForTrip.filter((s) => s.stopId !== stopId),
    })),
}));
