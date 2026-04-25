"use client";

import { useEffect } from "react";
import { Play, Pause, Clock, Calendar, Sparkles } from "lucide-react";
import { useSimulationStore, formatTimeOfDay, type ServiceDay } from "@/store/simulationStore";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SPEEDS: { label: string; value: number }[] = [
  { label: "1×", value: 1 },
  { label: "5×", value: 5 },
  { label: "30×", value: 30 },
  { label: "120×", value: 120 },
  { label: "600×", value: 600 },
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

// Service-day spans 04:00–28:00 typical for transit (4am to 4am next day).
const TIME_MIN = 4 * 3600; // 04:00
const TIME_MAX = 28 * 3600; // 28:00 (= 04:00 next day)

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
  } = useSimulationStore();

  // Tick: when playing, advance simulation time on rAF.
  useEffect(() => {
    if (!isPlaying) return;
    let last = performance.now();
    let rafId: number;
    const tick = (now: number) => {
      const deltaMs = now - last;
      last = now;
      // deltaMs / 1000 = real seconds. Multiply by speed for sim seconds.
      advanceTime((deltaMs / 1000) * speed);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, speed, advanceTime]);

  const sliderValue = Math.min(Math.max(currentTimeSec, TIME_MIN), TIME_MAX);

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] w-[min(720px,calc(100%-2rem))] rounded-lg border bg-background/95 backdrop-blur shadow-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <Button size="icon" variant="default" className="h-8 w-8 flex-shrink-0" onClick={togglePlay}>
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>

        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-mono font-medium tabular-nums">
              {formatTimeOfDay(currentTimeSec, true)}
            </span>
            <span className="text-[10px] text-muted-foreground capitalize">{serviceDay}</span>
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
          className="h-8 text-xs flex-shrink-0"
          onClick={resetToNow}
          title="Snap to current Toronto time"
        >
          <Clock className="h-3 w-3 mr-1" />
          Now
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Speed */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Speed</span>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-7 text-xs w-14" />}>
              {SPEEDS.find((s) => s.value === speed)?.label ?? `${speed}×`}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {SPEEDS.map((s) => (
                <DropdownMenuItem key={s.value} onClick={() => setSpeed(s.value)}>
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Day */}
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <Select value={serviceDay} onValueChange={(v) => v && setServiceDay(v as ServiceDay)}>
            <SelectTrigger className="h-7 text-xs w-32">
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

        {/* Sprites toggle */}
        <div className="flex items-center gap-1.5 ml-auto">
          <Sparkles className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Vehicles</span>
          <Switch checked={showSprites} onCheckedChange={setShowSprites} />
        </div>
      </div>
    </div>
  );
}
