import { cn } from "@/lib/utils";
import { elementFromDraft } from "../canvas/drafts";
import type { ToolId } from "../data/tools";
import { useCanvasViewport } from "../hooks/useCanvasViewport";
import { useDrawingInteraction } from "../hooks/useDrawingInteraction";
import { CanvasElementView } from "./CanvasElementView";

interface CanvasSurfaceProps {
  className?: string;
  activeTool?: ToolId;
}

const PREVIEW_ID = "preview";

export function CanvasSurface({ className, activeTool }: CanvasSurfaceProps) {
  const viewport = useCanvasViewport<SVGSVGElement>();
  const { elements, draft, handlers } = useDrawingInteraction(activeTool);

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
        viewBox={
          viewport.isReady
            ? `0 0 ${viewport.width} ${viewport.height}`
            : undefined
        }
        preserveAspectRatio="xMinYMin meet"
        {...handlers}
      >
        {elements.map((element) => (
          <CanvasElementView key={element.id} element={element} />
        ))}

        {previewElement && (
          <CanvasElementView element={previewElement} preview />
        )}
      </svg>
    </main>
  );
}
