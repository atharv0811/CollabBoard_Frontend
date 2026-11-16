/**
 * Unit tests for the pure drawing-engine modules (no browser needed).
 * Run: bun run test:unit   (Node's built-in runner; Node ≥ 23 strips TS types)
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  elementFromDraft,
  FREEHAND_MIN_POINT_DISTANCE,
  startDraft,
  updateDraft,
} from "../src/features/workspace/canvas/drafts.ts";
import { isDrawingTool } from "../src/features/workspace/canvas/elements.ts";
import {
  arrowheadPoints,
  boundsFromPoints,
  diamondVertices,
  ellipseFromBounds,
  freehandPathData,
} from "../src/features/workspace/canvas/geometry.ts";

type P = { x: number; y: number };
const p = (x: number, y: number): P => ({ x, y });

/** The same 100×60 box dragged from each of its four corners. */
const DIRECTIONS: Record<string, [P, P]> = {
  "↘ top-left → bottom-right": [p(10, 20), p(110, 80)],
  "↙ top-right → bottom-left": [p(110, 20), p(10, 80)],
  "↖ bottom-right → top-left": [p(110, 80), p(10, 20)],
  "↗ bottom-left → top-right": [p(10, 80), p(110, 20)],
};

const drag = (tool: Parameters<typeof startDraft>[0], from: P, to: P) =>
  elementFromDraft(updateDraft(startDraft(tool, from), [to]), "id");

describe("bounds and shapes in every drag direction", () => {
  for (const [name, [from, to]] of Object.entries(DIRECTIONS)) {
    test(`rectangle ${name}`, () => {
      assert.deepEqual(drag("rectangle", from, to), {
        id: "id",
        type: "rectangle",
        style: { strokeWidth: 2, fill: "transparent" },
        x: 10,
        y: 20,
        width: 100,
        height: 60,
      });
    });

    test(`ellipse ${name}`, () => {
      const el = drag("ellipse", from, to);
      assert.equal(el?.type, "ellipse");
      if (el?.type !== "ellipse") return;
      assert.deepEqual({ cx: el.cx, cy: el.cy, rx: el.rx, ry: el.ry }, { cx: 60, cy: 50, rx: 50, ry: 30 });
    });

    test(`diamond ${name}`, () => {
      const el = drag("diamond", from, to);
      assert.equal(el?.type, "diamond");
      if (el?.type !== "diamond") return;
      assert.deepEqual(diamondVertices(el), [p(60, 20), p(110, 50), p(60, 80), p(10, 50)]);
    });

    test(`line and arrow keep their direction ${name}`, () => {
      for (const tool of ["line", "arrow"] as const) {
        const el = drag(tool, from, to);
        assert.equal(el?.type, tool);
        if (el?.type !== "line" && el?.type !== "arrow") return;
        assert.deepEqual([el.start, el.end], [from, to]);
      }
    });
  }

  test("boundsFromPoints normalises negative drags", () => {
    assert.deepEqual(boundsFromPoints(p(50, 50), p(20, 10)), { x: 20, y: 10, width: 30, height: 40 });
  });

  test("ellipseFromBounds uses the box centre and half-sizes", () => {
    assert.deepEqual(ellipseFromBounds({ x: 0, y: 0, width: 40, height: 20 }), { cx: 20, cy: 10, rx: 20, ry: 10 });
  });
});

