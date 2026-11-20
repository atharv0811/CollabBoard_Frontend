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

/** Attaches a line/arrow end to a shape, so the end follows the shape when it moves. */
export interface Binding {
  elementId: string;
  /**
   * Where on the shape's outline the end is attached, as a fraction of the shape's bounds
   * (0,0 = top-left, 1,1 = bottom-right), so it stays on the same spot when the shape moves or
   * resizes. Without it the end points at the shape's centre.
   */
  anchor?: Point;
}

interface ConnectorEnds {
  start: Point;
  end: Point;
  startBinding?: Binding;
  endBinding?: Binding;
}

export interface LineElement extends ElementBase, ConnectorEnds {
  type: "line";
}

export interface ArrowElement extends ElementBase, ConnectorEnds {
  type: "arrow";
}

export interface FreehandElement extends ElementBase {
  type: "freehand";
  points: Point[];
}

export interface TextElement extends ElementBase {
  type: "text";
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
}

export interface ImageElement extends ElementBase {
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  /** Data URL of the image file. */
  src: string;
}

export type CanvasElement =
  | RectangleElement
  | EllipseElement
  | DiamondElement
  | LineElement
  | ArrowElement
  | FreehandElement
  | TextElement
  | ImageElement;

export type ElementType = CanvasElement["type"];

export type DrawingToolId = Extract<ToolId, "rectangle" | "ellipse" | "diamond" | "line" | "arrow" | "freehand">;

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
