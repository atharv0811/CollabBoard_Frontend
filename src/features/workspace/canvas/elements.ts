import type { ToolId } from "../data/tools";

/** A position in world coordinates (SVG user units). */
export interface Point {
  x: number;
  y: number;
}

/**
 * Visual style shared by every element.
 * Stroke colour is intentionally absent: elements draw with `currentColor`,
 * so they follow the light / dark theme automatically.
 */
export interface ElementStyle {
  /** Stroke width in world units */
  strokeWidth: number;
  fill: string;
}

interface ElementBase {
  id: string;
  style: ElementStyle;
}

/** Axis-aligned box; x/y is the top-left corner, width/height are never negative. */
export interface RectangleElement extends ElementBase {
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EllipseElement extends ElementBase {
  type: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** Stored as its bounding box; the four vertices are derived when rendering. */
export interface DiamondElement extends ElementBase {
  type: "diamond";
  x: number;
  y: number;
  width: number;
  height: number;
}

/** start/end keep the drawing direction (they are not normalised). */
export interface LineElement extends ElementBase {
  type: "line";
  start: Point;
  end: Point;
}

/** The arrowhead sits at `end`. */
export interface ArrowElement extends ElementBase {
  type: "arrow";
  start: Point;
  end: Point;
}

export interface FreehandElement extends ElementBase {
  type: "freehand";
  points: Point[];
}

export type CanvasElement =
  | RectangleElement
  | EllipseElement
  | DiamondElement
  | LineElement
  | ArrowElement
  | FreehandElement;

export type ElementType = CanvasElement["type"];

/**
 * Toolbar tools that create elements. Derived from both unions, so adding an
 * element type without a matching tool id (or vice versa) is a type error at
 * the `satisfies` below.
 */
export type DrawingToolId = Extract<ToolId, ElementType>;

const DRAWING_TOOLS: ReadonlySet<ToolId> = new Set([
  "rectangle",
  "ellipse",
  "diamond",
  "line",
  "arrow",
  "freehand",
] satisfies DrawingToolId[]);

export function isDrawingTool(tool: ToolId | undefined): tool is DrawingToolId {
  return tool !== undefined && DRAWING_TOOLS.has(tool);
}

export const DEFAULT_STYLE: ElementStyle = {
  strokeWidth: 2,
  fill: "transparent",
};
