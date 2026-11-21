import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { flushSync } from "react-dom";
import { createId } from "@/lib/createId";
import { BINDING_SNAP_DISTANCE, bindEnds, boundShapeIds, detachFrom } from "../canvas/bindings";
import { createScreenToWorld } from "../canvas/coordinates";
import { elementFromDraft, startDraft, updateDraft, type DrawingDraft } from "../canvas/drafts";
import { isDrawingTool, type CanvasElement, type Point } from "../canvas/elements";
import { boundsFromPoints, distance, type Bounds } from "../canvas/geometry";
import {
  elementBounds,
  elementsInMarquee,
  hitTestElement,
  hitTolerance,
  topmostElementAt,
  unionBounds,
} from "../canvas/hitTest";
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
  type EndpointId,
  type HandleId,
} from "../canvas/transform";
import { createTextElement, TEXT_FONT_SIZE, TEXT_LINE_HEIGHT, withText } from "../canvas/text";
import { panBy, pinchViewport, type PinchStart, type Viewport } from "../canvas/viewport";
import { useWorkspaceStore } from "../store/workspaceStore";

type SvgPointerEvent = ReactPointerEvent<SVGSVGElement>;

type Gesture =
  | { kind: "draw"; pointerId: number; draft: DrawingDraft }
  | {
      kind: "move";
      pointerId: number;
      origin: Point;
      originals: CanvasElement[];
      previousSelection: string[];
    }
  | {
      kind: "resize";
      pointerId: number;
      origin: Point;
      handle: HandleId;
      bounds: Bounds;
      originals: CanvasElement[];
      minSize: number;
    }
  | {
      kind: "endpoint";
      pointerId: number;
      origin: Point;
      endpoint: EndpointId;
      original: LinearElement;
    }
  | {
      kind: "marquee";
      pointerId: number;
      origin: Point;
      baseSelection: string[];
      previousSelection: string[];
    }
  | {
      kind: "pan";
      pointerId: number;
      startClient: Point;
      startViewport: Viewport;
    }
  | { kind: "pinch"; pointerIds: [number, number]; start: PinchStart }
  | { kind: "erase"; pointerId: number; last: Point; tolerance: number; ids: Set<string> };

/** An open text editor. `isNew` is false while editing an existing text element. */
export interface TextEdit {
  id: string;
  isNew: boolean;
  x: number;
  y: number;
  fontSize: number;
  text: string;
}

export interface CanvasInteractionOptions {
  /** Called when the image tool is used on the canvas, with the world point to place the image at. */
  onImageRequest?: (point: Point) => void;
}

type TransformGesture = Extract<Gesture, { kind: "move" | "resize" | "endpoint" }>;

interface TrackedTouch {
  x: number;
  y: number;
  startX: number;
  startY: number;
}

const PINCH_TAKEOVER_SLOP = 10;
const PREVIEW_ID = "preview";
const ERASER_TOLERANCE_FACTOR = 1.5;

/** Adds every element touched along the path from the last eraser point through `samples`. */
function eraseAlong(gesture: Extract<Gesture, { kind: "erase" }>, samples: readonly Point[]): boolean {
  const { elements } = useWorkspaceStore.getState();
  const step = Math.max(gesture.tolerance, 0.5);
  let changed = false;

  for (const sample of samples) {
    const from = gesture.last;
    const count = Math.max(1, Math.ceil(distance(from, sample) / step));
    for (let i = 1; i <= count; i++) {
      const t = i / count;
      const point = { x: from.x + (sample.x - from.x) * t, y: from.y + (sample.y - from.y) * t };
      for (const element of elements) {
        if (!gesture.ids.has(element.id) && hitTestElement(element, point, gesture.tolerance)) {
          gesture.ids.add(element.id);
          changed = true;
        }
      }
    }
    gesture.last = sample;
  }
  return changed;
}

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

/** Snap distance for connector ends, in world units at the current zoom. */
const bindingPadding = () => BINDING_SNAP_DISTANCE / useWorkspaceStore.getState().viewport.zoom;

