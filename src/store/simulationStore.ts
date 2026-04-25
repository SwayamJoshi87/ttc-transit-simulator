import { create } from "zustand";

export type ServiceDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

interface SimulationStore {
  /** Seconds since service-day start (00:00). 0–86400+ (can be after midnight). */
  currentTimeSec: number;
  isPlaying: boolean;
  /** Multiplier: 1× = real time, 60× = 1 sim min per real second. */
  speed: number;
  serviceDay: ServiceDay;
  /** When true, sprites for active trips render on the map. */
  showSprites: boolean;

  setCurrentTime: (sec: number) => void;
  advanceTime: (deltaSec: number) => void;
  setPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  setServiceDay: (day: ServiceDay) => void;
  setShowSprites: (show: boolean) => void;
  /** Snap to current real-world Toronto time. */
  resetToNow: () => void;
  /** Client-only initialization to avoid SSR hydration mismatch. */
  initializeFromNow: () => void;
}

/**
 * Returns the Toronto-local current time as seconds since 00:00 of the local day.
 * GTFS schedules are expressed in Toronto local time.
 */
export function getNowSecondsToronto(): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0");
  // "24" can appear in some Intl impls instead of "00" at midnight; normalize.
  const h = get("hour") % 24;
  return h * 3600 + get("minute") * 60 + get("second");
}

export function getCurrentServiceDayToronto(): ServiceDay {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    weekday: "long",
  });
  const day = formatter.format(new Date()).toLowerCase();
  return day as ServiceDay;
}

const DEFAULT_TIME_SEC = 12 * 3600;
const DEFAULT_SERVICE_DAY: ServiceDay = "monday";

export const useSimulationStore = create<SimulationStore>((set) => ({
  currentTimeSec: DEFAULT_TIME_SEC,
  isPlaying: false,
  speed: 30, // 30× by default — enough to see movement without losing all anchoring to real time
  serviceDay: DEFAULT_SERVICE_DAY,
  showSprites: true,

  setCurrentTime: (sec) => set({ currentTimeSec: Math.max(0, sec) }),
  advanceTime: (delta) =>
    set((s) => {
      // Wrap a service day at 30:00:00 (108000s) which is the GTFS convention upper bound.
      // Past that, snap back to 04:00 (the typical TTC service-day start).
      const next = s.currentTimeSec + delta;
      if (next > 108000) return { currentTimeSec: 4 * 3600 };
      return { currentTimeSec: next };
    }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setSpeed: (speed) => set({ speed }),
  setServiceDay: (serviceDay) => set({ serviceDay }),
  setShowSprites: (showSprites) => set({ showSprites }),
  resetToNow: () =>
    set({
      currentTimeSec: getNowSecondsToronto(),
      serviceDay: getCurrentServiceDayToronto(),
    }),
  initializeFromNow: () =>
    set((s) => {
      // Initialize once per page load; keep user changes afterwards.
      if (
        s.currentTimeSec !== DEFAULT_TIME_SEC ||
        s.serviceDay !== DEFAULT_SERVICE_DAY
      ) {
        return s;
      }
      return {
        currentTimeSec: getNowSecondsToronto(),
        serviceDay: getCurrentServiceDayToronto(),
      };
    }),
}));

/** Format seconds-since-midnight as "HH:MM" (or "HH:MM AM/PM" if 12h). */
export function formatTimeOfDay(sec: number, hour12 = false): string {
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor((total % 3600) / 60);
  if (hour12) {
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
  }
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
