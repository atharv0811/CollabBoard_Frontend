/**
 * Unit tests for text and image elements: hit testing, bounds, moving, resizing and erasing.
 * Run: bun run test:unit
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_STYLE, type ImageElement, type TextElement } from "../src/features/workspace/canvas/elements.ts";
import { elementBounds, hitTestElement, topmostElementAt } from "../src/features/workspace/canvas/hitTest.ts";
import { createTextElement, measureText, TEXT_FONT_SIZE, withText } from "../src/features/workspace/canvas/text.ts";
import { mapElement, resizeMap, translateElement } from "../src/features/workspace/canvas/transform.ts";
import { createWorkspaceStore } from "../src/features/workspace/store/workspaceStore.ts";

const p = (x: number, y: number) => ({ x, y });

const image: ImageElement = {
  id: "img",
  type: "image",
  style: DEFAULT_STYLE,
  x: 100,
  y: 100,
  width: 200,
  height: 100,
  src: "data:image/png;base64,",
};

describe("text elements", () => {
  test("are sized from their text", () => {
    const text = createTextElement("t", p(10, 20), "one\ntwo");
    const size = measureText("one\ntwo", TEXT_FONT_SIZE);
    assert.deepEqual(elementBounds(text), { x: 10, y: 20, ...size });
    assert.ok(size.height > TEXT_FONT_SIZE * 2 - 1, "two lines are taller than one");
  });

  test("re-measure when the text changes", () => {
    const text = createTextElement("t", p(0, 0), "hi");
    const longer = withText(text, "hello there");
    assert.ok(longer.width > text.width);
    assert.equal(longer.x, 0);
  });

  test("can be hit anywhere inside their box", () => {
    const text = createTextElement("t", p(0, 0), "hello");
    assert.ok(hitTestElement(text, p(text.width / 2, text.height / 2), 0));
    assert.ok(!hitTestElement(text, p(text.width + 20, text.height + 20), 6));
  });

  test("resize scales the font with the box", () => {
    const text = createTextElement("t", p(0, 0), "hello");
    const resized = mapElement(text, resizeMap(elementBounds(text), "se", text.width, text.height)) as TextElement;
    assert.equal(resized.fontSize, text.fontSize * 2);
    assert.ok(Math.abs(resized.height - text.height * 2) < 1e-9);

    const wider = mapElement(text, resizeMap(elementBounds(text), "e", text.width, 0)) as TextElement;
    assert.equal(wider.fontSize, text.fontSize * 2, "a side handle scales too");
  });

  test("move keeps the text and font", () => {
    const text = createTextElement("t", p(0, 0), "hello");
    const moved = translateElement(text, 5, 7);
    assert.deepEqual([moved.x, moved.y, moved.text, moved.fontSize], [5, 7, "hello", text.fontSize]);
  });
});

describe("image elements", () => {
  test("bounds and hit testing use the image box", () => {
    assert.deepEqual(elementBounds(image), { x: 100, y: 100, width: 200, height: 100 });
    assert.equal(topmostElementAt([image], p(200, 150), 0)?.id, "img");
    assert.equal(topmostElementAt([image], p(50, 50), 6), null);
  });

  test("resize maps the box", () => {
    const resized = mapElement(image, resizeMap(elementBounds(image), "se", 100, 50));
    assert.deepEqual([resized.x, resized.y, resized.width, resized.height], [100, 100, 300, 150]);
    assert.equal(resized.src, image.src);
  });
});

describe("eraser", () => {
  test("erasing several elements is one undoable step", () => {
    const store = createWorkspaceStore();
    const text = createTextElement("t", p(0, 0), "hi");
    store.getState().addElement(text);
    store.getState().addElement(image);
    store.getState().deleteElements(["t", "img"]);
    assert.equal(store.getState().elements.length, 0);
    store.getState().undo();
    assert.deepEqual(
      store.getState().elements.map((element) => element.id),
      ["t", "img"],
    );
  });
});
