import { useEffect, type RefObject } from "react";
import { wheelIntent } from "../canvas/viewport";
import { useWorkspaceStore } from "../store/workspaceStore";

export function useViewportWheel(svgRef: RefObject<SVGSVGElement | null>) {
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const store = useWorkspaceStore.getState();
      const intent = wheelIntent(event);

      if (intent.kind === "pan") {
        store.panViewport(intent.dx, intent.dy);
        return;
      }
      const rect = svg.getBoundingClientRect();
      store.zoomTo(store.viewport.zoom * intent.factor, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };

    const preventGesture = (event: Event) => event.preventDefault();

    svg.addEventListener("wheel", onWheel, { passive: false });
    svg.addEventListener("gesturestart", preventGesture);
    svg.addEventListener("gesturechange", preventGesture);
    return () => {
      svg.removeEventListener("wheel", onWheel);
      svg.removeEventListener("gesturestart", preventGesture);
      svg.removeEventListener("gesturechange", preventGesture);
    };
  }, [svgRef]);
}
