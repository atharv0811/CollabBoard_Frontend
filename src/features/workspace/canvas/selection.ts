import type { CanvasElement, Point } from "./elements.ts";
import type { Bounds } from "./geometry.ts";
import { boundsContainPoint, elementBounds, topmostElementAt, unionBounds } from "./hitTest.ts";
import type { EndpointId, HandleId } from "./transform.ts";

export const SELECTION_PADDING = 6;

export type LinearElement = Extract<CanvasElement, { type: "line" | "arrow" }>;

export const isLinear = (element: CanvasElement): element is LinearElement =>
  element.type === "line" || element.type === "arrow";

export function handleHitRadius(pointerType: string): number {
  return pointerType === "mouse" ? 8 : 18;
}

export type SelectionFrame =
  { kind: "none" } | { kind: "endpoints"; element: LinearElement } | { kind: "box"; bounds: Bounds; frame: Bounds };

/** `zoom` keeps the padding a constant size on screen. */
export function selectionFrame(selected: readonly CanvasElement[], zoom = 1): SelectionFrame {
  const [only] = selected;
  if (!only) return { kind: "none" };
  if (selected.length === 1 && isLinear(only)) return { kind: "endpoints", element: only };

  const bounds = unionBounds(selected.map(elementBounds))!;
  return { kind: "box", bounds, frame: padBounds(bounds, SELECTION_PADDING / zoom) };
}

export function padBounds(bounds: Bounds, padding: number): Bounds {
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
}

export function handlePositions(frame: Bounds): [HandleId, Point][] {
  const { x, y, width, height } = frame;
  const cx = x + width / 2;
  const cy = y + height / 2;
  return [
    ["nw", { x, y }],
    ["ne", { x: x + width, y }],
    ["se", { x: x + width, y: y + height }],
    ["sw", { x, y: y + height }],
    ["n", { x: cx, y }],
    ["e", { x: x + width, y: cy }],
    ["s", { x: cx, y: y + height }],
    ["w", { x, y: cy }],
  ];
}

const MIN_FRAME_FOR_EDGE_HANDLES = 32;

export function visibleHandles(frame: Bounds, zoom = 1): [HandleId, Point][] {
  const minSize = MIN_FRAME_FOR_EDGE_HANDLES / zoom;
  return handlePositions(frame).filter(([id]) => {
    if (id === "n" || id === "s") return frame.width >= minSize;
    if (id === "e" || id === "w") return frame.height >= minSize;
    return true;
  });
}

function nearest<T>(candidates: [T, Point][], point: Point, radius: number): T | null {
  let best: T | null = null;
  let bestDistance = radius;
  for (const [id, position] of candidates) {
    const d = Math.hypot(point.x - position.x, point.y - position.y);
    if (d <= bestDistance) {
      best = id;
      bestDistance = d;
    }
  }
  return best;
}

export function hitHandle(frame: Bounds, point: Point, radius: number, zoom = 1): HandleId | null {
  return nearest(visibleHandles(frame, zoom), point, radius);
}

export function hitEndpoint(element: LinearElement, point: Point, radius: number): EndpointId | null {
  return nearest<EndpointId>(
    [
      ["start", element.start],
      ["end", element.end],
    ],
    point,
    radius,
  );
}

export interface PointerDownInput {
  elements: readonly CanvasElement[];
  selectedIds: readonly string[];
  point: Point;
  shiftKey: boolean;
  tolerance: number;
  handleRadius: number;
  zoom?: number;
}

export type PointerDownDecision =
  | { action: "endpoint"; elementId: string; endpoint: EndpointId }
  | { action: "resize"; handle: HandleId; selectedIds: string[] }
  | { action: "move"; selectedIds: string[] }
  | { action: "select"; selectedIds: string[] }
  | { action: "marquee"; baseSelection: string[] };

export function decidePointerDown(input: PointerDownInput): PointerDownDecision {
  const { elements, selectedIds, point, shiftKey, tolerance, handleRadius, zoom = 1 } = input;
  const selected = elements.filter((element) => selectedIds.includes(element.id));
  const frame = selectionFrame(selected, zoom);

  if (frame.kind === "endpoints") {
    const endpoint = hitEndpoint(frame.element, point, handleRadius);
    if (endpoint) return { action: "endpoint", elementId: frame.element.id, endpoint };
  } else if (frame.kind === "box") {
    const handle = hitHandle(frame.frame, point, handleRadius, zoom);
    if (handle) return { action: "resize", handle, selectedIds: [...selectedIds] };
  }

  const hit = topmostElementAt(elements, point, tolerance);
  if (hit) {
    const isSelected = selectedIds.includes(hit.id);
    if (shiftKey) {
      return isSelected
        ? { action: "select", selectedIds: selectedIds.filter((id) => id !== hit.id) }
        : { action: "move", selectedIds: [...selectedIds, hit.id] };
    }
    return { action: "move", selectedIds: isSelected ? [...selectedIds] : [hit.id] };
  }

  if (!shiftKey && frame.kind !== "none") {
    const box = frame.kind === "box" ? frame.frame : padBounds(elementBounds(frame.element), SELECTION_PADDING / zoom);
    if (boundsContainPoint(box, point)) return { action: "move", selectedIds: [...selectedIds] };
  }

  return { action: "marquee", baseSelection: shiftKey ? [...selectedIds] : [] };
}

export type CanvasCursor =
  "default" | "move" | "grab" | "grabbing" | "nwse-resize" | "nesw-resize" | "ns-resize" | "ew-resize";

const HANDLE_CURSORS: Record<HandleId, CanvasCursor> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
};

export function cursorForDecision(decision: PointerDownDecision): CanvasCursor {
  switch (decision.action) {
    case "resize":
      return HANDLE_CURSORS[decision.handle];
    case "endpoint":
      return "grab";
    case "move":
      return "move";
    case "select":
    case "marquee":
      return "default";
  }
}
