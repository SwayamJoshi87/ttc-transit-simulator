"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Search, Train, Bus, TrainFront, Pin, PinOff, X } from "lucide-react";
import { useRouteStore, type Route } from "@/store/routeStore";
import { getStopsForTrip, getShapesForTrip, getCanonicalTrips } from "@/lib/gtfs/parser";
import { useGtfs } from "@/lib/gtfs/GtfsProvider";
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";

const TYPE_ICON: Record<number, React.ComponentType<{ className?: string }>> = {
  0: TrainFront,
  1: Train,
  3: Bus,
};

export function RouteSidebar() {
  const {
    routes,
    activeRoutes,
    focusedRouteId,
    pinnedRouteIds,
    isLoading,
    setRoutes,
    setLoading,
    setActiveRoute,
    setFocusedRoute,
    setActiveTrip,
    togglePin,
    removeActiveRoute,
  } = useRouteStore();

  const { data: gtfs, isLoading: gtfsLoading } = useGtfs();
  const [search, setSearch] = useState("");

  // Push GTFS routes into the store once they load.
  useEffect(() => {
    setLoading(gtfsLoading);
    if (!gtfs) return;
    setRoutes(
      [...gtfs.routes].sort((a, b) => {
        const aNum = parseInt(a.routeShortName);
        const bNum = parseInt(b.routeShortName);
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        return a.routeShortName.localeCompare(b.routeShortName);
      })
    );
  }, [gtfs, gtfsLoading, setRoutes, setLoading]);

  function activateRoute(routeId: string) {
    if (!gtfs) return;
    // Already active — just focus.
    if (activeRoutes.has(routeId)) {
      setFocusedRoute(routeId);
      return;
    }
    const allTrips = gtfs.trips.filter((t) => t.routeId === routeId);
    const canonical = getCanonicalTrips(allTrips, gtfs.stopTimesByTrip);
    const firstTrip = canonical.find((t) => t.directionId === 0) ?? canonical[0];
    if (!firstTrip) return;
    const stops = getStopsForTrip(firstTrip.tripId, gtfs.stopTimesByTrip, gtfs.stopMap);
    const shapes = getShapesForTrip(firstTrip.shapeId, gtfs.shapesByShapeId);
    setActiveRoute({
      routeId,
      tripId: firstTrip.tripId,
      trips: canonical,
      stops,
      shapes,
    });
  }

  function changeTrip(routeId: string, tripId: string) {
    if (!gtfs) return;
    const active = activeRoutes.get(routeId);
    if (!active) return;
    const trip = active.trips.find((t) => t.tripId === tripId);
    if (!trip) return;
    const stops = getStopsForTrip(tripId, gtfs.stopTimesByTrip, gtfs.stopMap);
    const shapes = getShapesForTrip(trip.shapeId, gtfs.shapesByShapeId);
    setActiveTrip(routeId, tripId, stops, shapes);
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
    const map = new Map<number, Route[]>();
    for (const r of filteredRoutes) {
      const arr = map.get(r.routeType) ?? [];
      arr.push(r);
      map.set(r.routeType, arr);
    }
    return map;
  }, [filteredRoutes]);

  const focusedRoute = focusedRouteId ? routes.find((r) => r.routeId === focusedRouteId) : null;
  const focusedActive = focusedRouteId ? activeRoutes.get(focusedRouteId) : null;
  const activeRoutesList = Array.from(activeRoutes.keys());

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
        {/* Active routes summary */}
        {activeRoutesList.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              <span className="flex items-center gap-1.5">
                Active
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {activeRoutesList.length}
                </Badge>
              </span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="flex flex-wrap gap-1 px-1">
                {activeRoutesList.map((routeId) => {
                  const route = routes.find((r) => r.routeId === routeId);
                  if (!route) return null;
                  const isFocused = routeId === focusedRouteId;
                  const color = getRouteColor(route);
                  return (
                    <button
                      key={routeId}
                      onClick={() => setFocusedRoute(routeId)}
                      className={`group flex items-center gap-1 rounded-md text-[10px] font-bold px-1.5 h-5 text-white transition-all ${
                        isFocused ? "ring-2 ring-offset-1 ring-offset-sidebar" : "opacity-70 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: color, ...(isFocused ? { ["--tw-ring-color" as string]: color } : {}) }}
                    >
                      <span>{route.routeShortName}</span>
                      <X
                        className="h-2.5 w-2.5 opacity-60 hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeActiveRoute(routeId);
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

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
              <Collapsible key={type} defaultOpen={type !== 3} className="group/collapsible">
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
                          const isFocused = route.routeId === focusedRouteId;
                          const isActive = activeRoutes.has(route.routeId);
                          const isPinned = pinnedRouteIds.has(route.routeId);
                          const color = getRouteColor(route);
                          return (
                            <SidebarMenuItem key={route.routeId} className="group/item relative">
                              <SidebarMenuButton
                                isActive={isFocused}
                                onClick={() => activateRoute(route.routeId)}
                                tooltip={`${route.routeShortName} ${route.routeLongName}`}
                                className="pr-8"
                              >
                                <span
                                  className="flex items-center justify-center text-[10px] font-bold rounded-md min-w-[28px] h-5 px-1 flex-shrink-0 text-white"
                                  style={{ backgroundColor: color }}
                                >
                                  {route.routeShortName}
                                </span>
                                <span className="truncate text-xs">{route.routeLongName}</span>
                              </SidebarMenuButton>
                              {isActive && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isPinned) {
                                      // Pin first so we don't lose this route from the active set.
                                      togglePin(route.routeId);
                                    } else {
                                      togglePin(route.routeId);
                                    }
                                  }}
                                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-md transition-colors ${
                                    isPinned
                                      ? "text-foreground bg-accent"
                                      : "text-muted-foreground opacity-0 group-hover/item:opacity-100 hover:bg-accent"
                                  }`}
                                  title={isPinned ? "Unpin route" : "Pin route to keep visible"}
                                >
                                  {isPinned ? <Pin className="h-3 w-3 fill-current" /> : <PinOff className="h-3 w-3" />}
                                </button>
                              )}
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

      {focusedRoute && focusedActive && (
        <SidebarFooter className="border-t">
          <div className="px-1 space-y-3">
            <div className="flex items-center gap-2">
              <span
                className="flex items-center justify-center text-[10px] font-bold rounded-md min-w-[28px] h-5 px-1 flex-shrink-0 text-white"
                style={{ backgroundColor: getRouteColor(focusedRoute) }}
              >
                {focusedRoute.routeShortName}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{focusedRoute.routeLongName}</p>
                <p className="text-[10px] text-muted-foreground">
                  {ROUTE_TYPE_LABEL[focusedRoute.routeType] ?? "Route"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => togglePin(focusedRoute.routeId)}
                title={pinnedRouteIds.has(focusedRoute.routeId) ? "Unpin" : "Pin"}
              >
                {pinnedRouteIds.has(focusedRoute.routeId) ? (
                  <Pin className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <PinOff className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>

            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                Direction
              </p>
              <Select
                value={focusedActive.tripId}
                onValueChange={(v) => {
                  if (v) changeTrip(focusedRoute.routeId, v);
                }}
              >
                <SelectTrigger className="w-full text-xs h-8">
                  <SelectValue placeholder="Select direction" />
                </SelectTrigger>
                <SelectContent>
                  {focusedActive.trips.map((t) => (
                    <SelectItem key={t.tripId} value={t.tripId} className="text-xs">
                      {t.tripHeadsign || `Direction ${t.directionId}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {focusedActive.stops.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                    {focusedActive.stops.length} Stops
                  </p>
                  <ScrollArea className="h-32">
                    <div className="space-y-0.5 pr-2">
                      {focusedActive.stops.map((stop, i) => (
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
