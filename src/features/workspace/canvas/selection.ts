import type { CanvasElement, Point } from "./elements.ts";
import type { Bounds } from "./geometry.ts";
import { boundsContainPoint, elementBounds, topmostElementAt, unionBounds } from "./hitTest.ts";
import type { EndpointId, HandleId } from "./transform.ts";

/*
 * Pure selection logic: selection geometry, handle hit testing, and the
 * decision of what a pointerdown with the selection tool should start.
 * No React, no DOM — the interaction hook just executes the decision.
 */

/** Gap between the selected geometry and the drawn selection box. */
export const SELECTION_PADDING = 6;

export type LinearElement = Extract<CanvasElement, { type: "line" | "arrow" }>;

export const isLinear = (element: CanvasElement): element is LinearElement =>
  element.type === "line" || element.type === "arrow";

/** Handle hit radius per input type. Larger than the drawn handle so fingers can grab it. */
export function handleHitRadius(pointerType: string): number {
  return pointerType === "mouse" ? 8 : 18;
}

/** What the selection UI shows for the current selection. */
export type SelectionFrame =
  | { kind: "none" }
  /** A single line / arrow: two endpoint handles, no box handles */
  | { kind: "endpoints"; element: LinearElement }
  /** Anything else: one padded box with eight resize handles */
  | { kind: "box"; bounds: Bounds; frame: Bounds };

export function selectionFrame(selected: readonly CanvasElement[]): SelectionFrame {
  const [only] = selected;
  if (!only) return { kind: "none" };
  if (selected.length === 1 && isLinear(only)) return { kind: "endpoints", element: only };

  const bounds = unionBounds(selected.map(elementBounds))!;
  return { kind: "box", bounds, frame: padBounds(bounds, SELECTION_PADDING) };
}

export function padBounds(bounds: Bounds, padding: number): Bounds {
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
}

/** Handle positions on a frame. Corners first so they win over edges where they overlap. */
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

/** Edge handles are hidden on boxes too small to fit them without crowding the corners. */
const MIN_FRAME_FOR_EDGE_HANDLES = 32;

export function visibleHandles(frame: Bounds): [HandleId, Point][] {
  return handlePositions(frame).filter(([id]) => {
    if (id === "n" || id === "s") return frame.width >= MIN_FRAME_FOR_EDGE_HANDLES;
    if (id === "e" || id === "w") return frame.height >= MIN_FRAME_FOR_EDGE_HANDLES;
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

export function hitHandle(frame: Bounds, point: Point, radius: number): HandleId | null {
  return nearest(visibleHandles(frame), point, radius);
}

export function hitEndpoint(element: LinearElement, point: Point, radius: number): EndpointId | null {
  return nearest<EndpointId>([["start", element.start], ["end", element.end]], point, radius);
}

// ---------------------------------------------------------------- decisions

export interface PointerDownInput {
  elements: readonly CanvasElement[];
  selectedIds: readonly string[];
  point: Point;
  shiftKey: boolean;
  /** Stroke hit tolerance (see hitTolerance) */
  tolerance: number;
  /** Handle hit radius (see handleHitRadius) */
  handleRadius: number;
}

export type PointerDownDecision =
  | { action: "endpoint"; elementId: string; endpoint: EndpointId }
  | { action: "resize"; handle: HandleId; selectedIds: string[] }
  | { action: "move"; selectedIds: string[] }
  /** Selection changed (Shift-click removed an element); nothing to drag */
  | { action: "select"; selectedIds: string[] }
  | { action: "marquee"; baseSelection: string[] };

/**
 * What a selection-tool pointerdown should do, in priority order:
 *   1. a handle of the current selection   → resize / edit endpoint
 *   2. an element (topmost wins)
 *        Shift: toggle it in the selection; drag only if it is now selected
 *        else:  select it unless already selected, then move the selection
 *   3. inside the current selection's box  → move the selection
 *   4. empty canvas                        → marquee (Shift adds to the selection)
 */
export function decidePointerDown(input: PointerDownInput): PointerDownDecision {
  const { elements, selectedIds, point, shiftKey, tolerance, handleRadius } = input;
  const selected = elements.filter((element) => selectedIds.includes(element.id));
  const frame = selectionFrame(selected);

  if (frame.kind === "endpoints") {
    const endpoint = hitEndpoint(frame.element, point, handleRadius);
    if (endpoint) return { action: "endpoint", elementId: frame.element.id, endpoint };
  } else if (frame.kind === "box") {
    const handle = hitHandle(frame.frame, point, handleRadius);
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
    const box = frame.kind === "box" ? frame.frame : padBounds(elementBounds(frame.element), SELECTION_PADDING);
    if (boundsContainPoint(box, point)) return { action: "move", selectedIds: [...selectedIds] };
  }

  return { action: "marquee", baseSelection: shiftKey ? [...selectedIds] : [] };
}

// ---------------------------------------------------------------- cursors

export type CanvasCursor =
  | "default"
  | "move"
  | "grab"
  | "nwse-resize"
  | "nesw-resize"
  | "ns-resize"
  | "ew-resize";

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

/**
 * Cursor that previews what a pointerdown would do. Uses the same decision
 * as an actual press, so hover feedback can never disagree with the action.
 */
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
