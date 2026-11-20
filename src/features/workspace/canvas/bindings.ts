/**
 * Connectors: a line or arrow end can be bound to a shape. A bound end is never stored freely —
 * it is recomputed so it sits on the shape's outline (plus a small gap), aimed at the other end.
 * Moving or resizing a shape therefore drags every connector attached to it along.
 */
import type { Binding, CanvasElement, Point } from "./elements.ts";
import { diamondVertices } from "./geometry.ts";
import { boundsContainPoint, elementBounds } from "./hitTest.ts";
import { isLinear, type LinearElement } from "./selection.ts";
import type { EndpointId } from "./transform.ts";

export type BindableElement = Extract<CanvasElement, { type: "rectangle" | "ellipse" | "diamond" | "text" | "image" }>;

/** Distance (world units) between a shape's outline and a connector end bound to it. */
export const BINDING_GAP = 6;
/** How far outside a shape (screen pixels) a connector end still snaps to it. */
export const BINDING_SNAP_DISTANCE = 12;
/**
 * Ends dropped this close to a shape's centre (as a fraction of its size) are not pinned to a spot;
 * they keep pointing at the centre from whichever side the other end is on.
 */
export const CENTER_BINDING_RATIO = 0.2;

const BINDING_KEY = { start: "startBinding", end: "endBinding" } as const;

export const isBindable = (element: CanvasElement | undefined): element is BindableElement =>
  element !== undefined && !isLinear(element) && element.type !== "freehand";

export function bindingOf(element: LinearElement, end: EndpointId): Binding | undefined {
  return element[BINDING_KEY[end]];
}

const sameAnchor = (a: Point | undefined, b: Point | undefined) => a?.x === b?.x && a?.y === b?.y;

const sameBinding = (a: Binding | undefined, b: Binding | undefined) =>
  a?.elementId === b?.elementId && sameAnchor(a?.anchor, b?.anchor);

/** Sets or clears one end's binding without leaving `undefined` keys behind. */
export function withBinding<T extends LinearElement>(element: T, end: EndpointId, binding: Binding | null): T {
  const key = BINDING_KEY[end];
  if (sameBinding(element[key], binding ?? undefined)) return element;
  const next = { ...element };
  if (binding) next[key] = binding;
  else delete next[key];
  return next;
}

export function shapeCenter(shape: BindableElement): Point {
  const { x, y, width, height } = elementBounds(shape);
  return { x: x + width / 2, y: y + height / 2 };
}

/** Whether `point` lies inside `shape`, or within `padding` of it. */
export function shapeContains(shape: BindableElement, point: Point, padding: number): boolean {
  const c = shapeCenter(shape);
  const { width, height } = elementBounds(shape);
  const dx = Math.abs(point.x - c.x);
  const dy = Math.abs(point.y - c.y);
  const hw = width / 2 + padding;
  const hh = height / 2 + padding;
  if (hw <= 0 || hh <= 0) return false;

  switch (shape.type) {
    case "ellipse":
      return (dx / hw) ** 2 + (dy / hh) ** 2 <= 1;
    case "diamond":
      return dx / hw + dy / hh <= 1;
    default:
      return boundsContainPoint(elementBounds(shape), point, padding);
  }
}

/** Topmost shape at `point` that a connector end can bind to. */
export function bindableAt(
  elements: readonly CanvasElement[],
  point: Point,
  padding: number,
  exclude: ReadonlySet<string> = new Set(),
): BindableElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i];
    if (isBindable(element) && !exclude.has(element.id) && shapeContains(element, point, padding)) return element;
  }
  return null;
}

/** Point on the outline of `shape` (pushed out by `gap`) on the ray from its centre towards `toward`. */
export function edgePoint(shape: BindableElement, toward: Point, gap = BINDING_GAP): Point {
  const c = shapeCenter(shape);
  const { width, height } = elementBounds(shape);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return c;

  const hw = width / 2;
  const hh = height / 2;
  let t: number; // ray parameter (in units of (dx, dy)) where it crosses the outline
  switch (shape.type) {
    case "ellipse":
      t = hw > 0 && hh > 0 ? 1 / Math.hypot(dx / hw, dy / hh) : 0;
      break;
    case "diamond":
      t = hw > 0 && hh > 0 ? 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh) : 0;
      break;
    default:
      t = Math.min(dx === 0 ? Infinity : hw / Math.abs(dx), dy === 0 ? Infinity : hh / Math.abs(dy));
  }
  const reach = t + gap / length;
  return { x: c.x + dx * reach, y: c.y + dy * reach };
}

