"use client";

import dynamic from "next/dynamic";

const TransitMap = dynamic(() => import("./TransitMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-muted">
      <p className="text-muted-foreground text-sm">Loading map…</p>
    </div>
  ),
});

export default function MapWrapper() {
  return <TransitMap />;
}
