"use client";

"use client";

import MapWrapper from "@/components/map/MapWrapper";
import { RouteSidebar } from "@/components/sidebar/RouteSidebar";
import { TimeControls } from "@/components/map/TimeControls";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function Home() {
  return (
    <SidebarProvider>
      <div className="flex h-[100svh] w-full">
        <aside className="w-80 flex-shrink-0 overflow-hidden">
          <RouteSidebar />
        </aside>
        <main className="flex-1 overflow-hidden">
          <SidebarInset className="relative h-[100svh] overflow-hidden">
            <SidebarTrigger
              className="absolute z-[1001] h-12 w-12 rounded-full border bg-background/95 backdrop-blur shadow-lg md:hidden"
              style={{
                top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
                left: "calc(env(safe-area-inset-left, 0px) + 0.75rem)",
              }}
            />
            <FeedbackWidget />
            <MapWrapper />
            <TimeControls />
          </SidebarInset>
        </main>
      </div>
    </SidebarProvider>
  );
}

export default function Home() {
  return (
    <div className="h-[100svh] w-full flex">
      <SidebarProvider>
        <Group orientation="horizontal" id="main-layout" className="w-full">
          <Panel
            id="sidebar-panel"
            defaultSize="20%"
            minSize="15%"
            maxSize="40%"
            className="flex overflow-hidden"
          >
            <RouteSidebar />
          </Panel>
          <Separator />
          <Panel
            id="main-panel"
            defaultSize="80%"
            minSize="60%"
            className="overflow-hidden"
          >
            <SidebarInset className="relative h-[100svh] overflow-hidden">
              <SidebarTrigger
                className="absolute z-[1001] h-12 w-12 rounded-full border bg-background/95 backdrop-blur shadow-lg md:hidden"
                style={{
                  top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
                  left: "calc(env(safe-area-inset-left, 0px) + 0.75rem)",
                }}
              />
              <FeedbackWidget />
              <MapWrapper />
              <TimeControls />
            </SidebarInset>
          </Panel>
        </Group>
      </SidebarProvider>
    </div>
  );
}
