/**
 * Unit tests for selection, hit testing, transforms and the workspace store.
 * Run: bun run test:unit
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_STYLE, type CanvasElement } from "../src/features/workspace/canvas/elements.ts";
import { boundsOfPoints } from "../src/features/workspace/canvas/geometry.ts";
import {
  elementBounds,
  elementsInMarquee,
  hitTestElement,
  topmostElementAt,
} from "../src/features/workspace/canvas/hitTest.ts";
import {
  cursorForDecision,
  decidePointerDown,
  selectionFrame,
  SELECTION_PADDING,
} from "../src/features/workspace/canvas/selection.ts";
import {
  mapElement,
  MIN_RESIZE_SIZE,
  moveEndpoint,
  resizeMap,
  translateElement,
} from "../src/features/workspace/canvas/transform.ts";
import { createWorkspaceStore } from "../src/features/workspace/store/workspaceStore.ts";

const style = DEFAULT_STYLE;
const p = (x: number, y: number) => ({ x, y });

const rect: CanvasElement = { id: "rect", type: "rectangle", style, x: 100, y: 100, width: 100, height: 60 };
const ellipse: CanvasElement = { id: "ellipse", type: "ellipse", style, cx: 400, cy: 130, rx: 50, ry: 30 };
const diamond: CanvasElement = { id: "diamond", type: "diamond", style, x: 600, y: 100, width: 100, height: 60 };
const line: CanvasElement = { id: "line", type: "line", style, start: p(100, 300), end: p(200, 350) };
const arrow: CanvasElement = { id: "arrow", type: "arrow", style, start: p(350, 300), end: p(450, 300) };
const freehand: CanvasElement = { id: "freehand", type: "freehand", style, points: [p(600, 300), p(650, 320), p(700, 300)] };
const ALL = [rect, ellipse, diamond, line, arrow, freehand];

// ------------------------------------------------------------------ hit testing

describe("hitTestElement", () => {
  const onStroke: Record<string, ReturnType<typeof p>> = {
    rect: p(150, 100), // top edge
    ellipse: p(450, 130), // right-most point
    diamond: p(625, 115), // on the top-left edge
    line: p(150, 325), // midpoint
    arrow: p(400, 300),
    freehand: p(625, 310),
  };

  for (const element of ALL) {
    test(`${element.type}: hit on its stroke`, () => {
      assert.equal(hitTestElement(element, onStroke[element.id]!, 0), true);
    });

    test(`${element.type}: missed far away`, () => {
      assert.equal(hitTestElement(element, p(-500, -500), 6), false);
    });
  }

  test("transparent closed shapes are hit on the stroke, not the empty interior", () => {
    assert.equal(hitTestElement(rect, p(150, 130), 6), false);
    assert.equal(hitTestElement(ellipse, p(400, 130), 6), false);
    assert.equal(hitTestElement(diamond, p(650, 130), 6), false);
  });

  test("filled closed shapes are also hit inside", () => {
    const filled = { ...rect, style: { ...style, fill: "#fde68a" } };
    assert.equal(hitTestElement(filled, p(150, 130), 0), true);
  });

  test("tolerance includes half the stroke width plus the input tolerance", () => {
    // 1px stroke half + 6 tolerance = 7 → 6.9px from the edge hits, 7.5px misses
    assert.equal(hitTestElement(rect, p(150, 100 - 6.9), 6), true);
    assert.equal(hitTestElement(rect, p(150, 100 - 7.5), 6), false);
  });

  test("arrowhead wings are hittable", () => {
    // wing ≈ 18px back from the tip and ±8px off the shaft
    assert.equal(hitTestElement(arrow, p(434, 292), 1), true);
  });
});

describe("topmostElementAt", () => {
  test("returns the last-rendered element where strokes overlap", () => {
    const under: CanvasElement = { ...rect, id: "under" };
    const over: CanvasElement = { ...rect, id: "over" };
    assert.equal(topmostElementAt([under, over], p(150, 100), 6)?.id, "over");
    assert.equal(topmostElementAt([over, under], p(150, 100), 6)?.id, "under");
  });

  test("returns null on empty canvas", () => {
    assert.equal(topmostElementAt(ALL, p(900, 900), 6), null);
  });
});

describe("elementsInMarquee (containment)", () => {
  test("selects only elements fully inside", () => {
    assert.deepEqual(elementsInMarquee(ALL, { x: 90, y: 90, width: 400, height: 280 }), ["rect", "ellipse", "line", "arrow"]);
  });

  test("a partially covered element is not selected", () => {
    assert.deepEqual(elementsInMarquee([rect], { x: 90, y: 90, width: 50, height: 100 }), []);
  });
});

// ------------------------------------------------------------------ transforms

describe("translateElement moves every type without resizing it", () => {
  for (const element of ALL) {
    test(element.type, () => {
      const before = elementBounds(element);
      const after = elementBounds(translateElement(element, 30, -20));
      assert.deepEqual(after, { ...before, x: before.x + 30, y: before.y - 20 });
    });
  }

  test("freehand: every point moves", () => {
    const moved = translateElement(freehand, 5, 7);
    assert.equal(moved.type, "freehand");
    if (moved.type === "freehand") assert.deepEqual(moved.points, [p(605, 307), p(655, 327), p(705, 307)]);
  });

  test("line: both endpoints move", () => {
    const moved = translateElement(line, -10, 10);
    if (moved.type === "line") assert.deepEqual([moved.start, moved.end], [p(90, 310), p(190, 360)]);
  });
});

describe("resizeMap", () => {
  const box = { x: 100, y: 100, width: 100, height: 60 };
  /** Resized bounds, rounded to 1e-9 to absorb floating-point noise. */
  const resized = (handle: Parameters<typeof resizeMap>[1], dx: number, dy: number) => {
    const b = elementBounds(mapElement(rect, resizeMap(box, handle, dx, dy)));
    const r = (v: number) => Math.round(v * 1e9) / 1e9;
    return { x: r(b.x), y: r(b.y), width: r(b.width), height: r(b.height) };
  };

  test("corner handles scale both axes, anchored at the opposite corner", () => {
    assert.deepEqual(resized("se", 50, 40), { x: 100, y: 100, width: 150, height: 100 });
    assert.deepEqual(resized("nw", -20, -10), { x: 80, y: 90, width: 120, height: 70 });
    assert.deepEqual(resized("ne", 10, -10), { x: 100, y: 90, width: 110, height: 70 });
    assert.deepEqual(resized("sw", -10, 10), { x: 90, y: 100, width: 110, height: 70 });
  });

  test("edge handles scale one axis only", () => {
    assert.deepEqual(resized("e", 40, 999), { x: 100, y: 100, width: 140, height: 60 });
    assert.deepEqual(resized("n", 999, 20), { x: 100, y: 120, width: 100, height: 40 });
    assert.deepEqual(resized("w", 30, 0), { x: 130, y: 100, width: 70, height: 60 });
    assert.deepEqual(resized("s", 0, -20), { x: 100, y: 100, width: 100, height: 40 });
  });

  test("dragging past the opposite edge mirrors and stays normalised", () => {
    // se dragged 150 left and 100 up: right edge → 50, bottom → 60 → box flips to the other side
    assert.deepEqual(resized("se", -150, -100), { x: 50, y: 60, width: 50, height: 40 });
  });

  test("minimum size is enforced", () => {
    const b = resized("e", -98, 0);
    assert.equal(b.width, MIN_RESIZE_SIZE);
    const flipped = resized("se", -100, -60); // exactly onto the anchor
    assert.ok(flipped.width >= MIN_RESIZE_SIZE && flipped.height >= MIN_RESIZE_SIZE);
  });

  test("elements already smaller than the minimum clamp to their own size, not the minimum", () => {
    const small = { x: 0, y: 0, width: 4, height: 4 };
    const tiny: CanvasElement = { ...rect, x: 0, y: 0, width: 4, height: 4 };
    // Right edge dragged to 1px from the anchor: clamps at the original 4px, not 8px.
    assert.equal(elementBounds(mapElement(tiny, resizeMap(small, "e", -3, 0))).width, 4);
  });

  test("freehand points transform proportionally", () => {
    const fb = elementBounds(freehand); // 600..700 × 300..320
    const scaled = mapElement(freehand, resizeMap(fb, "se", 100, 20));
    assert.equal(scaled.type, "freehand");
    if (scaled.type !== "freehand") return;
    assert.deepEqual(scaled.points, [p(600, 300), p(700, 340), p(800, 300)]);
    assert.deepEqual(boundsOfPoints(scaled.points), { x: 600, y: 300, width: 200, height: 40 });
  });

  test("ellipse keeps centre/radii consistent with its new box", () => {
    const scaled = mapElement(ellipse, resizeMap(elementBounds(ellipse), "se", 20, 40));
    assert.deepEqual(scaled.type === "ellipse" && [scaled.cx, scaled.cy, scaled.rx, scaled.ry], [410, 150, 60, 50]);
  });

  test("a flat line's zero-height axis is left alone", () => {
    const flat = elementBounds(arrow); // height 0
    const scaled = mapElement(arrow, resizeMap(flat, "s", 0, 50));
    assert.deepEqual(scaled, arrow);
  });
});

