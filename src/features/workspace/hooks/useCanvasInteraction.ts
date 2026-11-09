import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { createId } from "@/lib/createId";
import { createScreenToWorld } from "../canvas/coordinates";
import { elementFromDraft, startDraft, updateDraft, type DrawingDraft } from "../canvas/drafts";
import { isDrawingTool, type CanvasElement, type Point } from "../canvas/elements";
import { boundsFromPoints, type Bounds } from "../canvas/geometry";
import { elementBounds, elementsInMarquee, hitTolerance, unionBounds } from "../canvas/hitTest";
import {
  cursorForDecision,
  decidePointerDown,
  handleHitRadius,
  isLinear,
  type CanvasCursor,
  type LinearElement,
} from "../canvas/selection";
import { mapElement, moveEndpoint, resizeMap, translateElement, type EndpointId, type HandleId } from "../canvas/transform";
import { useWorkspaceStore } from "../store/workspaceStore";

type SvgPointerEvent = ReactPointerEvent<SVGSVGElement>;

type Gesture =
  | { kind: "draw"; pointerId: number; draft: DrawingDraft }
  | { kind: "move"; pointerId: number; origin: Point; originals: CanvasElement[] }
  | { kind: "resize"; pointerId: number; origin: Point; handle: HandleId; bounds: Bounds; originals: CanvasElement[] }
  | { kind: "endpoint"; pointerId: number; origin: Point; endpoint: EndpointId; original: LinearElement }
  | { kind: "marquee"; pointerId: number; origin: Point; baseSelection: string[]; previousSelection: string[] };

type TransformGesture = Extract<Gesture, { kind: "move" | "resize" | "endpoint" }>;

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
      const map = resizeMap(gesture.bounds, gesture.handle, dx, dy);
      return gesture.originals.map((element) => mapElement(element, map));
    }
    case "endpoint": {
      const from = gesture.original[gesture.endpoint];
      return [moveEndpoint(gesture.original, gesture.endpoint, { x: from.x + dx, y: from.y + dy })];
    }
  }
}

const toPreviewMap = (elements: readonly CanvasElement[]) => new Map(elements.map((element) => [element.id, element]));

export function useCanvasInteraction(svgRef: RefObject<SVGSVGElement | null>) {
  const [draft, setDraft] = useState<DrawingDraft | null>(null);
  const [preview, setPreview] = useState<Map<string, CanvasElement> | null>(null);
  const [marquee, setMarquee] = useState<Bounds | null>(null);
  const [cursor, setCursor] = useState<CanvasCursor>("default");
  const gestureRef = useRef<Gesture | null>(null);

  const clearTransient = useCallback(() => {
    gestureRef.current = null;
    setDraft(null);
    setPreview(null);
    setMarquee(null);
  }, []);

  const abortGesture = useCallback(() => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    if (gesture.kind === "marquee") useWorkspaceStore.getState().setSelection(gesture.previousSelection);

    clearTransient();
    const svg = svgRef.current;
    if (svg?.hasPointerCapture(gesture.pointerId)) svg.releasePointerCapture(gesture.pointerId);
  }, [clearTransient, svgRef]);

  useEffect(
    () =>
      useWorkspaceStore.subscribe((state, previous) => {
        if (state.activeTool !== previous.activeTool) abortGesture();
      }),
    [abortGesture],
  );

  const gestureFor = (event: SvgPointerEvent) => {
    const gesture = gestureRef.current;
    return gesture && gesture.pointerId === event.pointerId ? gesture : null;
  };

  const decide = (event: SvgPointerEvent, point: Point) => {
    const store = useWorkspaceStore.getState();
    return decidePointerDown({
      elements: store.elements,
      selectedIds: store.selectedIds,
      point,
      shiftKey: event.shiftKey,
      tolerance: hitTolerance(event.pointerType),
      handleRadius: handleHitRadius(event.pointerType),
    });
  };

  const updateHoverCursor = (event: SvgPointerEvent) => {
    if (event.pointerType === "touch") return;
    const point = worldSamples(event).at(-1);
    const next =
      point && useWorkspaceStore.getState().activeTool === "selection"
        ? cursorForDecision(decide(event, point))
        : "default";
    setCursor(next);
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
        return { kind: "resize", pointerId, origin: point, handle: decision.handle, bounds, originals };
      }
      case "move":
        store.setSelection(decision.selectedIds);
        return { kind: "move", pointerId, origin: point, originals: byIds(decision.selectedIds) };
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

  function updateGesture(gesture: Gesture, samples: Point[]) {
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

  const onPointerDown = (event: SvgPointerEvent) => {
    if (gestureRef.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const [point] = worldSamples(event);
    if (!point) return;

    const { activeTool } = useWorkspaceStore.getState();
    let gesture: Gesture | null = null;
    if (isDrawingTool(activeTool)) {
      gesture = { kind: "draw", pointerId: event.pointerId, draft: startDraft(activeTool, point) };
    } else if (activeTool === "selection") {
      updateHoverCursor(event);
      gesture = startSelectionGesture(event, point);
    }
    if (!gesture) return;

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      return;
    }

    gestureRef.current = gesture;
    if (gesture.kind === "draw") setDraft(gesture.draft);
  };

  const onPointerMove = (event: SvgPointerEvent) => {
    const gesture = gestureFor(event);
    if (gesture) updateGesture(gesture, worldSamples(event));
    else if (!gestureRef.current) updateHoverCursor(event);
  };

  const onPointerLeave = () => {
    if (!gestureRef.current) setCursor("default");
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
        return;
      default: {
        if (!point || (point.x === gesture.origin.x && point.y === gesture.origin.y)) return;
        store.updateElements(transformedElements(gesture, point));
      }
    }
  }

  const onPointerUp = (event: SvgPointerEvent) => {
    const gesture = gestureFor(event);
    if (!gesture) return;

    const samples = worldSamples(event);
    clearTransient();
    commitGesture(gesture, samples);
    updateHoverCursor(event);
  };

  const onPointerAbort = (event: SvgPointerEvent) => {
    if (gestureFor(event)) abortGesture();
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
      onPointerCancel: onPointerAbort,
      onLostPointerCapture: onPointerAbort,
    },
  };
}
