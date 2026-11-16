/**
 * Unit tests for viewport navigation maths and the store's viewport actions.
 * Run: bun run test:unit
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_STYLE, type CanvasElement } from "../src/features/workspace/canvas/elements.ts";
import { decidePointerDown, SELECTION_PADDING } from "../src/features/workspace/canvas/selection.ts";
import {
  canvasToWorld,
  clampZoom,
  DEFAULT_VIEWPORT,
  FIT_PADDING,
  fitBounds,
  gridFor,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  pinchViewport,
  viewBoxFor,
  wheelIntent,
  worldToCanvas,
  zoomAt,
  type Viewport,
} from "../src/features/workspace/canvas/viewport.ts";
import { createWorkspaceStore } from "../src/features/workspace/store/workspaceStore.ts";

const p = (x: number, y: number) => ({ x, y });
const near = (actual: number, expected: number, message?: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ""} expected ${expected}, got ${actual}`);
const nearPoint = (actual: { x: number; y: number }, expected: { x: number; y: number }, message?: string) => {
  near(actual.x, expected.x, `${message ?? ""} x:`);
  near(actual.y, expected.y, `${message ?? ""} y:`);
};

const VIEWPORTS: Viewport[] = [DEFAULT_VIEWPORT, { x: 120, y: -40, zoom: 2 }, { x: -500, y: 300, zoom: 0.25 }];

describe("canvas ↔ world conversion", () => {
  test("default viewport: world = canvas px", () => {
    nearPoint(canvasToWorld(DEFAULT_VIEWPORT, p(30, 40)), p(30, 40));
  });

  test("panned and zoomed viewport", () => {
    const viewport = { x: 100, y: 50, zoom: 2 };
    nearPoint(canvasToWorld(viewport, p(0, 0)), p(100, 50), "top-left shows the origin");
    nearPoint(canvasToWorld(viewport, p(200, 100)), p(200, 100));
    nearPoint(worldToCanvas(viewport, p(200, 100)), p(200, 100));
    nearPoint(worldToCanvas(viewport, p(110, 60)), p(20, 20));
  });

  for (const viewport of VIEWPORTS) {
    test(`round trip at zoom ${viewport.zoom}`, () => {
      const world = p(317.5, -42.25);
      nearPoint(canvasToWorld(viewport, worldToCanvas(viewport, world)), world);
    });
  }

  test("viewBox covers exactly the visible world", () => {
    assert.deepEqual(viewBoxFor({ x: 10, y: 20, zoom: 2 }, { width: 800, height: 600 }), {
      x: 10,
      y: 20,
      width: 400,
      height: 300,
    });
  });
});

describe("pan", () => {
  test("content follows the pointer: dragging right reveals the world to the left", () => {
    const panned = panBy(DEFAULT_VIEWPORT, 100, 50);
    assert.deepEqual(panned, { x: -100, y: -50, zoom: 1 });
    nearPoint(worldToCanvas(panned, p(0, 0)), p(100, 50), "world origin moved with the drag");
  });

  test("pan distance is in screen px at any zoom", () => {
    const viewport = { x: 0, y: 0, zoom: 4 };
    const world = p(10, 10);
    const before = worldToCanvas(viewport, world);
    const after = worldToCanvas(panBy(viewport, 40, -20), world);
    nearPoint(after, p(before.x + 40, before.y - 20));
  });
});

describe("zoom around a point", () => {
  for (const viewport of VIEWPORTS) {
    for (const factor of [1.5, 0.6]) {
      test(`the world point under the anchor stays put (zoom ${viewport.zoom} × ${factor})`, () => {
        const anchor = p(333, 211);
        const worldBefore = canvasToWorld(viewport, anchor);
        const next = zoomAt(viewport, viewport.zoom * factor, anchor);
        near(next.zoom, clampZoom(viewport.zoom * factor));
        nearPoint(worldToCanvas(next, worldBefore), anchor);
      });
    }
  }

  test("limits are enforced and the anchor still holds at the limit", () => {
    const anchor = p(100, 100);
    const world = canvasToWorld(DEFAULT_VIEWPORT, anchor);
    const maxed = zoomAt(DEFAULT_VIEWPORT, 1000, anchor);
    assert.equal(maxed.zoom, MAX_ZOOM);
    nearPoint(worldToCanvas(maxed, world), anchor);
    assert.equal(zoomAt(DEFAULT_VIEWPORT, 0.0001, anchor).zoom, MIN_ZOOM);
    assert.equal(clampZoom(MIN_ZOOM / 2), MIN_ZOOM);
    assert.equal(clampZoom(MAX_ZOOM * 2), MAX_ZOOM);
  });
});

describe("pinch", () => {
  const start = { viewport: { x: 50, y: 20, zoom: 1 }, midpoint: p(200, 300), distance: 100 };

  test("spreading the fingers zooms in around the midpoint", () => {
    const next = pinchViewport(start, p(200, 300), 200);
    near(next.zoom, 2);
    const anchorWorld = canvasToWorld(start.viewport, start.midpoint);
    nearPoint(worldToCanvas(next, anchorWorld), p(200, 300));
  });

  test("pinching in zooms out", () => {
    near(pinchViewport(start, p(200, 300), 50).zoom, 0.5);
  });

  test("moving both fingers pans: the anchored world point follows the midpoint", () => {
    const next = pinchViewport(start, p(260, 340), 100);
    near(next.zoom, 1);
    nearPoint(worldToCanvas(next, canvasToWorld(start.viewport, start.midpoint)), p(260, 340));
  });

  test("zoom limits apply", () => {
    assert.equal(pinchViewport(start, p(200, 300), 100000).zoom, MAX_ZOOM);
    assert.equal(pinchViewport({ ...start, distance: 0 }, p(200, 300), 50).zoom, 1, "zero start distance is safe");
  });
});

describe("fit content", () => {
  const size = { width: 1000, height: 800 };

  test("large content is scaled down, centred and padded", () => {
    const bounds = { x: 0, y: 0, width: 3000, height: 1000 };
    const fit = fitBounds(bounds, size);
    near(fit.zoom, (1000 - FIT_PADDING * 2) / 3000);
    const topLeft = worldToCanvas(fit, p(0, 0));
    const bottomRight = worldToCanvas(fit, p(3000, 1000));
    near(topLeft.x, FIT_PADDING, "left padding");
    near(bottomRight.x, 1000 - FIT_PADDING, "right padding");
    near((topLeft.y + bottomRight.y) / 2, 400, "vertically centred");
  });

  test("small content is centred without enlarging past 100%", () => {
    const fit = fitBounds({ x: 500, y: 500, width: 40, height: 20 }, size);
    assert.equal(fit.zoom, 1);
    nearPoint(worldToCanvas(fit, p(520, 510)), p(500, 400), "content centre at canvas centre");
  });

  test("zero-height content (a flat line) only constrains the other axis", () => {
    const fit = fitBounds({ x: 0, y: 100, width: 4000, height: 0 }, size);
    near(fit.zoom, (1000 - FIT_PADDING * 2) / 4000);
  });

  test("empty board or unmeasured canvas returns the default view", () => {
    assert.deepEqual(fitBounds(null, size), DEFAULT_VIEWPORT);
    assert.deepEqual(fitBounds({ x: 0, y: 0, width: 10, height: 10 }, { width: 0, height: 0 }), DEFAULT_VIEWPORT);
  });

  test("extremely large content is limited by the minimum zoom", () => {
    assert.equal(fitBounds({ x: 0, y: 0, width: 1e7, height: 1e7 }, size).zoom, MIN_ZOOM);
  });
});

describe("wheelIntent", () => {
  const wheel = (patch: Partial<Parameters<typeof wheelIntent>[0]>) =>
    wheelIntent({ deltaX: 0, deltaY: 0, deltaMode: 0, ctrlKey: false, metaKey: false, shiftKey: false, ...patch });

  test("mouse wheel notches zoom (up = in, down = out)", () => {
    const zoomIn = wheel({ deltaY: -100 });
    const zoomOut = wheel({ deltaY: 100 });
    assert.equal(zoomIn.kind, "zoom");
    assert.ok(zoomIn.kind === "zoom" && zoomIn.factor > 1);
    assert.ok(zoomOut.kind === "zoom" && zoomOut.factor < 1);
  });

  test("line-based deltas (Firefox mouse wheel) zoom", () => {
    assert.equal(wheel({ deltaY: 3, deltaMode: 1 }).kind, "zoom");
  });

  test("Ctrl / ⌘ + wheel and trackpad pinch (ctrlKey) zoom", () => {
    assert.equal(wheel({ deltaY: 4.5, ctrlKey: true }).kind, "zoom");
    assert.equal(wheel({ deltaY: -2, metaKey: true }).kind, "zoom");
  });

  test("trackpad two-finger scrolling pans with the content", () => {
    assert.deepEqual(wheel({ deltaX: 6.5, deltaY: 12.25 }), { kind: "pan", dx: -6.5, dy: -12.25 });
  });

  test("Shift + wheel pans horizontally", () => {
    assert.deepEqual(wheel({ deltaY: 100, shiftKey: true }), { kind: "pan", dx: -100, dy: 0 });
  });

  test("a single event can never jump the zoom by more than 1.5×", () => {
    const huge = wheel({ deltaY: -100000 });
    assert.ok(huge.kind === "zoom" && huge.factor <= 1.5);
    const hugeOut = wheel({ deltaY: 100000 });
    assert.ok(hugeOut.kind === "zoom" && hugeOut.factor >= 1 / 1.5);
  });
});

describe("dot grid", () => {
  test("default view matches the original CSS grid (22px, dots at multiples of 22)", () => {
    assert.deepEqual(gridFor(DEFAULT_VIEWPORT), { size: 22, offsetX: 11, offsetY: 11 });
  });

  test("spacing stays readable at any zoom", () => {
    for (const zoom of [MIN_ZOOM, 0.3, 1, 3, MAX_ZOOM]) {
      const { size } = gridFor({ x: 0, y: 0, zoom });
      assert.ok(size >= 11 && size <= 44, `zoom ${zoom}: ${size}px`);
    }
  });

  test("the grid moves with the world when panning", () => {
    const before = gridFor(DEFAULT_VIEWPORT);
    const after = gridFor(panBy(DEFAULT_VIEWPORT, 5, 0));
    near((after.offsetX - before.offsetX + 22) % 22, 5);
  });
});

describe("selection hit areas stay screen-sized at any zoom", () => {
  const rect: CanvasElement = {
    id: "r",
    type: "rectangle",
    style: DEFAULT_STYLE,
    x: 100,
    y: 100,
    width: 100,
    height: 60,
  };

  test("at 200% the se handle sits padding/zoom outside the corner and is hit with radius/zoom", () => {
    const zoom = 2;
    const corner = p(200 + SELECTION_PADDING / zoom, 160 + SELECTION_PADDING / zoom);
    const decide = (point: { x: number; y: number }) =>
      decidePointerDown({
        elements: [rect],
        selectedIds: ["r"],
        point,
        shiftKey: false,
        tolerance: 6 / zoom,
        handleRadius: 8 / zoom,
        zoom,
      });
    assert.deepEqual(decide(corner), { action: "resize", handle: "se", selectedIds: ["r"] });
    // 5 world units away = 10 screen px > 8 px radius → no longer the handle
    assert.notEqual(decide(p(corner.x + 5, corner.y + 5)).action, "resize");
  });
});

describe("store navigation never mutates element data", () => {
  const rect: CanvasElement = {
    id: "r",
    type: "rectangle",
    style: DEFAULT_STYLE,
    x: 100,
    y: 100,
    width: 100,
    height: 60,
  };

  test("pan, zoom, reset and fit leave elements untouched", () => {
    const store = createWorkspaceStore();
    store.getState().setCanvasSize({ width: 1000, height: 800 });
    store.getState().addElement(rect);
    const elementsBefore = store.getState().elements;

    store.getState().panViewport(50, 20);
    store.getState().zoomTo(3, p(10, 10));
    store.getState().zoomIn();
    store.getState().zoomOut();
    store.getState().fitContent();
    store.getState().resetZoom();

    assert.equal(store.getState().elements, elementsBefore, "same array reference");
    assert.deepEqual(store.getState().elements[0], rect);
  });

  test("zoom in / out step around the canvas centre and reset returns to 100%", () => {
    const store = createWorkspaceStore();
    store.getState().setCanvasSize({ width: 1000, height: 800 });
    const centreWorld = canvasToWorld(store.getState().viewport, p(500, 400));
    store.getState().zoomIn();
    near(store.getState().viewport.zoom, 1.2);
    nearPoint(worldToCanvas(store.getState().viewport, centreWorld), p(500, 400));
    store.getState().zoomOut();
    near(store.getState().viewport.zoom, 1);
    store.getState().zoomTo(3);
    store.getState().resetZoom();
    assert.equal(store.getState().viewport.zoom, 1);
  });

  test("fit on an empty board returns to the default view", () => {
    const store = createWorkspaceStore();
    store.getState().setCanvasSize({ width: 1000, height: 800 });
    store.getState().panViewport(300, 300);
    store.getState().fitContent();
    assert.deepEqual(store.getState().viewport, DEFAULT_VIEWPORT);
  });

  test("the Hand tool keeps the selection; drawing tools clear it", () => {
    const store = createWorkspaceStore();
    store.getState().addElement(rect);
    store.getState().setSelection(["r"]);
    store.getState().setActiveTool("hand");
    assert.deepEqual(store.getState().selectedIds, ["r"]);
    store.getState().setActiveTool("rectangle");
    assert.deepEqual(store.getState().selectedIds, []);
  });
});