describe("moveEndpoint", () => {
  test("moves only the chosen endpoint", () => {
    const moved = moveEndpoint(arrow as Extract<CanvasElement, { type: "arrow" }>, "end", p(400, 400));
    assert.deepEqual([moved.start, moved.end], [p(350, 300), p(400, 400)]);
  });

  test("refuses to collapse the line below the minimum length", () => {
    const original = line as Extract<CanvasElement, { type: "line" }>;
    assert.equal(moveEndpoint(original, "start", p(200.5, 350.5)), original);
  });
});

// ------------------------------------------------------------------ selection decisions

describe("decidePointerDown", () => {
  const base = { elements: ALL, tolerance: 6, handleRadius: 8, shiftKey: false };

  test("clicking an element selects it and starts a move", () => {
    assert.deepEqual(decidePointerDown({ ...base, selectedIds: [], point: p(150, 100) }), { action: "move", selectedIds: ["rect"] });
  });

  test("clicking a selected element keeps the whole selection", () => {
    assert.deepEqual(decidePointerDown({ ...base, selectedIds: ["ellipse", "rect"], point: p(150, 100) }), {
      action: "move",
      selectedIds: ["ellipse", "rect"],
    });
  });

  test("clicking another element replaces the selection", () => {
    assert.deepEqual(decidePointerDown({ ...base, selectedIds: ["ellipse"], point: p(150, 100) }), { action: "move", selectedIds: ["rect"] });
  });

  test("Shift-click adds, Shift-click on a selected element removes", () => {
    assert.deepEqual(decidePointerDown({ ...base, shiftKey: true, selectedIds: ["ellipse"], point: p(150, 100) }), {
      action: "move",
      selectedIds: ["ellipse", "rect"],
    });
    assert.deepEqual(decidePointerDown({ ...base, shiftKey: true, selectedIds: ["ellipse", "rect"], point: p(150, 100) }), {
      action: "select",
      selectedIds: ["ellipse"],
    });
  });

  test("empty canvas starts a marquee; Shift keeps the existing selection as its base", () => {
    assert.deepEqual(decidePointerDown({ ...base, selectedIds: [], point: p(900, 900) }), { action: "marquee", baseSelection: [] });
    assert.deepEqual(decidePointerDown({ ...base, shiftKey: true, selectedIds: ["rect"], point: p(900, 900) }), {
      action: "marquee",
      baseSelection: ["rect"],
    });
  });

  test("dragging inside the selection box (not on a stroke) moves the selection", () => {
    assert.deepEqual(decidePointerDown({ ...base, selectedIds: ["rect"], point: p(150, 130) }), { action: "move", selectedIds: ["rect"] });
  });

  test("a resize handle of the selection wins over the element underneath", () => {
    const corner = p(200 + SELECTION_PADDING, 160 + SELECTION_PADDING);
    assert.deepEqual(decidePointerDown({ ...base, selectedIds: ["rect"], point: corner }), {
      action: "resize",
      handle: "se",
      selectedIds: ["rect"],
    });
  });

  test("a single selected line shows endpoint handles instead of a box", () => {
    assert.equal(selectionFrame([line]).kind, "endpoints");
    assert.deepEqual(decidePointerDown({ ...base, selectedIds: ["line"], point: p(201, 351) }), {
      action: "endpoint",
      elementId: "line",
      endpoint: "end",
    });
  });

  test("several elements including lines get a shared box", () => {
    assert.equal(selectionFrame([line, rect]).kind, "box");
  });
});

