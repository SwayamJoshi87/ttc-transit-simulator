"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Search, Train, Bus, TrainFront } from "lucide-react";
import { useRouteStore } from "@/store/routeStore";
import { loadGTFS, getStopsForTrip, getShapesForTrip, getCanonicalTrips } from "@/lib/gtfs/parser";
import { getRouteColor, ROUTE_TYPE_GROUPS, ROUTE_TYPE_LABEL } from "@/lib/routeColors";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";

const TYPE_ICON: Record<number, React.ComponentType<{ className?: string }>> = {
  0: TrainFront, // Streetcar
  1: Train, // Subway
  3: Bus, // Bus
};

export function RouteSidebar() {
  const {
    routes,
    selectedRouteId,
    selectedTripId,
    tripsForRoute,
    stopsForTrip,
    isLoading,
    setRoutes,
    selectRoute,
    selectTrip,
    setTripsForRoute,
    setStopsForTrip,
    setShapesForTrip,
    setLoading,
  } = useRouteStore();

  const gtfsRef = useRef<Awaited<ReturnType<typeof loadGTFS>> | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    loadGTFS()
      .then((data) => {
        gtfsRef.current = data;
        setRoutes(
          data.routes.sort((a, b) => {
            const aNum = parseInt(a.routeShortName);
            const bNum = parseInt(b.routeShortName);
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
            return a.routeShortName.localeCompare(b.routeShortName);
          })
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [setLoading, setRoutes]);

  function handleSelectRoute(routeId: string) {
    selectRoute(routeId);
    if (!gtfsRef.current) return;
    const allTrips = gtfsRef.current.trips.filter((t) => t.routeId === routeId);
    // Reduce to one canonical (longest) trip per (direction, headsign) so we don't
    // surface short-turn / test trips as the default representative variant.
    const canonical = getCanonicalTrips(allTrips, gtfsRef.current.stopTimesByTrip);
    setTripsForRoute(canonical);
    const firstTrip = canonical.find((t) => t.directionId === 0) ?? canonical[0];
    if (firstTrip) handleSelectTrip(firstTrip.tripId, canonical);
  }

  function handleSelectTrip(tripId: string, trips = tripsForRoute) {
    selectTrip(tripId);
    if (!gtfsRef.current) return;
    const trip = trips.find((t) => t.tripId === tripId);
    if (!trip) return;
    const stops = getStopsForTrip(tripId, gtfsRef.current.stopTimesByTrip, gtfsRef.current.stopMap);
    const shapes = getShapesForTrip(trip.shapeId, gtfsRef.current.shapesByShapeId);
    setStopsForTrip(stops);
    setShapesForTrip(shapes);
  }

  const filteredRoutes = useMemo(() => {
    if (!search.trim()) return routes;
    const q = search.toLowerCase();
    return routes.filter(
      (r) =>
        r.routeShortName.toLowerCase().includes(q) ||
        r.routeLongName.toLowerCase().includes(q)
    );
  }, [routes, search]);

  const routesByType = useMemo(() => {
    const map = new Map<number, typeof routes>();
    for (const r of filteredRoutes) {
      const arr = map.get(r.routeType) ?? [];
      arr.push(r);
      map.set(r.routeType, arr);
    }
    return map;
  }, [filteredRoutes]);

  const selectedRoute = routes.find((r) => r.routeId === selectedRouteId);

  return (
    <Sidebar>
      <SidebarHeader className="border-b">
        <div className="flex items-center justify-between gap-2 px-1 py-1">
          <div className="flex flex-col">
            <span className="font-semibold text-sm">TTC Simulator</span>
            <span className="text-[11px] text-muted-foreground">Transit route editor</span>
          </div>
          <ThemeToggle />
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search routes…"
            className="pl-7 h-8 text-xs"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {isLoading ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {Array.from({ length: 8 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          ROUTE_TYPE_GROUPS.map(({ type, label }) => {
            const groupRoutes = routesByType.get(type) ?? [];
            if (groupRoutes.length === 0) return null;
            const Icon = TYPE_ICON[type];

            return (
              <Collapsible key={type} defaultOpen className="group/collapsible">
                <SidebarGroup>
                  <SidebarGroupLabel
                    render={
                      <CollapsibleTrigger className="flex w-full items-center justify-between cursor-pointer hover:text-sidebar-foreground" />
                    }
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {groupRoutes.length}
                      </Badge>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[open]/collapsible:rotate-90" />
                  </SidebarGroupLabel>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {groupRoutes.map((route) => {
                          const isActive = route.routeId === selectedRouteId;
                          const color = getRouteColor(route);
                          return (
                            <SidebarMenuItem key={route.routeId}>
                              <SidebarMenuButton
                                isActive={isActive}
                                onClick={() => handleSelectRoute(route.routeId)}
                                tooltip={`${route.routeShortName} ${route.routeLongName}`}
                              >
                                <span
                                  className="flex items-center justify-center text-[10px] font-bold rounded-md min-w-[28px] h-5 px-1 flex-shrink-0 text-white"
                                  style={{ backgroundColor: color }}
                                >
                                  {route.routeShortName}
                                </span>
                                <span className="truncate text-xs">{route.routeLongName}</span>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          })
        )}

        {!isLoading && filteredRoutes.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            No routes match &quot;{search}&quot;
          </div>
        )}
      </SidebarContent>

      {selectedRoute && (
        <SidebarFooter className="border-t">
          <div className="px-1 space-y-3">
            <div className="flex items-center gap-2">
              <span
                className="flex items-center justify-center text-[10px] font-bold rounded-md min-w-[28px] h-5 px-1 flex-shrink-0 text-white"
                style={{ backgroundColor: getRouteColor(selectedRoute) }}
              >
                {selectedRoute.routeShortName}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{selectedRoute.routeLongName}</p>
                <p className="text-[10px] text-muted-foreground">
                  {ROUTE_TYPE_LABEL[selectedRoute.routeType] ?? "Route"}
                </p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                Direction
              </p>
              <Select
                value={selectedTripId ?? ""}
                onValueChange={(v) => {
                  if (v) handleSelectTrip(v);
                }}
              >
                <SelectTrigger className="w-full text-xs h-8">
                  <SelectValue placeholder="Select direction" />
                </SelectTrigger>
                <SelectContent>
                  {tripsForRoute.map((t) => (
                    <SelectItem key={t.tripId} value={t.tripId} className="text-xs">
                      {t.tripHeadsign || `Direction ${t.directionId}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {stopsForTrip.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                    {stopsForTrip.length} Stops
                  </p>
                  <ScrollArea className="h-32">
                    <div className="space-y-0.5 pr-2">
                      {stopsForTrip.map((stop, i) => (
                        <div key={stop.stopId} className="flex items-center gap-2 text-[11px] py-0.5">
                          <span className="text-muted-foreground w-5 text-right flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="truncate">{stop.stopName}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
