"use client";

import { Sparkles } from "lucide-react";
import { useSimulationStore } from "@/store/simulationStore";
import { Switch } from "@/components/ui/switch";

export function TimeControls() {
  const showVehicles = useSimulationStore((s) => s.showVehicles);
  const setShowVehicles = useSimulationStore((s) => s.setShowVehicles);

  return (
    <div
      className="absolute left-1/2 z-[1000] -translate-x-1/2 flex items-center gap-2.5 rounded-full border bg-background/95 px-3.5 py-2 shadow-lg backdrop-blur"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
    >
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      <span className="text-xs font-medium">Live</span>
      <div className="h-3 w-px bg-border" />
      <Sparkles className="h-3 w-3 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Vehicles</span>
      <Switch
        checked={showVehicles}
        onCheckedChange={setShowVehicles}
        className="h-4 w-7 data-[state=checked]:bg-green-500"
      />
    </div>
  );
}
