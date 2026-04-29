"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Search,
  Train,
  Bus,
  TrainFront,
  Pin,
  PanelLeft,
  PinOff,
  X,
  Move,
  RotateCcw,
} from "lucide-react";
import { useRouteStore, type Route } from "@/store/routeStore";
import { fetchRouteDetails, fetchRouteList } from "@/lib/gtfs/api";
import {
  getRouteColor,
  ROUTE_TYPE_GROUPS,
  ROUTE_TYPE_LABEL,
} from "@/lib/routeColors";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const TYPE_ICON: Record<number, React.ComponentType<{ className?: string }>> = {
  0: TrainFront,
  1: Train,
  3: Bus,
};

const ROUTE_DETAILS_DEFAULT_HEIGHT = 310;
const ROUTE_DETAILS_MIN_HEIGHT = 220;
const ROUTE_DETAILS_MAX_VIEWPORT_RATIO = 0.72;

function clampRouteDetailsHeight(height: number) {
  const viewportMax =
    typeof window === "undefined"
      ? 520
      : Math.round(window.innerHeight * ROUTE_DETAILS_MAX_VIEWPORT_RATIO);
  const maxHeight = Math.max(ROUTE_DETAILS_MIN_HEIGHT, viewportMax);
  return Math.round(
    Math.min(maxHeight, Math.max(ROUTE_DETAILS_MIN_HEIGHT, height)),
  );
}

