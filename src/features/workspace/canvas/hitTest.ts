import type { CanvasElement, Point } from "./elements.ts";
import { arrowheadPoints, boundsFromPoints, boundsOfPoints, diamondVertices, type Bounds } from "./geometry.ts";

export function hitTolerance(pointerType: string): number {
  return pointerType === "mouse" ? 6 : 12;
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distanceToPolyline(p: Point, points: readonly Point[], closed = false): number {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return Math.hypot(p.x - points[0]!.x, p.y - points[0]!.y);

  let best = Infinity;
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    best = Math.min(best, distanceToSegment(p, points[i]!, points[(i + 1) % points.length]!));
  }
  return best;
}

function insidePolygon(p: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

const ELLIPSE_SEGMENTS = 64;

function ellipseOutline(cx: number, cy: number, rx: number, ry: number): Point[] {
  return Array.from({ length: ELLIPSE_SEGMENTS }, (_, i) => {
    const angle = (i / ELLIPSE_SEGMENTS) * Math.PI * 2;
    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  });
}

function rectangleOutline({ x, y, width, height }: Bounds): Point[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

const isFilled = (element: CanvasElement) => element.style.fill !== "transparent" && element.style.fill !== "none";

export function hitTestElement(element: CanvasElement, point: Point, tolerance: number): boolean {
  const reach = element.style.strokeWidth / 2 + tolerance;

  const closedShape = (outline: Point[]) =>
    distanceToPolyline(point, outline, true) <= reach || (isFilled(element) && insidePolygon(point, outline));

  switch (element.type) {
    case "rectangle":
      return closedShape(rectangleOutline(element));
    case "diamond":
      return closedShape(diamondVertices(element));
    case "ellipse":
      return closedShape(ellipseOutline(element.cx, element.cy, element.rx, element.ry));
    case "line":
      return distanceToSegment(point, element.start, element.end) <= reach;
    case "arrow": {
      if (distanceToSegment(point, element.start, element.end) <= reach) return true;
      return distanceToPolyline(point, arrowheadPoints(element.start, element.end, element.style.strokeWidth)) <= reach;
    }
    case "freehand":
      return distanceToPolyline(point, element.points) <= reach;
    case "text":
    case "image":
      return boundsContainPoint(element, point, tolerance);
  }
}

export function topmostElementAt(
  elements: readonly CanvasElement[],
  point: Point,
  tolerance: number,
): CanvasElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i]!;
    if (hitTestElement(element, point, tolerance)) return element;
  }
  return null;
}

export function elementBounds(element: CanvasElement): Bounds {
  switch (element.type) {
    case "rectangle":
    case "diamond":
    case "text":
    case "image":
      return { x: element.x, y: element.y, width: element.width, height: element.height };
    case "ellipse":
      return { x: element.cx - element.rx, y: element.cy - element.ry, width: element.rx * 2, height: element.ry * 2 };
    case "line":
    case "arrow":
      return boundsFromPoints(element.start, element.end);
    case "freehand":
      return boundsOfPoints(element.points);
  }
}

export function unionBounds(boxes: readonly Bounds[]): Bounds | null {
  if (boxes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function boundsContainPoint(bounds: Bounds, point: Point, padding = 0): boolean {
  return (
    point.x >= bounds.x - padding &&
    point.x <= bounds.x + bounds.width + padding &&
    point.y >= bounds.y - padding &&
    point.y <= bounds.y + bounds.height + padding
  );
}

export function boundsContain(outer: Bounds, inner: Bounds): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

export function elementsInMarquee(elements: readonly CanvasElement[], marquee: Bounds): string[] {
  return elements.filter((element) => boundsContain(marquee, elementBounds(element))).map((element) => element.id);
}
