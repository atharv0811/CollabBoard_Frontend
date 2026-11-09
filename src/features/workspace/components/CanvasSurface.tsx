import { useEffect, useMemo, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { elementFromDraft } from "../canvas/drafts";
import { isDrawingTool } from "../canvas/elements";
import { gridFor, viewBoxFor } from "../canvas/viewport";
import { useCanvasInteraction } from "../hooks/useCanvasInteraction";
import { useCanvasViewport } from "../hooks/useCanvasViewport";
import { useViewportWheel } from "../hooks/useViewportWheel";
import { useWorkspaceStore } from "../store/workspaceStore";
import { CanvasElementView } from "./CanvasElementView";
import { SelectionOverlay } from "./SelectionOverlay";

interface CanvasSurfaceProps {
  className?: string;
}

const PREVIEW_ID = "preview";

export function CanvasSurface({ className }: CanvasSurfaceProps) {
  const measured = useCanvasViewport<SVGSVGElement>();
  const elements = useWorkspaceStore((state) => state.elements);
  const selectedIds = useWorkspaceStore((state) => state.selectedIds);
  const viewport = useWorkspaceStore((state) => state.viewport);
  const setCanvasSize = useWorkspaceStore((state) => state.setCanvasSize);
  const drawing = useWorkspaceStore((state) => isDrawingTool(state.activeTool));
  const { draft, preview, marquee, cursor, handlers } = useCanvasInteraction(measured.ref);
  useViewportWheel(measured.ref);

  useEffect(() => {
    setCanvasSize({ width: measured.width, height: measured.height });
  }, [measured.width, measured.height, setCanvasSize]);

  const displayed = useMemo(
    () => (preview ? elements.map((element) => preview.get(element.id) ?? element) : elements),
    [elements, preview],
  );
  const selected = useMemo(() => {
    const ids = new Set(selectedIds);
    return displayed.filter((element) => ids.has(element.id));
  }, [displayed, selectedIds]);

  const previewElement = draft ? elementFromDraft(draft, PREVIEW_ID) : null;

  const viewBox = viewBoxFor(viewport, measured);
  const grid = gridFor(viewport);
  const gridStyle = {
    backgroundSize: `${grid.size}px ${grid.size}px`,
    backgroundPosition: `${grid.offsetX}px ${grid.offsetY}px`,
  } satisfies CSSProperties;
  const shownCursor = cursor === "grabbing" ? cursor : drawing ? "crosshair" : cursor;

  return (
    <main
      aria-label="Whiteboard canvas"
      className={cn(
        "absolute inset-0 z-(--z-canvas) touch-none overscroll-none bg-dot-grid",
        className,
      )}
      style={gridStyle}
    >
      <svg
        ref={measured.ref}
        className="h-full w-full touch-none select-none text-foreground"
        style={{ cursor: shownCursor }}
        viewBox={
          measured.isReady
            ? `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`
            : undefined
        }
        preserveAspectRatio="xMinYMin meet"
        {...handlers}
      >
        {displayed.map((element) => (
          <CanvasElementView key={element.id} element={element} />
        ))}

        {previewElement && (
          <CanvasElementView element={previewElement} preview />
        )}

        <SelectionOverlay selected={selected} marquee={marquee} zoom={viewport.zoom} />
      </svg>
    </main>
  );
}