export function RouteSidebar() {
  const {
    routes,
    activeRoutes,
    routeCache,
    focusedRouteId,
    pinnedRouteIds,
    isLoading,
    isStopEditMode,
    setRoutes,
    setRouteCache,
    setLoading,
    setStopEditMode,
    setActiveRoute,
    setFocusedRoute,
    setActiveTrip,
    togglePin,
    removeActiveRoute,
    resetAllRoutes,
  } = useRouteStore();
  const [search, setSearch] = useState("");
  const [loadingRouteId, setLoadingRouteId] = useState<string | null>(null);
  const [routeDetailsHeight, setRouteDetailsHeight] = useState(
    ROUTE_DETAILS_DEFAULT_HEIGHT,
  );
  const [showOnboarding, setShowOnboarding] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem("ttc-simulator-onboarding-seen") !== "1",
  );

  useEffect(() => {
    function openTutorial() {
      setShowOnboarding(true);
    }
    window.addEventListener("open-tutorial", openTutorial);
    return () => window.removeEventListener("open-tutorial", openTutorial);
  }, []);

  function closeOnboarding() {
    window.localStorage.setItem("ttc-simulator-onboarding-seen", "1");
    setShowOnboarding(false);
  }

  function openFeedbackFromOnboarding() {
    closeOnboarding();
    window.dispatchEvent(new Event("open-feedback-sheet"));
  }

  // Load route names only. Route details are fetched lazily on click.
  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    fetchRouteList()
      .then((fetchedRoutes) => {
        if (cancelled) return;
        setRoutes(
          [...fetchedRoutes].sort((a, b) => {
            const aNum = parseInt(a.routeShortName);
            const bNum = parseInt(b.routeShortName);
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
            return a.routeShortName.localeCompare(b.routeShortName);
          }),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setRoutes([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [setRoutes, setLoading]);

  async function activateRoute(routeId: string) {
    // Already active — just focus.
    if (activeRoutes.has(routeId)) {
      setFocusedRoute(routeId);
      return;
    }

    if (loadingRouteId === routeId) return;

    let cached = routeCache.get(routeId);
    if (!cached) {
      setLoadingRouteId(routeId);
      try {
        cached = await fetchRouteDetails(routeId);
        setRouteCache(cached);
      } catch {
        return;
      } finally {
        setLoadingRouteId((current) => (current === routeId ? null : current));
      }
    }

    if (!cached) return;
    const firstTrip =
      cached.canonicalTrips.find((t) => t.directionId === 0) ??
      cached.canonicalTrips[0];
    if (!firstTrip) return;

    const stops = cached.stopsByTrip[firstTrip.tripId] ?? [];
    const shapes = cached.shapesByTrip[firstTrip.tripId] ?? [];

    setActiveRoute({
      routeId,
      tripId: firstTrip.tripId,
      trips: cached.canonicalTrips,
      stops,
      shapes,
    });
  }

  function changeTrip(routeId: string, tripId: string) {
    const cached = routeCache.get(routeId);
    if (!cached) return;
    const stops = cached.stopsByTrip[tripId] ?? [];
    const shapes = cached.shapesByTrip[tripId] ?? [];
    setActiveTrip(routeId, tripId, stops, shapes);
  }

  function startRouteDetailsResize(
    event: React.PointerEvent<HTMLButtonElement>,
  ) {
    if (event.button !== 0) return;

    event.preventDefault();
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    const startY = event.clientY;
    const startHeight = routeDetailsHeight;
    handle.setPointerCapture(pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      setRouteDetailsHeight(
        clampRouteDetailsHeight(startHeight + startY - moveEvent.clientY),
      );
    };

    const handlePointerUp = () => {
      handle.releasePointerCapture(pointerId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  const filteredRoutes = useMemo(() => {
    if (!search.trim()) return routes;
    const q = search.toLowerCase();
    return routes.filter(
      (r) =>
        r.routeShortName.toLowerCase().includes(q) ||
        r.routeLongName.toLowerCase().includes(q),
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

  const focusedRoute = focusedRouteId
    ? routes.find((r) => r.routeId === focusedRouteId)
    : null;
  const focusedActive = focusedRouteId
    ? activeRoutes.get(focusedRouteId)
    : null;
  const activeRoutesList = Array.from(activeRoutes.keys());

  return (
    <>
      <Sheet
        open={showOnboarding}
        onOpenChange={(open) => !open && closeOnboarding()}
      >
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="data-[side=bottom]:left-1/2 data-[side=bottom]:-translate-x-1/2 data-[side=bottom]:bottom-6 data-[side=bottom]:w-[min(680px,calc(100%-2rem))] data-[side=bottom]:rounded-xl data-[side=bottom]:border data-[side=bottom]:h-auto"
        >
          <SheetHeader>
            <SheetTitle>Welcome to TTC Simulator</SheetTitle>
            <SheetDescription>
              Quick tips before you start exploring and editing routes.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 space-y-1.5">
            {[
              {
                icon: <PanelLeft className="h-4 w-4 flex-shrink-0 mt-0.5" />,
                text: "On mobile, tap the menu button in the top-left corner to open the route list.",
              },
              {
                icon: <Pin className="h-4 w-4 flex-shrink-0 mt-0.5" />,
                text: "Pin a route to keep it visible while you browse or compare other lines.",
              },
              {
                icon: <Move className="h-4 w-4 flex-shrink-0 mt-0.5" />,
                text: "Use the edit icon in the route panel to reposition stops by dragging them.",
              },
              {
                icon: <ChevronRight className="h-4 w-4 flex-shrink-0 mt-0.5" />,
                text: "Switch direction using the Direction selector for the focused route.",
              },
            ].map(({ icon, text }, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 text-sm rounded-lg px-2 py-1.5 bg-muted/50"
              >
                <span className="text-muted-foreground">{icon}</span>
                <span>{text}</span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-1 px-1">
              Route data may take a moment to load. This is an early build —
              feedback is welcome via the button in the top-right.
            </p>
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={openFeedbackFromOnboarding}>
              Give feedback
            </Button>
            <Button onClick={closeOnboarding}>Got it</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sidebar className="flex flex-col">
        <SidebarHeader className="border-b bg-gradient-to-b from-sidebar/50 to-transparent py-4">
          <div className="flex items-center justify-between gap-3 px-2">
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-base leading-tight">
                TTC Simulator
              </span>
              <span className="text-[10px] text-muted-foreground font-medium">
                Transit route editor
              </span>
            </div>
            <ThemeToggle />
          </div>
          <div className="relative mt-3 px-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search routes…"
              className="pl-8 h-9 text-xs bg-muted/50 border-muted-foreground/20 focus:bg-background"
            />
          </div>
        </SidebarHeader>

        <SidebarContent className="flex-1">
          {/* Active routes summary */}
          {activeRoutesList.length > 0 && (
            <SidebarGroup className="py-3">
              <SidebarGroupLabel className="mb-3 px-3">
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="flex items-center gap-2 font-semibold text-sm">
                    Active
                    <Badge
                      variant="secondary"
                      className="text-[10px] h-5 px-2 font-bold"
                    >
                      {activeRoutesList.length}
                    </Badge>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={resetAllRoutes}
                    title="Reset all active routes"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                </div>
              </SidebarGroupLabel>
              <SidebarGroupContent className="px-2">
                <div className="flex flex-wrap gap-1.5">
                  {activeRoutesList.map((routeId) => {
                    const route = routes.find((r) => r.routeId === routeId);
                    if (!route) return null;
                    const isFocused = routeId === focusedRouteId;
                    const color = getRouteColor(route);
                    return (
                      <button
                        key={routeId}
                        onClick={() => setFocusedRoute(routeId)}
                        className={`group flex items-center gap-1 rounded-lg text-[10px] font-bold px-2 h-6 text-white transition-all duration-200 ${
                          isFocused
                            ? "ring-2 ring-offset-1 ring-offset-sidebar shadow-md"
                            : "opacity-75 hover:opacity-100 shadow-sm"
                        }`}
                        style={{
                          backgroundColor: color,
                          ...(isFocused
                            ? { ["--tw-ring-color" as string]: color }
                            : {}),
                        }}
                      >
                        <span>{route.routeShortName}</span>
                        <X
                          className="h-3 w-3 opacity-70 hover:opacity-100 group-hover:scale-110 transition-transform"
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
            <div className="space-y-2 px-1">
              {ROUTE_TYPE_GROUPS.map(({ type, label }) => {
                const groupRoutes = routesByType.get(type) ?? [];
                if (groupRoutes.length === 0) return null;
                const Icon = TYPE_ICON[type];

                return (
                  <Collapsible
                    key={type}
                    defaultOpen={true}
                    className="group/collapsible rounded-lg border bg-card/30 hover:bg-card/50 transition-colors"
                  >
                    <SidebarGroup className="py-0">
                      <SidebarGroupLabel
                        render={
                          <CollapsibleTrigger className="flex w-full items-center justify-between cursor-pointer hover:bg-muted/30 px-3 py-2.5 rounded-lg transition-colors" />
                        }
                      >
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-sm">{label}</span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] h-5 px-1.5 font-bold ml-auto"
                          >
                            {groupRoutes.length}
                          </Badge>
                        </span>
                        <ChevronRight className="h-4 w-4 transition-transform group-data-[open]/collapsible:rotate-90" />
                      </SidebarGroupLabel>
                      <CollapsibleContent>
                        <SidebarGroupContent className="pt-1">
                          <SidebarMenu>
                            {groupRoutes.map((route) => {
                              const isFocused =
                                route.routeId === focusedRouteId;
                              const isActive = activeRoutes.has(route.routeId);
                              const isPinned = pinnedRouteIds.has(
                                route.routeId,
                              );
                              const color = getRouteColor(route);
                              return (
                                <SidebarMenuItem
                                  key={route.routeId}
                                  className="group/item relative"
                                >
                                  <SidebarMenuButton
                                    isActive={isFocused}
                                    onClick={() => {
                                      void activateRoute(route.routeId);
                                    }}
                                    tooltip={`${route.routeShortName} ${route.routeLongName}`}
                                    className="pr-8 py-2 my-0.5"
                                  >
                                    <span
                                      className="flex items-center justify-center text-[11px] font-bold rounded-md min-w-[28px] h-6 px-1.5 flex-shrink-0 text-white shadow-sm"
                                      style={{ backgroundColor: color }}
                                    >
                                      {route.routeShortName}
                                    </span>
                                    <span className="truncate text-xs font-medium">
                                      {route.routeLongName}
                                    </span>
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
                                      className={`absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-md transition-all ${
                                        isPinned
                                          ? "text-foreground bg-accent shadow-sm"
                                          : "text-muted-foreground opacity-0 group-hover/item:opacity-100 hover:bg-accent/50"
                                      }`}
                                      title={
                                        isPinned
                                          ? "Unpin route"
                                          : "Pin route to keep visible"
                                      }
                                    >
                                      {isPinned ? (
                                        <Pin className="h-3.5 w-3.5 fill-current" />
                                      ) : (
                                        <PinOff className="h-3.5 w-3.5" />
                                      )}
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
              })}
            </div>
          )}

          {!isLoading && filteredRoutes.length === 0 && (
            <div className="flex items-center justify-center px-4 py-12 text-center">
              <div className="space-y-2">
                <Search className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground font-medium">
                  No routes match
                  <br />
                  &quot;{search}&quot;
                </p>
              </div>
            </div>
          )}
        </SidebarContent>

        {focusedRoute && focusedActive && (
          <SidebarFooter
            className="relative min-h-0 border-t bg-gradient-to-t from-sidebar/30 to-transparent p-0"
            style={{ height: routeDetailsHeight }}
          >
            <button
              type="button"
              aria-label="Resize route details area"
              title="Drag to resize route details area. Double-click to reset."
              onPointerDown={startRouteDetailsResize}
              onDoubleClick={() =>
                setRouteDetailsHeight(ROUTE_DETAILS_DEFAULT_HEIGHT)
              }
              className="absolute -top-2 left-0 z-10 flex h-4 w-full cursor-ns-resize touch-none items-center justify-center focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="h-1 w-12 rounded-full bg-sidebar-border opacity-80" />
            </button>
            <div className="flex h-full min-h-0 flex-col px-2 pb-3 pt-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <span
                  className="flex items-center justify-center text-[11px] font-bold rounded-md min-w-[28px] h-6 px-1.5 flex-shrink-0 text-white shadow-sm"
                  style={{ backgroundColor: getRouteColor(focusedRoute) }}
                >
                  {focusedRoute.routeShortName}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">
                    {focusedRoute.routeLongName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {ROUTE_TYPE_LABEL[focusedRoute.routeType] ?? "Route"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-accent/50"
                  onClick={() => togglePin(focusedRoute.routeId)}
                  title={
                    pinnedRouteIds.has(focusedRoute.routeId) ? "Unpin" : "Pin"
                  }
                >
                  {pinnedRouteIds.has(focusedRoute.routeId) ? (
                    <Pin className="h-4 w-4 fill-current text-accent" />
                  ) : (
                    <PinOff className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant={isStopEditMode ? "default" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setStopEditMode(!isStopEditMode)}
                  title={
                    isStopEditMode
                      ? "Stop dragging enabled"
                      : "Enable stop dragging"
                  }
                >
                  <Move className="h-4 w-4" />
                </Button>
              </div>

              {isStopEditMode && (
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Drag stop markers on the map to reposition them.
                </p>
              )}

              <div className="shrink-0">
                <p className="text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-widest">
                  Direction
                </p>
                <Select
                  value={focusedActive.tripId}
                  onValueChange={(v) => {
                    if (v) changeTrip(focusedRoute.routeId, v);
                  }}
                >
                  <SelectTrigger className="w-full text-xs h-8 bg-muted/50 border-muted-foreground/20">
                    <SelectValue placeholder="Select direction" />
                  </SelectTrigger>
                  <SelectContent>
                    {focusedActive.trips.map((t) => (
                      <SelectItem
                        key={t.tripId}
                        value={t.tripId}
                        className="text-xs"
                      >
                        {t.tripHeadsign || `Direction ${t.directionId}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {focusedActive.stops.length > 0 && (
                <>
                  <Separator className="my-2" />
                  <div className="flex min-h-0 flex-1 flex-col">
                    <p className="text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-widest">
                      {focusedActive.stops.length} Stops
                    </p>
                    <ScrollArea className="min-h-0 flex-1 rounded-lg border border-muted/50 bg-muted/30 p-2">
                      <div className="space-y-1">
                        {focusedActive.stops.map((stop, i) => (
                          <div
                            key={`${stop.stopId}-${stop.sequence}-${i}`}
                            className="flex items-start gap-2 text-[11px] py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors group/stop"
                          >
                            <span className="text-muted-foreground w-5 text-right flex-shrink-0 font-semibold">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="truncate text-muted-foreground group-hover/stop:text-foreground transition-colors">
                              {stop.stopName}
                            </span>
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
    </>
  );
}