/** Binds a freshly drawn line/arrow to the shapes its ends rest on. */
function bindDrawn(element: CanvasElement | null): CanvasElement | null {
  if (!element || !isLinear(element)) return element;
  return bindEnds(element, useWorkspaceStore.getState().elements, bindingPadding());
}

function transformedElements(gesture: TransformGesture, point: Point): CanvasElement[] {
  const dx = point.x - gesture.origin.x;
  const dy = point.y - gesture.origin.y;

  switch (gesture.kind) {
    case "move":
    case "resize": {
      const map =
        gesture.kind === "move"
          ? (p: Point) => ({ x: p.x + dx, y: p.y + dy })
          : resizeMap(gesture.bounds, gesture.handle, dx, dy, gesture.minSize);
      // A connector moved without the shape it is attached to lets go of that shape.
      const moving = new Set(gesture.originals.map((element) => element.id));
      return gesture.originals.map((element) => detachFrom(mapElement(element, map), moving));
    }
    case "endpoint": {
      const from = gesture.original[gesture.endpoint];
      const moved = moveEndpoint(gesture.original, gesture.endpoint, {
        x: from.x + dx,
        y: from.y + dy,
      });
      return [bindEnds(moved, useWorkspaceStore.getState().elements, bindingPadding(), [gesture.endpoint])];
    }
  }
}

const toPreviewMap = (elements: readonly CanvasElement[]) => new Map(elements.map((element) => [element.id, element]));

interface QueuedPointerMove {
  gesture: Gesture;
  svg: SVGSVGElement;
  worldPoints: Point[];
  clientX: number;
  clientY: number;
}

function pinchMetrics(svg: SVGSVGElement, a: TrackedTouch, b: TrackedTouch) {
  const rect = svg.getBoundingClientRect();
  return {
    midpoint: { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top },
    distance: Math.hypot(b.x - a.x, b.y - a.y),
  };
}

