import { useEffect, useMemo, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { resolveBindings } from "../canvas/bindings";
import { isDrawingTool } from "../canvas/elements";
import { elementBounds } from "../canvas/hitTest";
import { padBounds } from "../canvas/selection";
import { gridFor, viewBoxFor } from "../canvas/viewport";
import { useCanvasInteraction } from "../hooks/useCanvasInteraction";
import { useCanvasViewport } from "../hooks/useCanvasViewport";
import { useImageInsert } from "../hooks/useImageInsert";
import { useViewportWheel } from "../hooks/useViewportWheel";
import { useWorkspaceStore } from "../store/workspaceStore";
import { CanvasElementView } from "./CanvasElementView";
import { SelectionOverlay } from "./SelectionOverlay";
import { TextEditor } from "./TextEditor";

interface CanvasSurfaceProps {
  className?: string;
}

const ERASER_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Ccircle cx='10' cy='10' r='7' fill='white' fill-opacity='0.7' stroke='black' stroke-width='1.5'/%3E%3C/svg%3E\") 10 10, crosshair";

export function CanvasSurface({ className }: CanvasSurfaceProps) {
  const measured = useCanvasViewport<SVGSVGElement>();
  const elements = useWorkspaceStore((state) => state.elements);
  const selectedIds = useWorkspaceStore((state) => state.selectedIds);
  const viewport = useWorkspaceStore((state) => state.viewport);
  const setCanvasSize = useWorkspaceStore((state) => state.setCanvasSize);
  const activeTool = useWorkspaceStore((state) => state.activeTool);
  const image = useImageInsert();
  const { draftElement, bindTargets, preview, marquee, erasing, cursor, textEdit, updateText, commitText, handlers } =
    useCanvasInteraction(measured.ref, { onImageRequest: image.open });
  useViewportWheel(measured.ref);

  useEffect(() => {
    setCanvasSize({ width: measured.width, height: measured.height });
  }, [measured.width, measured.height, setCanvasSize]);

  const editingId = textEdit?.id;
  const displayed = useMemo(() => {
    const shown = editingId ? elements.filter((element) => element.id !== editingId) : elements;
    // Resolving here makes attached connectors follow shapes live while they are dragged.
    return resolveBindings(preview ? shown.map((element) => preview.get(element.id) ?? element) : shown);
  }, [elements, preview, editingId]);
  const selected = useMemo(() => {
    const ids = new Set(selectedIds);
    return displayed.filter((element) => ids.has(element.id));
  }, [displayed, selectedIds]);

  const previewElement = useMemo(
    () => (draftElement ? (resolveBindings([...elements, draftElement]).at(-1) ?? null) : null),
    [draftElement, elements],
  );
  const highlighted = useMemo(
    () => displayed.filter((element) => bindTargets.includes(element.id)),
    [displayed, bindTargets],
  );

  const viewBox = viewBoxFor(viewport, measured);
  const grid = gridFor(viewport);
  const gridStyle = {
    backgroundSize: `${grid.size}px ${grid.size}px`,
    backgroundPosition: `${grid.offsetX}px ${grid.offsetY}px`,
  } satisfies CSSProperties;
  const toolCursor = isDrawingTool(activeTool)
    ? "crosshair"
    : activeTool === "text"
      ? "text"
      : activeTool === "eraser"
        ? ERASER_CURSOR
        : null;
  const shownCursor = cursor === "grabbing" ? cursor : (toolCursor ?? cursor);

  return (
    <main
      aria-label="Whiteboard canvas"
      className={cn("absolute inset-0 z-(--z-canvas) touch-none overscroll-none bg-dot-grid", className)}
      style={gridStyle}
    >
      <svg
        ref={measured.ref}
        className="h-full w-full touch-none text-foreground select-none"
        style={{ cursor: shownCursor }}
        viewBox={measured.isReady ? `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}` : undefined}
        preserveAspectRatio="xMinYMin meet"
        {...handlers}
      >
        {displayed.map((element) => (
          <CanvasElementView key={element.id} element={element} faded={erasing?.has(element.id) ?? false} />
        ))}

        {previewElement && <CanvasElementView element={previewElement} preview />}

        {highlighted.map((element) => (
          <rect
            key={element.id}
            data-bind-target={element.id}
            {...padBounds(elementBounds(element), 4 / viewport.zoom)}
            rx={4 / viewport.zoom}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
            className="fill-brand/5 stroke-brand"
            strokeWidth={2}
          />
        ))}

        <SelectionOverlay selected={selected} marquee={marquee} zoom={viewport.zoom} />
      </svg>

      {textEdit && <TextEditor edit={textEdit} onChange={updateText} onCommit={commitText} />}
      <input {...image.inputProps} aria-label="Choose an image to insert" />
    </main>
  );
}
