import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { elementFromDraft } from "../canvas/drafts";
import { isDrawingTool } from "../canvas/elements";
import { useCanvasInteraction } from "../hooks/useCanvasInteraction";
import { useCanvasViewport } from "../hooks/useCanvasViewport";
import { useWorkspaceStore } from "../store/workspaceStore";
import { CanvasElementView } from "./CanvasElementView";
import { SelectionOverlay } from "./SelectionOverlay";

interface CanvasSurfaceProps {
  className?: string;
}

const PREVIEW_ID = "preview";

export function CanvasSurface({ className }: CanvasSurfaceProps) {
  const viewport = useCanvasViewport<SVGSVGElement>();
  const elements = useWorkspaceStore((state) => state.elements);
  const selectedIds = useWorkspaceStore((state) => state.selectedIds);
  const drawing = useWorkspaceStore((state) => isDrawingTool(state.activeTool));
  const { draft, preview, marquee, cursor, handlers } = useCanvasInteraction(viewport.ref);

  // Elements as displayed: committed data with any live move / resize preview applied.
  const displayed = useMemo(
    () => (preview ? elements.map((element) => preview.get(element.id) ?? element) : elements),
    [elements, preview],
  );
  const selected = useMemo(() => {
    const ids = new Set(selectedIds);
    return displayed.filter((element) => ids.has(element.id));
  }, [displayed, selectedIds]);

  const previewElement = draft ? elementFromDraft(draft, PREVIEW_ID) : null;

  return (
    <main
      aria-label="Whiteboard canvas"
      className={cn(
        "absolute inset-0 z-(--z-canvas) touch-none overscroll-none bg-dot-grid",
        className,
      )}
    >
      <svg
        ref={viewport.ref}
        className="h-full w-full touch-none select-none text-foreground"
        style={{ cursor: drawing ? "crosshair" : cursor }}
        viewBox={
          viewport.isReady
            ? `0 0 ${viewport.width} ${viewport.height}`
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

        <SelectionOverlay selected={selected} marquee={marquee} />
      </svg>
    </main>
  );
}