export function useCanvasInteraction(svgRef: RefObject<SVGSVGElement | null>, options: CanvasInteractionOptions = {}) {
  const [draftElement, setDraftElement] = useState<CanvasElement | null>(null);
  const setDraft = useCallback(
    (draft: DrawingDraft | null) => setDraftElement(draft ? bindDrawn(elementFromDraft(draft, PREVIEW_ID)) : null),
    [],
  );
  const [erasing, setErasing] = useState<ReadonlySet<string> | null>(null);
  const [textEdit, setTextEdit] = useState<TextEdit | null>(null);
  const textEditRef = useRef<TextEdit | null>(null);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });
  const [preview, setPreview] = useState<Map<string, CanvasElement> | null>(null);
  const [marquee, setMarquee] = useState<Bounds | null>(null);
  const [cursor, setCursor] = useState<CanvasCursor>("default");
  const gestureRef = useRef<Gesture | null>(null);

  // Shapes the connector being drawn or re-attached will connect to, for highlighting.
  const bindTargets = useMemo(() => {
    const [single] = preview?.size === 1 ? preview.values() : [];
    return [...boundShapeIds(draftElement), ...boundShapeIds(single)];
  }, [draftElement, preview]);
  const touchesRef = useRef(new Map<number, TrackedTouch>());
  const queuedPointerMoveRef = useRef<QueuedPointerMove | null>(null);
  const pointerMoveFrameIdRef = useRef<number | null>(null);

  const cancelQueuedPointerMove = useCallback(() => {
    if (pointerMoveFrameIdRef.current !== null) cancelAnimationFrame(pointerMoveFrameIdRef.current);
    pointerMoveFrameIdRef.current = null;
    queuedPointerMoveRef.current = null;
  }, []);

  useEffect(() => cancelQueuedPointerMove, [cancelQueuedPointerMove]);

  const clearTransient = useCallback(() => {
    cancelQueuedPointerMove();
    gestureRef.current = null;
    setDraft(null);
    setPreview(null);
    setMarquee(null);
    setErasing(null);
  }, [setDraft, cancelQueuedPointerMove]);

  const openTextEdit = useCallback((edit: TextEdit | null) => {
    textEditRef.current = edit;
    setTextEdit(edit);
  }, []);

  const updateText = useCallback(
    (text: string) => {
      const edit = textEditRef.current;
      if (edit && edit.text !== text) openTextEdit({ ...edit, text });
    },
    [openTextEdit],
  );

  /** Saves the open text editor (if any). Safe to call more than once. */
  const commitText = useCallback(() => {
    const edit = textEditRef.current;
    if (!edit) return;
    openTextEdit(null);

    const store = useWorkspaceStore.getState();
    const text = edit.text.replace(/\s+$/, "");
    const existing = store.elements.find((element) => element.id === edit.id);

    if (!text.trim()) {
      if (existing) store.deleteElements([edit.id]);
      return;
    }
    if (existing?.type === "text") {
      store.updateElements([withText(existing, text)]);
      return;
    }
    const element = createTextElement(edit.id, { x: edit.x, y: edit.y }, text, edit.fontSize);
    store.finishDrawing(element);
    store.setSelection([element.id]);
  }, [openTextEdit]);

  const cancelText = useCallback(() => openTextEdit(null), [openTextEdit]);

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

  const abortGesture = useCallback(() => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    discardGesture(false);

    const svg = svgRef.current;
    const ids = gesture.kind === "pinch" ? gesture.pointerIds : [gesture.pointerId];
    for (const id of ids) if (svg?.hasPointerCapture(id)) svg.releasePointerCapture(id);
  }, [discardGesture, svgRef]);

  useEffect(
    () =>
      useWorkspaceStore.subscribe((state, previous) => {
        if (state.boardId !== previous.boardId) {
          abortGesture();
          cancelText();
          return;
        }
        if (state.activeTool !== previous.activeTool) {
          abortGesture();
          commitText();
          setCursor(state.activeTool === "hand" ? "grab" : "default");
          return;
        }
        const gesture = gestureRef.current;
        const transforms = gesture?.kind === "move" || gesture?.kind === "resize" || gesture?.kind === "endpoint";
        if (transforms && state.elements !== previous.elements) abortGesture();
      }),
    [abortGesture, cancelText, commitText],
  );

  const gestureFor = (event: SvgPointerEvent) => {
    const gesture = gestureRef.current;
    return gesture && ownsPointer(gesture, event.pointerId) ? gesture : null;
  };

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
        return {
          kind: "endpoint",
          pointerId,
          origin: point,
          endpoint: decision.endpoint,
          original,
        };
      }
      case "resize": {
        const originals = byIds(decision.selectedIds);
        const bounds = unionBounds(originals.map(elementBounds));
        if (!bounds) return null;
        const minSize = MIN_RESIZE_SIZE / store.viewport.zoom;
        return {
          kind: "resize",
          pointerId,
          origin: point,
          handle: decision.handle,
          bounds,
          originals,
          minSize,
        };
      }
      case "move": {
        const previousSelection = [...store.selectedIds];
        store.setSelection(decision.selectedIds);
        return {
          kind: "move",
          pointerId,
          origin: point,
          originals: byIds(decision.selectedIds),
          previousSelection,
        };
      }
      case "select":
        store.setSelection(decision.selectedIds);
        return null;
      case "marquee": {
        const previousSelection = [...store.selectedIds];
        store.setSelection(decision.baseSelection);
        return {
          kind: "marquee",
          pointerId,
          origin: point,
          baseSelection: decision.baseSelection,
          previousSelection,
        };
      }
    }
  }

  function canHandOverToPinch(gesture: Gesture): boolean {
    if (gesture.kind === "pinch") return false;
    const touch = touchesRef.current.get(gesture.pointerId);
    if (!touch) return false;
    if (gesture.kind === "pan") return true;
    return Math.hypot(touch.x - touch.startX, touch.y - touch.startY) < PINCH_TAKEOVER_SLOP;
  }

  function startPinch(svg: SVGSVGElement) {
    const entries = [...touchesRef.current.entries()];
    if (entries.length !== 2) return;
    const [[idA, a], [idB, b]] = entries as [[number, TrackedTouch], [number, TrackedTouch]];

    discardGesture(true);
    for (const id of [idA, idB]) {
      try {
        if (!svg.hasPointerCapture(id)) svg.setPointerCapture(id);
      } catch {
        return;
      }
    }

    const { midpoint, distance: span } = pinchMetrics(svg, a, b);
    gestureRef.current = {
      kind: "pinch",
      pointerIds: [idA, idB],
      start: {
        viewport: useWorkspaceStore.getState().viewport,
        midpoint,
        distance: span,
      },
    };
  }

  function updateGesture(gesture: Gesture, move: QueuedPointerMove) {
    if (gesture.kind === "pinch") {
      const [a, b] = gesture.pointerIds.map((id) => touchesRef.current.get(id));
      if (!a || !b) return;
      const { midpoint, distance: span } = pinchMetrics(move.svg, a, b);
      useWorkspaceStore.getState().setViewport(pinchViewport(gesture.start, midpoint, span));
      return;
    }
    if (gesture.kind === "pan") {
      const dx = move.clientX - gesture.startClient.x;
      const dy = move.clientY - gesture.startClient.y;
      useWorkspaceStore.getState().setViewport(panBy(gesture.startViewport, dx, dy));
      return;
    }

    const samples = move.worldPoints;
    const point = samples[samples.length - 1];
    if (!point) return;

    switch (gesture.kind) {
      case "erase": {
        if (eraseAlong(gesture, samples)) setErasing(new Set(gesture.ids));
        return;
      }
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
    if (event.type === "pointerdown" && event.isPrimary) touches.clear();
    const known = touches.get(event.pointerId);
    if (known) {
      known.x = event.clientX;
      known.y = event.clientY;
    } else {
      touches.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
      });
    }
  };

  const forgetTouch = (event: SvgPointerEvent) => {
    touchesRef.current.delete(event.pointerId);
  };

  function startTextEdit(point: Point, existing: CanvasElement | null) {
    useWorkspaceStore.getState().clearSelection();
    if (existing?.type === "text") {
      openTextEdit({
        id: existing.id,
        isNew: false,
        x: existing.x,
        y: existing.y,
        fontSize: existing.fontSize,
        text: existing.text,
      });
      return;
    }
    // Centre the first line on the pointer so the caret appears where the user clicked.
    const fontSize = TEXT_FONT_SIZE;
    openTextEdit({
      id: createId(),
      isNew: true,
      x: point.x,
      y: point.y - (fontSize * TEXT_LINE_HEIGHT) / 2,
      fontSize,
      text: "",
    });
  }

  const textAt = (pointerType: string, point: Point) => {
    const store = useWorkspaceStore.getState();
    const hit = topmostElementAt(store.elements, point, hitTolerance(pointerType) / store.viewport.zoom);
    return hit?.type === "text" ? hit : null;
  };

  const onPointerDown = (event: SvgPointerEvent) => {
    trackTouch(event);

    // A click outside an open text editor only closes it.
    if (textEditRef.current) {
      event.preventDefault();
      commitText();
      return;
    }
    const isTouch = event.pointerType === "touch";
    const svg = event.currentTarget;

    const current = gestureRef.current;
    if (current) {
      if (isTouch && touchesRef.current.size === 2 && canHandOverToPinch(current)) startPinch(svg);
      return;
    }
    if (isTouch && touchesRef.current.size === 2) {
      startPinch(svg);
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
      if (activeTool === "text") {
        // Keep the browser from moving focus away from the editor that is about to open.
        event.preventDefault();
        startTextEdit(point, textAt(event.pointerType, point));
        return;
      }
      if (activeTool === "image") {
        optionsRef.current.onImageRequest?.(point);
        return;
      }
      if (activeTool === "eraser") {
        const erase: Gesture = {
          kind: "erase",
          pointerId: event.pointerId,
          last: point,
          tolerance: (hitTolerance(event.pointerType) * ERASER_TOLERANCE_FACTOR) / store.viewport.zoom,
          ids: new Set(),
        };
        if (eraseAlong(erase, [point])) setErasing(new Set(erase.ids));
        gesture = erase;
      } else if (isDrawingTool(activeTool)) {
        gesture = {
          kind: "draw",
          pointerId: event.pointerId,
          draft: startDraft(activeTool, point),
        };
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

  const applyQueuedPointerMove = () => {
    if (pointerMoveFrameIdRef.current !== null) cancelAnimationFrame(pointerMoveFrameIdRef.current);
    pointerMoveFrameIdRef.current = null;
    const queuedMove = queuedPointerMoveRef.current;
    queuedPointerMoveRef.current = null;
    if (queuedMove && queuedMove.gesture === gestureRef.current) {
      flushSync(() => updateGesture(queuedMove.gesture, queuedMove));
    }
  };

  const queuePointerMove = (gesture: Gesture, event: SvgPointerEvent) => {
    const needsWorldPoints = gesture.kind !== "pan" && gesture.kind !== "pinch";
    const worldPoints = needsWorldPoints ? worldSamples(event) : [];
    const queuedMove = queuedPointerMoveRef.current;

    if (queuedMove && queuedMove.gesture === gesture) {
      queuedMove.worldPoints.push(...worldPoints);
      queuedMove.clientX = event.clientX;
      queuedMove.clientY = event.clientY;
    } else {
      queuedPointerMoveRef.current = {
        gesture,
        svg: event.currentTarget,
        worldPoints,
        clientX: event.clientX,
        clientY: event.clientY,
      };
    }
    pointerMoveFrameIdRef.current ??= requestAnimationFrame(applyQueuedPointerMove);
  };

  const onPointerMove = (event: SvgPointerEvent) => {
    if (event.pointerType === "touch" && touchesRef.current.has(event.pointerId)) trackTouch(event);

    const gesture = gestureFor(event);
    if (gesture) queuePointerMove(gesture, event);
    else if (!gestureRef.current) updateHoverCursor(event);
  };

  const onPointerLeave = () => {
    if (!gestureRef.current) setCursor(useWorkspaceStore.getState().activeTool === "hand" ? "grab" : "default");
  };

  function commitGesture(gesture: Gesture, samples: Point[]) {
    const store = useWorkspaceStore.getState();
    const point = samples[samples.length - 1];

    switch (gesture.kind) {
      case "erase":
        eraseAlong(gesture, samples);
        if (gesture.ids.size > 0) store.deleteElements([...gesture.ids]);
        return;
      case "draw": {
        const element = bindDrawn(elementFromDraft(updateDraft(gesture.draft, samples), createId()));
        if (element) store.finishDrawing(element);
        return;
      }
      case "marquee":
      case "pan":
      case "pinch":
        return;
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

    applyQueuedPointerMove();
    const samples = gesture.kind === "pan" || gesture.kind === "pinch" ? [] : worldSamples(event);
    clearTransient();
    commitGesture(gesture, samples);
    updateHoverCursor(event);
  };

  const onPointerCancel = (event: SvgPointerEvent) => {
    forgetTouch(event);
    if (gestureFor(event)) abortGesture();
  };

  const onLostPointerCapture = (event: SvgPointerEvent) => {
    if (gestureFor(event)) abortGesture();
  };

  const onMouseDown = (event: ReactMouseEvent<SVGSVGElement>) => {
    const { activeTool } = useWorkspaceStore.getState();
    if (event.button === 1 || activeTool === "text") event.preventDefault();
  };

  const onDoubleClick = (event: ReactMouseEvent<SVGSVGElement>) => {
    const store = useWorkspaceStore.getState();
    if (store.activeTool !== "selection" || textEditRef.current) return;
    const point = createScreenToWorld(event.currentTarget)?.(event.clientX, event.clientY);
    if (!point) return;

    const hit = topmostElementAt(store.elements, point, hitTolerance("mouse") / store.viewport.zoom);
    if (hit && hit.type !== "text") return;
    event.preventDefault();
    startTextEdit(point, hit);
  };

  return {
    draftElement,
    preview,
    bindTargets,
    marquee,
    erasing,
    cursor,
    textEdit,
    updateText,
    commitText,
    cancelText,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerLeave,
      onPointerCancel,
      onLostPointerCapture,
      onMouseDown,
      onDoubleClick,
    },
  };
}
