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
      <RouteSidebar />
      <SidebarInset className="relative h-[100svh] overflow-hidden">
        <SidebarTrigger
          className="absolute z-[1001] h-10 w-10 rounded-full border bg-background/95 backdrop-blur shadow-lg md:h-8 md:w-8 md:rounded-md"
          style={{
            top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
            left: "calc(env(safe-area-inset-left, 0px) + 0.75rem)",
          }}
        />
        <FeedbackWidget />
        <MapWrapper />
        <TimeControls />
      </SidebarInset>
    </SidebarProvider>
  );
}