/** How far `point` is from the shape's centre, where 1 is on the outline (shape-specific norm). */
function normalizedDistance(shape: BindableElement, point: Point): number {
  const c = shapeCenter(shape);
  const { width, height } = elementBounds(shape);
  const nx = width > 0 ? Math.abs(point.x - c.x) / (width / 2) : 0;
  const ny = height > 0 ? Math.abs(point.y - c.y) / (height / 2) : 0;
  switch (shape.type) {
    case "ellipse":
      return Math.hypot(nx, ny);
    case "diamond":
      return nx + ny;
    default:
      return Math.max(nx, ny);
  }
}

/** The binding for an end dropped at `point` on `shape`: pinned to the outline spot it points at. */
export function bindingAt(shape: BindableElement, point: Point): Binding {
  if (normalizedDistance(shape, point) < CENTER_BINDING_RATIO) return { elementId: shape.id };
  const { x, y, width, height } = elementBounds(shape);
  const onOutline = edgePoint(shape, point, 0);
  return {
    elementId: shape.id,
    anchor: {
      x: width > 0 ? (onOutline.x - x) / width : 0.5,
      y: height > 0 ? (onOutline.y - y) / height : 0.5,
    },
  };
}

/** Position of a pinned end: the anchor on the outline, pushed out by the gap away from the centre. */
export function anchorPoint(shape: BindableElement, anchor: Point, gap = BINDING_GAP): Point {
  const { x, y, width, height } = elementBounds(shape);
  const point = { x: x + anchor.x * width, y: y + anchor.y * height };
  const c = shapeCenter(shape);
  const length = Math.hypot(point.x - c.x, point.y - c.y);
  if (length === 0) return point;
  return { x: point.x + ((point.x - c.x) / length) * gap, y: point.y + ((point.y - c.y) / length) * gap };
}

/** Outline of a box-like or diamond shape as a closed polygon. */
function outlinePolygon(shape: Exclude<BindableElement, { type: "ellipse" }>): Point[] {
  const bounds = elementBounds(shape);
  if (shape.type === "diamond") return diamondVertices(bounds);
  const { x, y, width, height } = bounds;
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

/** Smallest t in [0, 1] where the segment from → to meets the shape's outline, or null. */
export function firstOutlineHit(shape: BindableElement, from: Point, to: Point): number | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (shape.type === "ellipse") {
    if (shape.rx <= 0 || shape.ry <= 0) return null;
    // Solve |p + t·d| = 1 in the ellipse's unit-circle space.
    const px = (from.x - shape.cx) / shape.rx;
    const py = (from.y - shape.cy) / shape.ry;
    const qx = dx / shape.rx;
    const qy = dy / shape.ry;
    const a = qx * qx + qy * qy;
    const b = 2 * (px * qx + py * qy);
    const c = px * px + py * py - 1;
    const discriminant = b * b - 4 * a * c;
    if (a === 0 || discriminant < 0) return null;
    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    return t >= 0 && t <= 1 ? t : null;
  }

  const polygon = outlinePolygon(shape);
  let best: number | null = null;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const denominator = dx * ey - dy * ex;
    if (denominator === 0) continue;
    const t = ((a.x - from.x) * ey - (a.y - from.y) * ex) / denominator;
    const u = ((a.x - from.x) * dy - (a.y - from.y) * dx) / denominator;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && (best === null || t < best)) best = t;
  }
  return best;
}

/**
 * A pinned spot counts as "behind" its shape when the connector arrives more than this far round
 * from the spot's outward direction (cos 120°). Spots that are merely at an angle keep their pin,
 * even if the line grazes the shape on the way.
 */
const BEHIND_SHAPE_COS = -0.5;

/**
 * Where a pinned end should be drawn when the connector comes from `from`: on its anchor, unless the
 * anchor is behind the shape (the line would cut across it), in which case it stops where it enters.
 */
