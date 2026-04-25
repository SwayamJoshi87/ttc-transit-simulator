"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loadGTFS } from "./parser";

type GtfsData = Awaited<ReturnType<typeof loadGTFS>>;

interface GtfsContextValue {
  data: GtfsData | null;
  isLoading: boolean;
  error: Error | null;
}

const GtfsContext = createContext<GtfsContextValue>({ data: null, isLoading: true, error: null });

export function GtfsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<GtfsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadGTFS()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setIsLoading(false));
  }, []);

  return <GtfsContext.Provider value={{ data, isLoading, error }}>{children}</GtfsContext.Provider>;
}

export function useGtfs() {
  return useContext(GtfsContext);
}