describe("hover cursors", () => {
  const base = { elements: ALL, tolerance: 6, handleRadius: 8, shiftKey: false };
  const cursorAt = (selectedIds: string[], point: ReturnType<typeof p>) =>
    cursorForDecision(decidePointerDown({ ...base, selectedIds, point }));
  const pad = SELECTION_PADDING;

  test("each resize handle shows the matching resize cursor", () => {
    // rect 100..200 × 100..160, frame padded by 6
    const expected: [ReturnType<typeof p>, string][] = [
      [p(100 - pad, 100 - pad), "nwse-resize"], [p(200 + pad, 160 + pad), "nwse-resize"],
      [p(200 + pad, 100 - pad), "nesw-resize"], [p(100 - pad, 160 + pad), "nesw-resize"],
      [p(150, 100 - pad), "ns-resize"], [p(150, 160 + pad), "ns-resize"],
      [p(200 + pad, 130), "ew-resize"], [p(100 - pad, 130), "ew-resize"],
    ];
    for (const [point, cursor] of expected) assert.equal(cursorAt(["rect"], point), cursor, JSON.stringify(point));
  });

  test("inside the selection or over an element: move", () => {
    assert.equal(cursorAt(["rect"], p(150, 130)), "move");
    assert.equal(cursorAt([], p(150, 100)), "move");
  });

  test("line endpoint: grab; empty canvas: default", () => {
    assert.equal(cursorAt(["line"], p(200, 350)), "grab");
    assert.equal(cursorAt([], p(900, 900)), "default");
  });
});

