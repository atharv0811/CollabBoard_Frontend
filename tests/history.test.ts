/**
 * Unit tests for document history (pure stack functions + store integration).
 * Run: bun run test:unit
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_STYLE, type CanvasElement } from "../src/features/workspace/canvas/elements.ts";
import { mapElement, resizeMap, translateElement } from "../src/features/workspace/canvas/transform.ts";
import {
  deepEqual,
  emptyHistory,
  HISTORY_LIMIT,
  historyShortcut,
  recordEdit,
  redoStep,
  undoStep,
} from "../src/features/workspace/store/history.ts";
import { createWorkspaceStore } from "../src/features/workspace/store/workspaceStore.ts";

const style = DEFAULT_STYLE;
const p = (x: number, y: number) => ({ x, y });
const rect = (id: string, x = 0): CanvasElement => ({ id, type: "rectangle", style, x, y: 0, width: 50, height: 40 });
const line: CanvasElement = { id: "line", type: "line", style, start: p(0, 100), end: p(80, 140) };
const freehand: CanvasElement = { id: "free", type: "freehand", style, points: [p(200, 0), p(220, 10), p(240, 0)] };

const setup = () => createWorkspaceStore();
const ids = (store: ReturnType<typeof setup>) => store.getState().elements.map((element) => element.id);
const depth = (store: ReturnType<typeof setup>) => ({
  past: store.getState().history.past.length,
  future: store.getState().history.future.length,
});

describe("history stack (pure)", () => {
  test("starts empty; undo and redo on empty history do nothing", () => {
    const history = emptyHistory<number>();
    assert.deepEqual(history, { past: [], future: [] });
    assert.equal(undoStep(history, 1), null);
    assert.equal(redoStep(history, 1), null);
  });

  test("undo then redo walks back and forth", () => {
    let history = recordEdit(emptyHistory<number>(), 1); // 1 → 2
    history = recordEdit(history, 2); // 2 → 3
    const back = undoStep(history, 3)!;
    assert.equal(back.value, 2);
    const back2 = undoStep(back.history, back.value)!;
    assert.equal(back2.value, 1);
    const forward = redoStep(back2.history, back2.value)!;
    assert.equal(forward.value, 2);
    assert.deepEqual(forward.history, { past: [1], future: [3] });
  });

  test("a new edit clears the redo future", () => {
    const history = recordEdit(emptyHistory<number>(), 1);
    const undone = undoStep(history, 2)!;
    assert.equal(undone.history.future.length, 1);
    assert.deepEqual(recordEdit(undone.history, 1).future, []);
  });

  test("the limit keeps only the most recent entries", () => {
    let history = emptyHistory<number>();
    for (let i = 0; i < HISTORY_LIMIT + 25; i++) history = recordEdit(history, i);
    assert.equal(history.past.length, HISTORY_LIMIT);
    assert.equal(history.past[0], 25, "oldest entries are dropped first");
    assert.equal(history.past.at(-1), HISTORY_LIMIT + 24);
  });

  test("deepEqual compares structure, not identity", () => {
    assert.equal(deepEqual(rect("a"), rect("a")), true);
    assert.equal(deepEqual(rect("a"), rect("a", 1)), false);
    assert.equal(deepEqual({ points: [p(1, 2)] }, { points: [p(1, 2)] }), true);
    assert.equal(deepEqual([1, 2], { 0: 1, 1: 2 }), false);
  });
});

describe("keyboard shortcuts", () => {
  const key = (patch: Partial<Parameters<typeof historyShortcut>[0]>) =>
    historyShortcut({ key: "z", code: "KeyZ", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...patch });

  test("Ctrl/⌘+Z undo, Ctrl/⌘+Shift+Z redo, Ctrl/⌘+Y redo", () => {
    assert.equal(key({ ctrlKey: true }), "undo");
    assert.equal(key({ metaKey: true }), "undo");
    assert.equal(key({ ctrlKey: true, shiftKey: true, key: "Z" }), "redo");
    assert.equal(key({ metaKey: true, shiftKey: true, key: "Z" }), "redo");
    assert.equal(key({ ctrlKey: true, key: "y", code: "KeyY" }), "redo");
  });

  test("works by physical key on non-Latin layouts", () => {
    assert.equal(key({ ctrlKey: true, key: "я", code: "KeyZ" }), "undo");
  });

  test("ignores plain keys, Alt combinations and Ctrl+Shift+Y", () => {
    assert.equal(key({}), null);
    assert.equal(key({ ctrlKey: true, altKey: true }), null);
    assert.equal(key({ ctrlKey: true, shiftKey: true, key: "Y", code: "KeyY" }), null);
    assert.equal(key({ ctrlKey: true, key: "c", code: "KeyC" }), null);
  });
});

describe("store: every document operation is one undoable step", () => {
  test("initial state has no history", () => {
    const store = setup();
    assert.deepEqual(depth(store), { past: 0, future: 0 });
    assert.equal(store.getState().undo(), false);
    assert.equal(store.getState().redo(), false);
  });

  test("create → undo removes it → redo restores the identical element", () => {
    const store = setup();
    const element = rect("a");
    store.getState().addElement(element);
    assert.equal(store.getState().undo(), true);
    assert.deepEqual(ids(store), []);
    assert.equal(store.getState().redo(), true);
    assert.equal(store.getState().elements[0], element, "the very same object comes back");
  });

  test("move, resize, endpoint edit and freehand resize are each undone exactly", () => {
    const store = setup();
    for (const element of [rect("a"), line, freehand]) store.getState().addElement(element);
    const original = store.getState().elements;

    store.getState().updateElements([translateElement(original[0]!, 30, 20), translateElement(original[1]!, 30, 20)]); // multi-move
    store.getState().updateElements([mapElement(original[2]!, resizeMap({ x: 200, y: 0, width: 40, height: 10 }, "se", 40, 10))]);
    store.getState().updateElements([{ ...line, end: p(10, 10) } as CanvasElement]);
    assert.deepEqual(depth(store), { past: 6, future: 0 }, "3 creations + 3 edits");

    store.getState().undo();
    store.getState().undo();
    store.getState().undo();
    assert.equal(store.getState().elements, original, "back to the exact same array");
  });

  test("single and multiple deletion restore ids, geometry and ordering", () => {
    const store = setup();
    for (const id of ["a", "b", "c", "d"]) store.getState().addElement(rect(id, id.charCodeAt(0)));
    const before = store.getState().elements;

    store.getState().setSelection(["b"]);
    store.getState().deleteSelected();
    store.getState().deleteElements(["a", "d"]);
    assert.deepEqual(ids(store), ["c"]);

    store.getState().undo();
    assert.deepEqual(ids(store), ["a", "c", "d"]);
    store.getState().undo();
    assert.equal(store.getState().elements, before);
    assert.deepEqual(ids(store), ["a", "b", "c", "d"], "original order");

    store.getState().redo();
    store.getState().redo();
    assert.deepEqual(ids(store), ["c"]);
  });

  test("sequential operations undo in reverse and redo in original order", () => {
    const store = setup();
    store.getState().addElement(rect("a"));
    store.getState().addElement(rect("b"));
    store.getState().addElement(rect("c"));
    store.getState().undo();
    store.getState().undo();
    assert.deepEqual(ids(store), ["a"]);
    store.getState().redo();
    assert.deepEqual(ids(store), ["a", "b"]);
    store.getState().redo();
    assert.deepEqual(ids(store), ["a", "b", "c"]);
  });

  test("a new edit after undo clears redo", () => {
    const store = setup();
    store.getState().addElement(rect("a"));
    store.getState().addElement(rect("b"));
    store.getState().undo();
    assert.equal(depth(store).future, 1);
    store.getState().addElement(rect("c"));
    assert.deepEqual(depth(store), { past: 2, future: 0 });
    assert.equal(store.getState().redo(), false);
  });

  test("no-op operations record nothing", () => {
    const store = setup();
    store.getState().addElement(rect("a"));
    const before = depth(store);
    store.getState().updateElements([rect("a")]); // same geometry, new object (drag away and back)
    store.getState().updateElements([rect("missing")]); // id that doesn't exist
    store.getState().updateElements([]);
    store.getState().deleteElements(["missing"]);
    store.getState().deleteElements([]);
    store.getState().setSelection([]);
    store.getState().deleteSelected(); // nothing selected
    assert.deepEqual(depth(store), before);
  });

  test("the store's history is capped at the limit", () => {
    const store = setup();
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) store.getState().addElement(rect(`e${i}`));
    assert.equal(depth(store).past, HISTORY_LIMIT);
    while (store.getState().undo());
    assert.equal(store.getState().elements.length, 10, "the 10 oldest steps can no longer be undone");
  });

  test("selection, tool, viewport and canvas size are never recorded", () => {
    const store = setup();
    store.getState().addElement(rect("a"));
    const before = depth(store);
    const elements = store.getState().elements;

    store.getState().setSelection(["a"]);
    store.getState().clearSelection();
    store.getState().setActiveTool("hand");
    store.getState().setActiveTool("ellipse");
    store.getState().setCanvasSize({ width: 800, height: 600 });
    store.getState().panViewport(40, 20);
    store.getState().zoomTo(2);
    store.getState().zoomIn();
    store.getState().resetZoom();
    store.getState().fitContent();

    assert.deepEqual(depth(store), before);
    assert.equal(store.getState().elements, elements);
  });

  test("undo / redo leave the viewport and tool alone", () => {
    const store = setup();
    store.getState().addElement(rect("a"));
    store.getState().zoomTo(2);
    store.getState().setActiveTool("diamond");
    const { viewport, activeTool } = store.getState();
    store.getState().undo();
    store.getState().redo();
    assert.equal(store.getState().viewport, viewport);
    assert.equal(store.getState().activeTool, activeTool);
  });

  test("undoing a creation drops it from the selection (no dangling ids)", () => {
    const store = setup();
    store.getState().addElement(rect("a"));
    store.getState().addElement(rect("b"));
    store.getState().setSelection(["a", "b"]);
    store.getState().undo();
    assert.deepEqual(store.getState().selectedIds, ["a"]);
  });

  test("history snapshots are never mutated by later edits", () => {
    const store = setup();
    store.getState().addElement(rect("a"));
    const snapshot = store.getState().elements;
    const frozen = structuredClone(snapshot);
    store.getState().updateElements([translateElement(snapshot[0]!, 99, 99)]);
    store.getState().deleteElements(["a"]);
    assert.deepEqual(snapshot, frozen);
    assert.deepEqual(store.getState().history.past[1], frozen);
  });

  test("unchanged elements are shared between snapshots (no deep copies)", () => {
    const store = setup();
    store.getState().addElement(rect("a"));
    store.getState().addElement(rect("b"));
    const a = store.getState().elements[0];
    store.getState().updateElements([translateElement(store.getState().elements[1]!, 5, 5)]);
    assert.equal(store.getState().elements[0], a);
    assert.equal(store.getState().history.past.at(-1)![0], a);
  });
});
