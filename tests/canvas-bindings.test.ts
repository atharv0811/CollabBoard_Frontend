/**
 * Unit tests for connectors: lines/arrows whose ends are bound to shapes.
 * Run: bun run test:unit
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  BINDING_GAP,
  bindableAt,
  bindEnds,
  detachFrom,
  edgePoint,
  resolveBindings,
  visibleAnchorPoint,
} from "../src/features/workspace/canvas/bindings.ts";
import {
  DEFAULT_STYLE,
  type ArrowElement,
  type CanvasElement,
  type RectangleElement,
} from "../src/features/workspace/canvas/elements.ts";
import { translateElement } from "../src/features/workspace/canvas/transform.ts";
import { createWorkspaceStore } from "../src/features/workspace/store/workspaceStore.ts";

const style = DEFAULT_STYLE;
const p = (x: number, y: number) => ({ x, y });

const a: RectangleElement = { id: "a", type: "rectangle", style, x: 0, y: 0, width: 100, height: 100 };
const b: RectangleElement = { id: "b", type: "rectangle", style, x: 300, y: 0, width: 100, height: 100 };
const arrow: ArrowElement = { id: "arrow", type: "arrow", style, start: p(50, 50), end: p(350, 50) };

const connected = (): ArrowElement => bindEnds(arrow, [a, b], 0);
const assertNear = (actual: { x: number; y: number }, expected: { x: number; y: number }) =>
  assert.ok(
    Math.abs(actual.x - expected.x) < 1e-9 && Math.abs(actual.y - expected.y) < 1e-9,
    `${JSON.stringify(actual)} != ${JSON.stringify(expected)}`,
  );
const findArrow = (elements: readonly CanvasElement[]) =>
  elements.find((element) => element.id === "arrow") as ArrowElement;

describe("binding", () => {
  test("ends drawn inside shapes bind to them", () => {
    const bound = connected();
    assert.deepEqual(bound.startBinding, { elementId: "a" });
    assert.deepEqual(bound.endBinding, { elementId: "b" });
  });

  test("ends in empty space stay free", () => {
    const free = bindEnds({ ...arrow, start: p(150, 200), end: p(250, 200) }, [a, b], 0);
    assert.equal(free.startBinding, undefined);
    assert.equal(free.endBinding, undefined);
    assert.ok(!("startBinding" in free), "no undefined keys are left behind");
  });

  test("both ends never bind to the same shape", () => {
    const inside = bindEnds({ ...arrow, start: p(20, 20), end: p(80, 80) }, [a], 0);
    assert.equal(inside.startBinding?.elementId, "a");
    assert.equal(inside.endBinding, undefined);
  });

  test("snap distance reaches just outside a shape", () => {
    assert.equal(bindableAt([a], p(105, 50), 0), null);
    assert.equal(bindableAt([a], p(105, 50), 10)?.id, "a");
  });

  test("lines, arrows and freehand strokes are not bind targets", () => {
    assert.equal(bindableAt([arrow], p(200, 50), 10), null);
  });
});

describe("resolving connector ends", () => {
  test("bound ends sit on the facing edges, outside the gap", () => {
    const [resolved] = resolveBindings([a, b, connected()]).slice(2) as ArrowElement[];
    assert.deepEqual(resolved!.start, p(100 + BINDING_GAP, 50));
    assert.deepEqual(resolved!.end, p(300 - BINDING_GAP, 50));
  });

  test("edge points work for ellipses and diamonds", () => {
    const ellipse: CanvasElement = { id: "e", type: "ellipse", style, cx: 0, cy: 0, rx: 50, ry: 20 };
    assert.deepEqual(edgePoint(ellipse, p(0, 100), 0), p(0, 20));
    const diamond: CanvasElement = { id: "d", type: "diamond", style, x: -50, y: -50, width: 100, height: 100 };
    const corner = edgePoint(diamond, p(100, 100), 0);
    assert.ok(Math.abs(corner.x - 25) < 1e-9 && Math.abs(corner.y - 25) < 1e-9);
  });

  test("nothing changes when everything is already in place (no new arrays)", () => {
    const once = resolveBindings([a, b, connected()]);
    assert.equal(resolveBindings(once), once);
  });

  test("a deleted shape lets go of the connector", () => {
    const [resolved] = resolveBindings([a, connected()]).slice(1) as ArrowElement[];
    assert.equal(resolved!.endBinding, undefined);
    assert.deepEqual(resolved!.startBinding, { elementId: "a" });
  });

  test("moving a connector without its shapes detaches it", () => {
    const moved = detachFrom(translateElement(connected(), 10, 10), new Set(["arrow"]));
    assert.equal(moved.startBinding, undefined);
    assert.equal(moved.endBinding, undefined);
    const withShape = detachFrom(connected(), new Set(["arrow", "a"]));
    assert.deepEqual(withShape.startBinding, { elementId: "a" });
    assert.equal(withShape.endBinding, undefined);
  });
});

describe("pinned attach points", () => {
  // Start dropped on A's bottom edge, end on B's left edge near its top.
  const pinnedArrow = (): ArrowElement => bindEnds({ ...arrow, start: p(80, 100), end: p(300, 20) }, [a, b], 0);

  test("an end dropped away from the centre is pinned to that spot on the outline", () => {
    const bound = pinnedArrow();
    assert.deepEqual(bound.startBinding, { elementId: "a", anchor: p(0.8, 1) });
    assert.deepEqual(bound.endBinding, { elementId: "b", anchor: p(0, 0.2) });
  });

  test("a point inside the shape is projected out to the outline", () => {
    const bound = bindEnds({ ...arrow, start: p(90, 50) }, [a], 0);
    assert.deepEqual(bound.startBinding?.anchor, p(1, 0.5));
  });

  test("an end dropped near the centre aims at the centre instead", () => {
    const bound = bindEnds({ ...arrow, start: p(52, 48) }, [a], 0);
    assert.deepEqual(bound.startBinding, { elementId: "a" });
  });

  test("pinned ends stay on the same spot when shapes move and resize", () => {
    const moved: RectangleElement = { ...b, x: 500, y: 300, width: 200, height: 50 };
    const resolved = findArrow(resolveBindings([a, moved, pinnedArrow()]));
    // A is unchanged: the start stays at 80% along its bottom edge, pushed out from the centre by the gap.
    const out = BINDING_GAP / Math.hypot(30, 50);
    assert.ok(
      Math.abs(resolved.start.x - (80 + 30 * out)) < 1e-9 && Math.abs(resolved.start.y - (100 + 50 * out)) < 1e-9,
    );
    const endOnOutline = p(500, 310); // 20% down B's left edge
    assert.ok(resolved.end.x < endOnOutline.x && Math.abs(resolved.end.y - endOnOutline.y) < BINDING_GAP);
  });
});

describe("pinned spot on the far side of a shape", () => {
  // The case from the screenshot: arrow from a diamond on the right, pinned to the LEFT side of an ellipse.
  const ellipse: CanvasElement = { id: "e", type: "ellipse", style, cx: 100, cy: 100, rx: 50, ry: 70 };
  const leftSide = p(0, 0.5);

  test("the connector stops at the near side instead of cutting through", () => {
    const point = visibleAnchorPoint(ellipse, leftSide, p(300, 90));
    assert.ok(point.x > 150, `ends right of the ellipse, got x=${point.x}`);
    assert.ok(point.x < 150 + BINDING_GAP + 1e-9);
  });

  test("a spot that is only at an angle keeps its pin (the line may graze the shape)", () => {
    // Coming from up-right towards the left side: about 110° round, like the first screenshot.
    const from = p(100 + 50 * 0.9, 100 - 70 * 2.5);
    assertNear(visibleAnchorPoint(ellipse, leftSide, from), p(50 - BINDING_GAP, 100));
  });

  test("a spot that faces the other end is used as is", () => {
    assertNear(visibleAnchorPoint(ellipse, leftSide, p(-200, 100)), p(50 - BINDING_GAP, 100));
  });

  test("works for boxes too", () => {
    // Pinned to A's left edge, connector coming from the right.
    const point = visibleAnchorPoint(a, p(0, 0.5), p(300, 50));
    assertNear(point, p(100 + BINDING_GAP, 50));
  });

  test("resolve uses the near side, and returns to the spot when the shapes swap back", () => {
    const pinned: ArrowElement = {
      ...arrow,
      start: p(300, 50),
      end: p(0, 50),
      endBinding: { elementId: "a", anchor: p(0, 0.5) },
    };
    assertNear(findArrow(resolveBindings([a, pinned])).end, p(100 + BINDING_GAP, 50));
    const fromLeft = { ...pinned, start: p(-300, 50) };
    assertNear(findArrow(resolveBindings([a, fromLeft])).end, p(-BINDING_GAP, 50));
  });
});

describe("store keeps connectors attached", () => {
  test("moving a shape drags the arrow along, as one undoable step", () => {
    const store = createWorkspaceStore();
    store.getState().addElement(a);
    store.getState().addElement(b);
    store.getState().addElement(connected());
    const before = findArrow(store.getState().elements);

    store.getState().updateElements([translateElement(b, 0, 200)]);
    const after = findArrow(store.getState().elements);
    assert.deepEqual(after.endBinding, { elementId: "b" });
    assert.ok(after.end.y > 150, "end followed the shape down");
    assert.ok(after.start.y > 50, "start re-aimed at the moved shape");

    store.getState().undo();
    assert.deepEqual(findArrow(store.getState().elements), before);
  });

  test("deleting a shape keeps the arrow where it was", () => {
    const store = createWorkspaceStore();
    store.getState().addElement(a);
    store.getState().addElement(b);
    store.getState().addElement(connected());
    const before = findArrow(store.getState().elements);
    store.getState().deleteElements(["b"]);
    const after = findArrow(store.getState().elements);
    assert.deepEqual(after.end, before.end);
    assert.equal(after.endBinding, undefined);
  });
});
