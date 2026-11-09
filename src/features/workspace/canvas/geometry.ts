import type { Point } from "./elements";

/*
 * Pure geometry helpers — no React, no DOM. All values are world units.
 */

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Normalised box spanned by two corners dragged in any direction. */
export function boundsFromPoints(a: Point, b: Point): Bounds {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function ellipseFromBounds({ x, y, width, height }: Bounds) {
  return { cx: x + width / 2, cy: y + height / 2, rx: width / 2, ry: height / 2 };
}

/** Diamond vertices in order: top, right, bottom, left. */
export function diamondVertices({ x, y, width, height }: Bounds): [Point, Point, Point, Point] {
  const cx = x + width / 2;
  const cy = y + height / 2;
  return [
    { x: cx, y },
    { x: x + width, y: cy },
    { x: cx, y: y + height },
    { x, y: cy },
  ];
}

const ARROWHEAD_LENGTH = 14;
const ARROWHEAD_SPREAD = Math.PI / 7; // ≈ 25.7° each side of the shaft

/**
 * Open arrowhead at `end`, pointing along start → end: [wing, tip, wing].
 * Its length shrinks on short arrows so the head never overshoots the shaft.
 */
export function arrowheadPoints(start: Point, end: Point, strokeWidth: number): [Point, Point, Point] {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const length = Math.min(ARROWHEAD_LENGTH + strokeWidth * 2, distance(start, end) / 2);

  const wing = (offset: number): Point => ({
    x: end.x - length * Math.cos(angle + offset),
    y: end.y - length * Math.sin(angle + offset),
  });

  return [wing(ARROWHEAD_SPREAD), end, wing(-ARROWHEAD_SPREAD)];
}

/** True when `point` is far enough from the last recorded point to be worth keeping. */
export function shouldAppendPoint(points: readonly Point[], point: Point, minDistance: number): boolean {
  const last = points[points.length - 1];
  return !last || distance(last, point) >= minDistance;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** "x,y x,y …" for SVG polygon / polyline `points`. */
export function toSvgPoints(points: readonly Point[]): string {
  return points.map((p) => `${round(p.x)},${round(p.y)}`).join(" ");
}

/**
 * Smooth, continuous path through freehand points: quadratic curves whose
 * control points are the samples and whose end points are the midpoints
 * between samples. A single point renders as a dot.
 */
export function freehandPathData(points: readonly Point[]): string {
  const [first, ...rest] = points;
  if (!first) return "";
  if (rest.length === 0) return `M${round(first.x)} ${round(first.y)}h0.01`;

  let d = `M${round(first.x)} ${round(first.y)}`;
  for (let i = 0; i < rest.length - 1; i++) {
    const control = rest[i]!;
    const next = rest[i + 1]!;
    d += ` Q${round(control.x)} ${round(control.y)} ${round((control.x + next.x) / 2)} ${round((control.y + next.y) / 2)}`;
  }
  const last = rest[rest.length - 1]!;
  return `${d} L${round(last.x)} ${round(last.y)}`;
}

/** Bounding box of a point cloud (zero-sized for fewer than two points). */
export function boundsOfPoints(points: readonly Point[]): Bounds {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { x, y } of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
