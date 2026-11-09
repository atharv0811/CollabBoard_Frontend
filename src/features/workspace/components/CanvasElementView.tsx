import { memo } from "react";
import type { CanvasElement } from "../canvas/elements";
import { arrowheadPoints, diamondVertices, freehandPathData, toSvgPoints } from "../canvas/geometry";

interface CanvasElementViewProps {
  element: CanvasElement;
  /** Renders the in-progress drawing instead of a committed element */
  preview?: boolean;
}

/**
 * SVG rendering for one element. Geometry comes from canvas/geometry.ts;
 * this component only maps it to SVG. Memoised, so committed elements do
 * not re-render while another drawing is in progress.
 * Stroke uses `currentColor`, which follows the theme's text colour.
 */
export const CanvasElementView = memo(function CanvasElementView({ element, preview = false }: CanvasElementViewProps) {
  const common = {
    ...(preview ? { "data-preview": "" } : { "data-shape-id": element.id }),
    "data-element-type": element.type,
    stroke: "currentColor",
    strokeWidth: element.style.strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;

  switch (element.type) {
    case "rectangle":
      return (
        <rect
          {...common}
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          fill={element.style.fill}
        />
      );

    case "ellipse":
      return (
        <ellipse {...common} cx={element.cx} cy={element.cy} rx={element.rx} ry={element.ry} fill={element.style.fill} />
      );

    case "diamond":
      return <polygon {...common} points={toSvgPoints(diamondVertices(element))} fill={element.style.fill} />;

    case "line":
      return <line {...common} x1={element.start.x} y1={element.start.y} x2={element.end.x} y2={element.end.y} />;

    case "arrow":
      return (
        <g {...common} fill="none">
          <line x1={element.start.x} y1={element.start.y} x2={element.end.x} y2={element.end.y} />
          <polyline
            data-arrowhead=""
            points={toSvgPoints(arrowheadPoints(element.start, element.end, element.style.strokeWidth))}
          />
        </g>
      );

    case "freehand":
      return (
        <path
          {...common}
          d={freehandPathData(element.points)}
          fill="none"
          data-point-count={element.points.length}
        />
      );
  }
});
