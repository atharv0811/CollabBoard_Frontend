import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createId } from "@/lib/createId";
import { createScreenToWorld } from "../canvas/coordinates";
import { elementFromDraft, startDraft, updateDraft, type DrawingDraft } from "../canvas/drafts";
import { isDrawingTool, type CanvasElement, type Point } from "../canvas/elements";
import type { ToolId } from "../data/tools";

type SvgPointerEvent = ReactPointerEvent<SVGSVGElement>;

/** The gesture currently drawing. Only its pointer may update or finish it. */
interface ActiveGesture {
  pointerId: number;
  draft: DrawingDraft;
}

/** Pointer samples for this event in world coordinates, including coalesced ones. */
function worldSamples(event: SvgPointerEvent): Point[] {
  const toWorld = createScreenToWorld(event.currentTarget);
  if (!toWorld) return [];

  const native = event.nativeEvent;
  const coalesced = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
  const sources = coalesced.length > 0 ? coalesced : [native];

  const samples: Point[] = [];
  for (const source of sources) {
    const point = toWorld(source.clientX, source.clientY);
    if (point) samples.push(point);
  }
  return samples;
}

/**
 * Shared drawing lifecycle for every shape tool:
 *   pointerdown  → start a draft (primary button only, one gesture at a time)
 *   pointermove  → update the draft (same pointer only)
 *   pointerup    → commit the element (same pointer only, exactly once)
 *   pointercancel / lostpointercapture → discard the draft only
 *
 * The active gesture lives in a ref, so every check is synchronous and can
 * never act on stale render state — a second pointerup, or the
 * lostpointercapture that follows every pointerup, finds no gesture and
 * does nothing. React state holds only what has to render: the committed
 * elements and the draft preview.
 */
export function useDrawingInteraction(activeTool: ToolId | undefined) {
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [draft, setDraft] = useState<DrawingDraft | null>(null);
  const gestureRef = useRef<ActiveGesture | null>(null);

  /** Returns the active gesture if this event belongs to it. */
  const gestureFor = (event: SvgPointerEvent) => {
    const gesture = gestureRef.current;
    return gesture && gesture.pointerId === event.pointerId ? gesture : null;
  };

  const endGesture = () => {
    gestureRef.current = null;
    setDraft(null);
  };

  const onPointerDown = (event: SvgPointerEvent) => {
    if (gestureRef.current) return; // a drawing is already in progress — ignore extra pointers
    if (!isDrawingTool(activeTool)) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const [point] = worldSamples(event);
    if (!point) return;

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      return; // the pointer is no longer active (e.g. already released)
    }

    const next = startDraft(activeTool, point);
    gestureRef.current = { pointerId: event.pointerId, draft: next };
    setDraft(next);
  };

  const onPointerMove = (event: SvgPointerEvent) => {
    const gesture = gestureFor(event);
    if (!gesture) return;

    const next = updateDraft(gesture.draft, worldSamples(event));
    if (next === gesture.draft) return; // nothing visible changed — skip the render

    gesture.draft = next;
    setDraft(next);
  };

  const onPointerUp = (event: SvgPointerEvent) => {
    const gesture = gestureFor(event);
    if (!gesture) return;

    const finalDraft = updateDraft(gesture.draft, worldSamples(event));
    endGesture(); // cleared before committing, so nothing can commit twice

    const element = elementFromDraft(finalDraft, createId());
    if (element) setElements((previous) => [...previous, element]);
  };

  /** pointercancel, or capture lost before pointerup: drop the unfinished drawing only. */
  const onPointerAbort = (event: SvgPointerEvent) => {
    if (gestureFor(event)) endGesture();
  };

  return {
    elements,
    draft,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerAbort,
      onLostPointerCapture: onPointerAbort,
    },
  };
}
