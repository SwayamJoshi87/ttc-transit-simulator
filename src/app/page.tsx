import MapWrapper from "@/components/map/MapWrapper";
import { RouteSidebar } from "@/components/sidebar/RouteSidebar";
import { TimeControls } from "@/components/map/TimeControls";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default function Home() {
  return (
    <SidebarProvider>
      <RouteSidebar />
      <SidebarInset className="relative h-screen overflow-hidden">
        <SidebarTrigger className="absolute top-3 left-3 z-[1000] bg-background/95 backdrop-blur shadow-md" />
        <MapWrapper />
        <TimeControls />
      </SidebarInset>
    </SidebarProvider>
  );
}