describe("arrowhead orientation", () => {
  // 16 directions around the circle, including all axis-aligned and diagonal cases.
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const start = p(200, 200);
    const end = p(200 + Math.cos(angle) * 100, 200 + Math.sin(angle) * 100);

    test(`points along the shaft at ${Math.round((angle * 180) / Math.PI)}°`, () => {
      const [wingA, tip, wingB] = arrowheadPoints(start, end, 2);
      assert.deepEqual(tip, end, "tip sits on the end point");

      const dir = { x: Math.cos(angle), y: Math.sin(angle) };
      for (const wing of [wingA, wingB]) {
        const along = (wing.x - end.x) * dir.x + (wing.y - end.y) * dir.y;
        assert.ok(along < 0, "wings trail behind the tip (head points forward)");
      }

      const cross = (w: P) => (w.x - end.x) * dir.y - (w.y - end.y) * dir.x;
      assert.ok(cross(wingA) * cross(wingB) < 0, "wings are on opposite sides of the shaft");
      assert.ok(
        Math.abs(Math.hypot(wingA.x - end.x, wingA.y - end.y) - Math.hypot(wingB.x - end.x, wingB.y - end.y)) < 1e-9,
        "symmetric",
      );
    });
  }

  test("head never exceeds half the arrow length", () => {
    const [wing] = arrowheadPoints(p(0, 0), p(10, 0), 2);
    assert.ok(Math.hypot(wing.x - 10, wing.y) <= 5 + 1e-9);
  });
});

describe("freehand", () => {
  test("records moved samples and skips duplicates / sub-threshold jitter", () => {
    let draft = startDraft("freehand", p(0, 0));
    draft = updateDraft(draft, [p(10, 0), p(10, 0), p(10 + FREEHAND_MIN_POINT_DISTANCE / 2, 0), p(20, 5)]);
    assert.deepEqual(draft.points, [p(0, 0), p(10, 0), p(20, 5)]);
  });

  test("returns the same draft object when no sample is kept (no re-render)", () => {
    const draft = updateDraft(startDraft("freehand", p(0, 0)), [p(5, 5)]);
    assert.equal(updateDraft(draft, [p(5, 5), p(5.2, 5.1)]), draft);
  });

  test("does not mutate the previous draft's points", () => {
    const first = updateDraft(startDraft("freehand", p(0, 0)), [p(5, 5)]);
    const snapshot = [...first.points];
    updateDraft(first, [p(9, 9)]);
    assert.deepEqual(first.points, snapshot);
  });

  test("path is one continuous subpath from the first point to the last", () => {
    const d = freehandPathData([p(0, 0), p(10, 0), p(20, 10), p(30, 10)]);
    assert.match(d, /^M0 0 /);
    assert.equal(d.match(/M/g)?.length, 1, "single moveto = continuous");
    assert.match(d, /L30 10$/);
  });

  test("a single point renders as a dot, no points as nothing", () => {
    assert.equal(freehandPathData([p(3, 4)]), "M3 4h0.01");
    assert.equal(freehandPathData([]), "");
  });

  test("committed element keeps every recorded point", () => {
    let draft = startDraft("freehand", p(0, 0));
    draft = updateDraft(draft, [p(5, 0), p(10, 3), p(15, 8)]);
    const el = elementFromDraft(draft, "id");
    assert.equal(el?.type, "freehand");
    if (el?.type === "freehand") assert.equal(el.points.length, 4);
  });
});

describe("invalid / tiny drawings are discarded", () => {
  for (const tool of ["rectangle", "ellipse", "diamond", "line", "arrow", "freehand"] as const) {
    test(`${tool}: a tap or 1px drag creates nothing`, () => {
      assert.equal(elementFromDraft(startDraft(tool, p(5, 5)), "id"), null);
      assert.equal(drag(tool, p(5, 5), p(6, 6)), null);
    });
  }

  test("a long thin rectangle (height < 2) is discarded, a 2×2 one is kept", () => {
    assert.equal(drag("rectangle", p(0, 0), p(100, 1)), null);
    assert.notEqual(drag("rectangle", p(0, 0), p(2, 2)), null);
  });

  test("updateDraft with no samples changes nothing", () => {
    const draft = startDraft("line", p(0, 0));
    assert.equal(updateDraft(draft, []), draft);
  });
});

describe("tool classification", () => {
  test("only the six drawing tools create elements", () => {
    for (const tool of ["rectangle", "ellipse", "diamond", "line", "arrow", "freehand"] as const) {
      assert.equal(isDrawingTool(tool), true, tool);
    }
    for (const tool of ["selection", "hand", "text", "image", "eraser", undefined] as const) {
      assert.equal(isDrawingTool(tool), false, String(tool));
    }
  });
});
