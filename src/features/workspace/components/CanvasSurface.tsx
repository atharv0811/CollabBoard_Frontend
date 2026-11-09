import { createId } from "@/lib/createId";
import { cn } from "@/lib/utils";
import { useState } from "react";
import type { ToolId } from "../data/tools";

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
  stroke: string;
  fill: string;
}

interface Point {
  x: number;
  y: number;
}

export function CanvasSurface({ className, activeTool }: CanvasSurfaceProps) {
  const [rectangles, setRectangles] = useState<Rectangle[]>([]);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);

  function getCanvasPoint(event: React.PointerEvent<SVGSVGElement>): Point {
    const svg = event.currentTarget;
    const matrix = svg.getScreenCTM();

    if (!matrix) {
      return { x: 0, y: 0 };
    }

    const point = svg.createSVGPoint();

    point.x = event.clientX;
    point.y = event.clientY;

    const transformedPoint = point.matrixTransform(matrix.inverse());

    return {
      x: transformedPoint.x,
      y: transformedPoint.y,
    };
  }

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (activeTool !== "rectangle") return;

    const point = getCanvasPoint(event);

    event.currentTarget.setPointerCapture(event.pointerId);

    setStartPoint(point);
    setCurrentPoint(point);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!startPoint) return;

    const point = getCanvasPoint(event);
    setCurrentPoint(point);
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!startPoint) return;

    const endPoint = getCanvasPoint(event);

    setStartPoint(null);
    setCurrentPoint(null);

    const rectangle: Rectangle = {
      id: createId(),
      type: "rectangle",
      x: Math.min(startPoint.x, endPoint.x),
      y: Math.min(startPoint.y, endPoint.y),
      width: Math.abs(endPoint.x - startPoint.x),
      height: Math.abs(endPoint.y - startPoint.y),
      stroke: "#fff",
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
        className="h-full w-full touch-none select-none"
        viewBox="0 0 1200 800"
        preserveAspectRatio="none"
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
            stroke={rectangle.stroke}
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
            stroke="#fff"
            fill="transparent"
            strokeWidth={2}
          />
        )}
      </svg>
    </main>
  );
}
