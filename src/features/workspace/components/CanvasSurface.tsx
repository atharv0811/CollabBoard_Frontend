import { createId } from "@/lib/createId";
import { cn } from "@/lib/utils";
import { useState } from "react";
import type { ToolId } from "../data/tools";
import { useCanvasViewport } from "../hooks/useCanvasViewport";

interface CanvasSurfaceProps {
  className?: string;
  activeTool?: ToolId;
}

interface Rectangle {
  id: string;
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}

interface Point {
  x: number;
  y: number;
}

function getCanvasPoint(
  event: React.PointerEvent<SVGSVGElement>,
): Point | null {
  const matrix = event.currentTarget.getScreenCTM();
  if (!matrix) return null;

  const inverse = matrix.inverse();
  const { x, y } = new DOMPoint(event.clientX, event.clientY).matrixTransform(
    inverse,
  );

  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

export function CanvasSurface({ className, activeTool }: CanvasSurfaceProps) {
  const [rectangles, setRectangles] = useState<Rectangle[]>([]);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const viewport = useCanvasViewport<SVGSVGElement>();

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (activeTool !== "rectangle") return;

    const point = getCanvasPoint(event);
    if (!point) return;

    event.currentTarget.setPointerCapture(event.pointerId);

    setStartPoint(point);
    setCurrentPoint(point);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!startPoint) return;

    const point = getCanvasPoint(event);
    if (point) setCurrentPoint(point);
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!startPoint) return;

    const endPoint = getCanvasPoint(event) ?? currentPoint;

    setStartPoint(null);
    setCurrentPoint(null);

    if (!endPoint) return;

    const rectangle: Rectangle = {
      id: createId(),
      type: "rectangle",
      x: Math.min(startPoint.x, endPoint.x),
      y: Math.min(startPoint.y, endPoint.y),
      width: Math.abs(endPoint.x - startPoint.x),
      height: Math.abs(endPoint.y - startPoint.y),
      fill: "transparent",
    };

    if (rectangle.width > 2 && rectangle.height > 2) {
      setRectangles((previous) => [...previous, rectangle]);
    }
  };

  const handlePointerCancel = () => {
    setStartPoint(null);
    setCurrentPoint(null);
  };

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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* Shapes will be rendered here */}
        {rectangles.map((rectangle) => (
          <rect
            key={rectangle.id}
            data-shape-id={rectangle.id}
            x={rectangle.x}
            y={rectangle.y}
            width={rectangle.width}
            height={rectangle.height}
            stroke="currentColor"
            fill={rectangle.fill}
            strokeWidth={2}
          />
        ))}

        {startPoint && currentPoint && (
          <rect
            data-preview=""
            x={Math.min(startPoint.x, currentPoint.x)}
            y={Math.min(startPoint.y, currentPoint.y)}
            width={Math.abs(currentPoint.x - startPoint.x)}
            height={Math.abs(currentPoint.y - startPoint.y)}
            stroke="currentColor"
            fill="transparent"
            strokeWidth={2}
          />
        )}
      </svg>
    </main>
  );
}
