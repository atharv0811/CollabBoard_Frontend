import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { createId } from "@/lib/createId";
import { createScreenToWorld } from "../canvas/coordinates";
import { elementFromDraft, startDraft, updateDraft, type DrawingDraft } from "../canvas/drafts";
import { isDrawingTool, type CanvasElement, type Point } from "../canvas/elements";
import { boundsFromPoints, distance, type Bounds } from "../canvas/geometry";
import { elementBounds, elementsInMarquee, hitTolerance, unionBounds } from "../canvas/hitTest";
import {
  cursorForDecision,
  decidePointerDown,
  handleHitRadius,
  isLinear,
  type CanvasCursor,
  type LinearElement,
} from "../canvas/selection";
import {
  mapElement,
  MIN_RESIZE_SIZE,
  moveEndpoint,
  resizeMap,
  translateElement,
  type EndpointId,
  type HandleId,
} from "../canvas/transform";
import { panBy, pinchViewport, type PinchStart, type Viewport } from "../canvas/viewport";
import { useWorkspaceStore } from "../store/workspaceStore";

type SvgPointerEvent = ReactPointerEvent<SVGSVGElement>;

/**
 * The single gesture in progress. Only its pointer(s) may update or finish it.
 * Transform gestures keep the untouched originals so every frame is computed
 * from the start of the drag and cancelling is free.
 */
type Gesture =
  | { kind: "draw"; pointerId: number; draft: DrawingDraft }
  | { kind: "move"; pointerId: number; origin: Point; originals: CanvasElement[]; previousSelection: string[] }
  | {
      kind: "resize";
      pointerId: number;
      origin: Point;
      handle: HandleId;
      bounds: Bounds;
      originals: CanvasElement[];
      /** Minimum size in world units, fixed for the whole drag */
      minSize: number;
    }
  | { kind: "endpoint"; pointerId: number; origin: Point; endpoint: EndpointId; original: LinearElement }
  | { kind: "marquee"; pointerId: number; origin: Point; baseSelection: string[]; previousSelection: string[] }
  /** Hand tool or middle mouse button. Client px, so it is independent of the changing viewport. */
  | { kind: "pan"; pointerId: number; startClient: Point; startViewport: Viewport }
  | { kind: "pinch"; pointerIds: [number, number]; start: PinchStart };

type TransformGesture = Extract<Gesture, { kind: "move" | "resize" | "endpoint" }>;

/** A touch on the canvas, in client px. */
interface TrackedTouch {
  x: number;
  y: number;
  startX: number;
  startY: number;
}

/**
 * A second finger turns the gesture into a pinch only while the first finger
 * has moved less than this (screen px). An established drawing / move is
 * protected from stray touches; a fresh two-finger contact becomes navigation.
 */
const PINCH_TAKEOVER_SLOP = 10;

const ownsPointer = (gesture: Gesture, pointerId: number) =>
  gesture.kind === "pinch" ? gesture.pointerIds.includes(pointerId) : gesture.pointerId === pointerId;

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

function transformedElements(gesture: TransformGesture, point: Point): CanvasElement[] {
  const dx = point.x - gesture.origin.x;
  const dy = point.y - gesture.origin.y;

  switch (gesture.kind) {
    case "move":
      return gesture.originals.map((element) => translateElement(element, dx, dy));
    case "resize": {
      const map = resizeMap(gesture.bounds, gesture.handle, dx, dy, gesture.minSize);
      return gesture.originals.map((element) => mapElement(element, map));
    }
    case "endpoint": {
      const from = gesture.original[gesture.endpoint];
      return [moveEndpoint(gesture.original, gesture.endpoint, { x: from.x + dx, y: from.y + dy })];
    }
  }
}

const toPreviewMap = (elements: readonly CanvasElement[]) => new Map(elements.map((element) => [element.id, element]));

/** Midpoint (canvas px) and distance of two tracked touches. */
function pinchMetrics(svg: SVGSVGElement, a: TrackedTouch, b: TrackedTouch) {
  const rect = svg.getBoundingClientRect();
  return {
    midpoint: { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top },
    distance: Math.hypot(b.x - a.x, b.y - a.y),
  };
}

