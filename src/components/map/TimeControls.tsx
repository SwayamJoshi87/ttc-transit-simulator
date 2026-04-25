"use client";

import { useEffect } from "react";
import { Play, Pause, Clock, Calendar, Sparkles } from "lucide-react";
import {
  useSimulationStore,
  formatTimeOfDay,
  type ServiceDay,
} from "@/store/simulationStore";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SPEEDS: { label: string; value: number }[] = [
  { label: "1x", value: 1 },
  { label: "5x", value: 5 },
  { label: "30x", value: 30 },
  { label: "120x", value: 120 },
  { label: "500x", value: 500 },
];

const DAYS: { value: ServiceDay; label: string }[] = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

const TIME_MIN = 4 * 3600;
const TIME_MAX = 28 * 3600;

export function TimeControls() {
  const {
    currentTimeSec,
    isPlaying,
    speed,
    serviceDay,
    showSprites,
    setCurrentTime,
    advanceTime,
    togglePlay,
    setSpeed,
    setServiceDay,
    setShowSprites,
    resetToNow,
    initializeFromNow,
  } = useSimulationStore();

  useEffect(() => {
    initializeFromNow();
  }, [initializeFromNow]);

  useEffect(() => {
    if (!isPlaying) return;
    let last = performance.now();
    let rafId: number;
    const tick = (now: number) => {
      const deltaMs = now - last;
      last = now;
      advanceTime((deltaMs / 1000) * speed);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, speed, advanceTime]);

  const sliderValue = Math.min(Math.max(currentTimeSec, TIME_MIN), TIME_MAX);

  return (
    <div
      className="absolute left-1/2 z-[1000] w-[min(720px,calc(100%-1rem))] -translate-x-1/2 rounded-xl border bg-background/95 p-2.5 shadow-lg backdrop-blur sm:w-[min(720px,calc(100%-2rem))] sm:p-3"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
    >
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="default"
          className="h-9 w-9 flex-shrink-0 sm:h-8 sm:w-8"
          onClick={togglePlay}
        >
          {isPlaying ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
        </Button>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-sm font-mono font-medium tabular-nums">
              {formatTimeOfDay(currentTimeSec, true)}
            </span>
            <span className="text-[10px] text-muted-foreground capitalize">
              {serviceDay}
            </span>
          </div>
          <Slider
            value={[sliderValue]}
            min={TIME_MIN}
            max={TIME_MAX}
            step={60}
            onValueChange={(v) => {
              const next = Array.isArray(v) ? v[0] : v;
              if (typeof next === "number") setCurrentTime(next);
            }}
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-9 w-9 flex-shrink-0 px-0 sm:h-8 sm:w-auto sm:px-3"
          onClick={resetToNow}
          title="Snap to current Toronto time"
        >
          <Clock className="h-3 w-3 sm:mr-1" />
          <span className="hidden sm:inline">Now</span>
        </Button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Speed
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-full text-xs sm:h-7 sm:w-14"
                />
              }
            >
              {SPEEDS.find((s) => s.value === speed)?.label ?? `${speed}x`}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {SPEEDS.map((s) => (
                <DropdownMenuItem
                  key={s.value}
                  onClick={() => setSpeed(s.value)}
                >
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-1">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
            <Calendar className="h-3 w-3" />
            Day
          </span>
          <Select
            value={serviceDay}
            onValueChange={(v) => v && setServiceDay(v as ServiceDay)}
          >
            <SelectTrigger className="h-8 w-full text-xs sm:h-7 sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS.map((d) => (
                <SelectItem key={d.value} value={d.value} className="text-xs">
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2 flex items-center justify-between rounded-md border border-border/70 bg-background/60 px-2.5 py-2 sm:ml-auto sm:w-auto sm:justify-start sm:gap-1.5 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
          <Sparkles className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Vehicles
          </span>
          <Switch checked={showSprites} onCheckedChange={setShowSprites} />
        </div>
      </div>
    </div>
  );
}