// ------------------------------------------------------------------ store

describe("workspace store", () => {
  const setup = () => {
    const store = createWorkspaceStore();
    for (const element of ALL) store.getState().addElement(element);
    return store;
  };

  test("deleteSelected removes the selection and clears it", () => {
    const store = setup();
    store.getState().setSelection(["rect", "line"]);
    assert.equal(store.getState().deleteSelected(), 2);
    assert.deepEqual(store.getState().elements.map((e) => e.id), ["ellipse", "diamond", "arrow", "freehand"]);
    assert.deepEqual(store.getState().selectedIds, []);
  });

  test("updateElements replaces by id and ignores deleted ids", () => {
    const store = setup();
    store.getState().deleteElements(["rect"]);
    store.getState().updateElements([translateElement(rect, 10, 10), translateElement(line, 1, 1)]);
    const ids = store.getState().elements.map((e) => e.id);
    assert.equal(ids.includes("rect"), false, "a deleted element is not resurrected");
    assert.deepEqual(store.getState().elements.find((e) => e.id === "line"), translateElement(line, 1, 1));
  });

  test("setSelection drops unknown ids and duplicates, and skips no-op updates", () => {
    const store = setup();
    store.getState().setSelection(["rect", "missing", "rect"]);
    assert.deepEqual(store.getState().selectedIds, ["rect"]);
    const before = store.getState().selectedIds;
    store.getState().setSelection(["rect"]);
    assert.equal(store.getState().selectedIds, before, "same array reference — subscribers don't re-render");
  });

  test("switching to a drawing tool clears the selection; selection tool keeps it", () => {
    const store = setup();
    store.getState().setSelection(["rect"]);
    store.getState().setActiveTool("selection");
    assert.deepEqual(store.getState().selectedIds, ["rect"]);
    store.getState().setActiveTool("ellipse");
    assert.deepEqual(store.getState().selectedIds, []);
  });

  test("deleteElements also removes deleted ids from the selection", () => {
    const store = setup();
    store.getState().setSelection(["rect", "ellipse"]);
    store.getState().deleteElements(["rect"]);
    assert.deepEqual(store.getState().selectedIds, ["ellipse"]);
  });
});
