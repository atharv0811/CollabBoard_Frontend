import type { ToolId } from "../data/tools";

export interface Point {
  x: number;
  y: number;
}

export interface ElementStyle {
  strokeWidth: number;
  fill: string;
}

interface ElementBase {
  id: string;
  style: ElementStyle;
}

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

export interface DiamondElement extends ElementBase {
  type: "diamond";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LineElement extends ElementBase {
  type: "line";
  start: Point;
  end: Point;
}

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
  RectangleElement | EllipseElement | DiamondElement | LineElement | ArrowElement | FreehandElement;

export type ElementType = CanvasElement["type"];

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
