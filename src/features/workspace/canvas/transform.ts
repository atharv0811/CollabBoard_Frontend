import { MIN_STROKE_LENGTH } from "./drafts.ts";
import type { CanvasElement, Point } from "./elements.ts";
import { boundsFromPoints, distance, ellipseFromBounds, type Bounds } from "./geometry.ts";

export type PointMap = (point: Point) => Point;

export function mapElement<T extends CanvasElement>(element: T, map: PointMap): T {
  switch (element.type) {
    case "rectangle":
    case "diamond": {
      const a = map({ x: element.x, y: element.y });
      const b = map({ x: element.x + element.width, y: element.y + element.height });
      return { ...element, ...boundsFromPoints(a, b) };
    }
    case "ellipse": {
      const a = map({ x: element.cx - element.rx, y: element.cy - element.ry });
      const b = map({ x: element.cx + element.rx, y: element.cy + element.ry });
      return { ...element, ...ellipseFromBounds(boundsFromPoints(a, b)) };
    }
    case "line":
    case "arrow":
      return { ...element, start: map(element.start), end: map(element.end) };
    case "freehand":
      return { ...element, points: element.points.map(map) };
  }
}

export function translateElement<T extends CanvasElement>(element: T, dx: number, dy: number): T {
  return mapElement(element, (p) => ({ x: p.x + dx, y: p.y + dy }));
}

export type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const MIN_RESIZE_SIZE = 8;

interface AxisScale {
  anchor: number;
  scale: number;
}

function axisScale(anchor: number, originalMoving: number, delta: number, minSize: number): AxisScale {
  const originalSpan = originalMoving - anchor;
  if (originalSpan === 0) return { anchor, scale: 1 };

  let span = originalSpan + delta;
  const limit = Math.min(minSize, Math.abs(originalSpan));
  if (Math.abs(span) < limit) span = (Math.sign(span) || Math.sign(originalSpan)) * limit;

  return { anchor, scale: span / originalSpan };
}

export function resizeMap(
  bounds: Bounds,
  handle: HandleId,
  dx: number,
  dy: number,
  minSize = MIN_RESIZE_SIZE,
): PointMap {
  const left = bounds.x;
  const right = bounds.x + bounds.width;
  const top = bounds.y;
  const bottom = bounds.y + bounds.height;

  const horizontal = handle.includes("w")
    ? axisScale(right, left, dx, minSize)
    : handle.includes("e")
      ? axisScale(left, right, dx, minSize)
      : { anchor: left, scale: 1 };

  const vertical = handle.includes("n")
    ? axisScale(bottom, top, dy, minSize)
    : handle.includes("s")
      ? axisScale(top, bottom, dy, minSize)
      : { anchor: top, scale: 1 };

  return (p) => ({
    x: horizontal.anchor + (p.x - horizontal.anchor) * horizontal.scale,
    y: vertical.anchor + (p.y - vertical.anchor) * vertical.scale,
  });
}

export type EndpointId = "start" | "end";

export function moveEndpoint<T extends Extract<CanvasElement, { type: "line" | "arrow" }>>(
  element: T,
  endpoint: EndpointId,
  point: Point,
): T {
  const other = endpoint === "start" ? element.end : element.start;
  if (distance(point, other) < MIN_STROKE_LENGTH) return element;
  return { ...element, [endpoint]: point };
}
