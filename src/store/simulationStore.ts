import { create } from "zustand";

interface SimulationStore {
  showVehicles: boolean;
  setShowVehicles: (show: boolean) => void;
}

export const useSimulationStore = create<SimulationStore>((set) => ({
  showVehicles: true,
  setShowVehicles: (showVehicles) => set({ showVehicles }),
}));