export function visibleAnchorPoint(shape: BindableElement, anchor: Point, from: Point, gap = BINDING_GAP): Point {
  const pinnedPoint = anchorPoint(shape, anchor, gap);
  if (shapeContains(shape, from, 0)) return pinnedPoint; // overlapping shapes: nothing sensible to avoid

  const target = anchorPoint(shape, anchor, 0);
  const c = shapeCenter(shape);
  const outX = target.x - c.x;
  const outY = target.y - c.y;
  const toFromX = from.x - target.x;
  const toFromY = from.y - target.y;
  const norms = Math.hypot(outX, outY) * Math.hypot(toFromX, toFromY);
  if (norms === 0 || (outX * toFromX + outY * toFromY) / norms >= BEHIND_SHAPE_COS) return pinnedPoint;

  const length = Math.hypot(target.x - from.x, target.y - from.y);
  const t = firstOutlineHit(shape, from, target);
  // Entering within half a unit of the anchor means the anchor itself faces `from`.
  if (t === null || length === 0 || (1 - t) * length <= 0.5) return pinnedPoint;

  const back = Math.max(0, t - gap / length);
  return { x: from.x + (target.x - from.x) * back, y: from.y + (target.y - from.y) * back };
}

/**
 * Binds the given ends of a connector to whatever shape they rest on (or unbinds them).
 * Both ends never bind to the same shape.
 */
export function bindEnds<T extends LinearElement>(
  element: T,
  elements: readonly CanvasElement[],
  padding: number,
  ends: readonly EndpointId[] = ["start", "end"],
): T {
  let next = element;
  for (const end of ends) {
    const other = bindingOf(next, end === "start" ? "end" : "start");
    const exclude = new Set([element.id, ...(other ? [other.elementId] : [])]);
    const target = bindableAt(elements, next[end], padding, exclude);
    next = withBinding(next, end, target ? bindingAt(target, next[end]) : null);
  }
  return next;
}

/** Drops bindings to shapes that are not in `kept` (used when a connector moves without its shapes). */
export function detachFrom<T extends CanvasElement>(element: T, kept: ReadonlySet<string>): T {
  if (!isLinear(element)) return element;
  let next: LinearElement = element;
  for (const end of ["start", "end"] as const) {
    const binding = bindingOf(next, end);
    if (binding && !kept.has(binding.elementId)) next = withBinding(next, end, null);
  }
  return next as T;
}

const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

function resolveConnector(element: LinearElement, byId: ReadonlyMap<string, CanvasElement>): LinearElement {
  let next = element;
  const shapes = { start: null as BindableElement | null, end: null as BindableElement | null };
  for (const end of ["start", "end"] as const) {
    const binding = bindingOf(next, end);
    if (!binding) continue;
    const shape = byId.get(binding.elementId);
    if (isBindable(shape)) shapes[end] = shape;
    else next = withBinding(next, end, null); // the shape was deleted
  }

  // Pinned ends sit on their anchor; centre-bound ends aim at the other end.
  const pinned = (end: EndpointId) => {
    const shape = shapes[end];
    const anchor = bindingOf(next, end)?.anchor;
    return shape && anchor ? anchorPoint(shape, anchor) : null;
  };
  const pinnedStart = pinned("start");
  const pinnedEnd = pinned("end");
  const startRef = pinnedStart ?? (shapes.start ? shapeCenter(shapes.start) : next.start);
  const endRef = pinnedEnd ?? (shapes.end ? shapeCenter(shapes.end) : next.end);

  // A pinned spot on the far side of its shape would make the connector cut through the shape;
  // stop at the near side instead (still heading for the spot).
  const visible = (end: EndpointId, from: Point): Point | null => {
    const shape = shapes[end];
    const anchor = bindingOf(next, end)?.anchor;
    return shape && anchor ? visibleAnchorPoint(shape, anchor, from) : null;
  };
  const start = visible("start", endRef) ?? (shapes.start ? edgePoint(shapes.start, endRef) : next.start);
  const end = visible("end", startRef) ?? (shapes.end ? edgePoint(shapes.end, startRef) : next.end);

  if (samePoint(start, next.start) && samePoint(end, next.end)) return next;
  return { ...next, start, end };
}

/** Re-positions every bound connector end. Returns the same array (and elements) when nothing moved. */
export function resolveBindings(elements: CanvasElement[]): CanvasElement[] {
  let byId: Map<string, CanvasElement> | null = null;
  let changed = false;
  const next = elements.map((element) => {
    if (!isLinear(element) || (!element.startBinding && !element.endBinding)) return element;
    byId ??= new Map(elements.map((candidate) => [candidate.id, candidate]));
    const resolved = resolveConnector(element, byId);
    if (resolved !== element) changed = true;
    return resolved;
  });
  return changed ? next : elements;
}

/** Ids of the shapes a connector is attached to. */
export function boundShapeIds(element: CanvasElement | null | undefined): string[] {
  if (!element || !isLinear(element)) return [];
  return [element.startBinding?.elementId, element.endBinding?.elementId].filter((id): id is string => !!id);
}