export function useCanvasInteraction(svgRef: RefObject<SVGSVGElement | null>) {
  const [draft, setDraft] = useState<DrawingDraft | null>(null);
  const [preview, setPreview] = useState<Map<string, CanvasElement> | null>(null);
  const [marquee, setMarquee] = useState<Bounds | null>(null);
  const [cursor, setCursor] = useState<CanvasCursor>("default");
  const gestureRef = useRef<Gesture | null>(null);
  /** Every touch currently down on the canvas, whether or not it drives the gesture. */
  const touchesRef = useRef(new Map<number, TrackedTouch>());

  const clearTransient = useCallback(() => {
    gestureRef.current = null;
    setDraft(null);
    setPreview(null);
    setMarquee(null);
  }, []);

  /**
   * Drops the unfinished gesture without touching committed elements.
   * `restoreSelection` also undoes a selection made by its pointerdown
   * (used when a pinch takes over, so a pinch never selects anything).
   */
  const discardGesture = useCallback(
    (restoreSelection: boolean) => {
      const gesture = gestureRef.current;
      if (!gesture) return;
      if (gesture.kind === "marquee" || (restoreSelection && gesture.kind === "move")) {
        useWorkspaceStore.getState().setSelection(gesture.previousSelection);
      }
      clearTransient();
    },
    [clearTransient],
  );

  /** Discards the gesture and releases its pointer capture. */
  const abortGesture = useCallback(() => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    discardGesture(false); // cleared first, so the lostpointercapture below is ignored

    const svg = svgRef.current;
    const ids = gesture.kind === "pinch" ? gesture.pointerIds : [gesture.pointerId];
    for (const id of ids) if (svg?.hasPointerCapture(id)) svg.releasePointerCapture(id);
  }, [discardGesture, svgRef]);

  useEffect(
    () =>
      useWorkspaceStore.subscribe((state, previous) => {
        if (state.activeTool !== previous.activeTool) {
          abortGesture();
          setCursor(state.activeTool === "hand" ? "grab" : "default");
          return;
        }
        // The document changed under a move / resize / endpoint drag (e.g. Ctrl+Z
        // mid-drag). Its snapshot of the originals is stale, so committing it
        // would overwrite that change — cancel the drag instead. A gesture's own
        // commit can't trigger this: the gesture is cleared before it commits.
        const gesture = gestureRef.current;
        const transforms = gesture?.kind === "move" || gesture?.kind === "resize" || gesture?.kind === "endpoint";
        if (transforms && state.elements !== previous.elements) abortGesture();
      }),
    [abortGesture],
  );

  const gestureFor = (event: SvgPointerEvent) => {
    const gesture = gestureRef.current;
    return gesture && ownsPointer(gesture, event.pointerId) ? gesture : null;
  };

  /**
   * Selection decision at `point`. Tolerances are defined in screen px and
   * converted to world units here — the one place zoom affects hit testing.
   */
  const decide = (event: SvgPointerEvent, point: Point) => {
    const store = useWorkspaceStore.getState();
    const { zoom } = store.viewport;
    return decidePointerDown({
      elements: store.elements,
      selectedIds: store.selectedIds,
      point,
      shiftKey: event.shiftKey,
      tolerance: hitTolerance(event.pointerType) / zoom,
      handleRadius: handleHitRadius(event.pointerType) / zoom,
      zoom,
    });
  };

  const updateHoverCursor = (event: SvgPointerEvent) => {
    if (event.pointerType === "touch") return;
    const { activeTool } = useWorkspaceStore.getState();
    if (activeTool === "hand") return setCursor("grab");

    const point = worldSamples(event).at(-1);
    setCursor(point && activeTool === "selection" ? cursorForDecision(decide(event, point)) : "default");
  };

  function startSelectionGesture(event: SvgPointerEvent, point: Point): Gesture | null {
    const store = useWorkspaceStore.getState();
    const decision = decide(event, point);
    const { pointerId } = event;
    const byIds = (ids: readonly string[]) => store.elements.filter((element) => ids.includes(element.id));

    switch (decision.action) {
      case "endpoint": {
        const original = store.elements.find((element) => element.id === decision.elementId);
        if (!original || !isLinear(original)) return null;
        return { kind: "endpoint", pointerId, origin: point, endpoint: decision.endpoint, original };
      }
      case "resize": {
        const originals = byIds(decision.selectedIds);
        const bounds = unionBounds(originals.map(elementBounds));
        if (!bounds) return null;
        const minSize = MIN_RESIZE_SIZE / store.viewport.zoom;
        return { kind: "resize", pointerId, origin: point, handle: decision.handle, bounds, originals, minSize };
      }
      case "move": {
        const previousSelection = [...store.selectedIds];
        store.setSelection(decision.selectedIds);
        return { kind: "move", pointerId, origin: point, originals: byIds(decision.selectedIds), previousSelection };
      }
      case "select":
        store.setSelection(decision.selectedIds);
        return null;
      case "marquee": {
        const previousSelection = [...store.selectedIds];
        store.setSelection(decision.baseSelection);
        return { kind: "marquee", pointerId, origin: point, baseSelection: decision.baseSelection, previousSelection };
      }
    }
  }

  /** May a second finger turn `gesture` into a pinch? */
  function canHandOverToPinch(gesture: Gesture): boolean {
    if (gesture.kind === "pinch") return false;
    const touch = touchesRef.current.get(gesture.pointerId);
    if (!touch) return false; // mouse / pen gestures are never taken over
    if (gesture.kind === "pan") return true;
    return Math.hypot(touch.x - touch.startX, touch.y - touch.startY) < PINCH_TAKEOVER_SLOP;
  }

  /** Starts a two-finger pinch / pan from the two tracked touches. */
  function startPinch(svg: SVGSVGElement) {
    const entries = [...touchesRef.current.entries()];
    if (entries.length !== 2) return;
    const [[idA, a], [idB, b]] = entries as [[number, TrackedTouch], [number, TrackedTouch]];

    // Discard, don't abort: releasing the first finger's capture would fire a
    // lostpointercapture that ends the pinch we are about to start.
    discardGesture(true);
    for (const id of [idA, idB]) {
      try {
        if (!svg.hasPointerCapture(id)) svg.setPointerCapture(id);
      } catch {
        return; // a finger is already gone
      }
    }

    const { midpoint, distance: span } = pinchMetrics(svg, a, b);
    gestureRef.current = {
      kind: "pinch",
      pointerIds: [idA, idB],
      start: { viewport: useWorkspaceStore.getState().viewport, midpoint, distance: span },
    };
  }

  function updateGesture(gesture: Gesture, event: SvgPointerEvent) {
    if (gesture.kind === "pinch") {
      const [a, b] = gesture.pointerIds.map((id) => touchesRef.current.get(id));
      if (!a || !b) return;
      const { midpoint, distance: span } = pinchMetrics(event.currentTarget, a, b);
      useWorkspaceStore.getState().setViewport(pinchViewport(gesture.start, midpoint, span));
      return;
    }
    if (gesture.kind === "pan") {
      const dx = event.clientX - gesture.startClient.x;
      const dy = event.clientY - gesture.startClient.y;
      useWorkspaceStore.getState().setViewport(panBy(gesture.startViewport, dx, dy));
      return;
    }

    const samples = worldSamples(event);
    const point = samples[samples.length - 1];
    if (!point) return;

    switch (gesture.kind) {
      case "draw": {
        const next = updateDraft(gesture.draft, samples);
        if (next === gesture.draft) return;
        gesture.draft = next;
        setDraft(next);
        return;
      }
      case "marquee": {
        const box = boundsFromPoints(gesture.origin, point);
        const inside = elementsInMarquee(useWorkspaceStore.getState().elements, box);
        useWorkspaceStore.getState().setSelection([...gesture.baseSelection, ...inside]);
        setMarquee(box);
        return;
      }
      default:
        setPreview(toPreviewMap(transformedElements(gesture, point)));
    }
  }

  const trackTouch = (event: SvgPointerEvent) => {
    if (event.pointerType !== "touch") return;
    const touches = touchesRef.current;
    // A primary touch going down means no other finger is on the screen, so any
    // tracked touch is stale (its pointerup / pointercancel was never delivered).
    // Without this, one missed event would turn every later drawing into a pinch.
    if (event.type === "pointerdown" && event.isPrimary) touches.clear();
    const known = touches.get(event.pointerId);
    if (known) {
      known.x = event.clientX;
      known.y = event.clientY;
    } else {
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
    }
  };

  const forgetTouch = (event: SvgPointerEvent) => {
    touchesRef.current.delete(event.pointerId);
  };

  const onPointerDown = (event: SvgPointerEvent) => {
    trackTouch(event);
    const isTouch = event.pointerType === "touch";
    const svg = event.currentTarget;

    // A second finger: pinch if the first finger's gesture may hand over, otherwise ignore it.
    const current = gestureRef.current;
    if (current) {
      if (isTouch && touchesRef.current.size === 2 && canHandOverToPinch(current)) startPinch(svg);
      return;
    }
    if (isTouch && touchesRef.current.size === 2) {
      startPinch(svg); // the first finger started nothing (e.g. a tap that only selected)
      return;
    }
    if (isTouch && touchesRef.current.size > 2) return;

    const middleButton = event.pointerType === "mouse" && event.button === 1;
    if (event.pointerType === "mouse" && event.button !== 0 && !middleButton) return;

    const store = useWorkspaceStore.getState();
    const { activeTool } = store;
    let gesture: Gesture | null = null;

    if (middleButton || activeTool === "hand") {
      gesture = {
        kind: "pan",
        pointerId: event.pointerId,
        startClient: { x: event.clientX, y: event.clientY },
        startViewport: store.viewport,
      };
    } else {
      const [point] = worldSamples(event);
      if (!point) return;
      if (isDrawingTool(activeTool)) {
        gesture = { kind: "draw", pointerId: event.pointerId, draft: startDraft(activeTool, point) };
      } else if (activeTool === "selection") {
        updateHoverCursor(event);
        gesture = startSelectionGesture(event, point);
      }
    }
    if (!gesture) return;

    try {
      svg.setPointerCapture(event.pointerId);
    } catch {
      return;
    }

    gestureRef.current = gesture;
    if (gesture.kind === "draw") setDraft(gesture.draft);
    if (gesture.kind === "pan") setCursor("grabbing");
  };

  const onPointerMove = (event: SvgPointerEvent) => {
    if (event.pointerType === "touch" && touchesRef.current.has(event.pointerId)) trackTouch(event);

    const gesture = gestureFor(event);
    if (gesture) updateGesture(gesture, event);
    else if (!gestureRef.current) updateHoverCursor(event);
  };

  const onPointerLeave = () => {
    if (!gestureRef.current) setCursor(useWorkspaceStore.getState().activeTool === "hand" ? "grab" : "default");
  };

  function commitGesture(gesture: Gesture, samples: Point[]) {
    const store = useWorkspaceStore.getState();
    const point = samples[samples.length - 1];

    switch (gesture.kind) {
      case "draw": {
        const element = elementFromDraft(updateDraft(gesture.draft, samples), createId());
        if (element) store.addElement(element);
        return;
      }
      case "marquee":
      case "pan":
      case "pinch":
        return; // already applied live
      default: {
        if (!point || distance(point, gesture.origin) === 0) return;
        store.updateElements(transformedElements(gesture, point));
      }
    }
  }

  const onPointerUp = (event: SvgPointerEvent) => {
    forgetTouch(event);
    const gesture = gestureFor(event);
    if (!gesture) return;

    const samples = gesture.kind === "pan" || gesture.kind === "pinch" ? [] : worldSamples(event);
    clearTransient();
    commitGesture(gesture, samples);
    updateHoverCursor(event);
  };

  /** pointercancel: the finger is gone. Drop the unfinished gesture only. */
  const onPointerCancel = (event: SvgPointerEvent) => {
    forgetTouch(event);
    if (gestureFor(event)) abortGesture();
  };

  /** Capture lost before pointerup: drop the unfinished gesture only (the finger may still be down). */
  const onLostPointerCapture = (event: SvgPointerEvent) => {
    if (gestureFor(event)) abortGesture();
  };

  /** Stops the browser's middle-click autoscroll so middle-drag can pan. */
  const onMouseDown = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (event.button === 1) event.preventDefault();
  };

  return {
    draft,
    preview,
    marquee,
    cursor,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerLeave,
      onPointerCancel,
      onLostPointerCapture,
      onMouseDown,
    },
  };
}
