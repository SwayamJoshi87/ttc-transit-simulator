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
import { Group, Panel, Separator } from "react-resizable-panels";

export default function Home() {
  return (
    <div className="flex h-[100svh] w-full">
      <SidebarProvider>
        <Group orientation="horizontal" className="flex-1">
          <Panel
            defaultSize={20}
            minSize={15}
            maxSize={40}
            className="flex overflow-hidden"
          >
            <RouteSidebar />
          </Panel>
          <Separator className="w-1.5 bg-border hover:bg-primary/40 transition-colors cursor-col-resize data-[active]:bg-primary/60" />
          <Panel defaultSize={80} minSize={60} className="overflow-hidden">
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
