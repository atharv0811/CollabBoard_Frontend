/**
 * Canvas drawing + viewport regression tests (real browser, no extra dependencies).
 *
 * Starts the Vite dev server, opens /board in headless Chrome via the
 * DevTools Protocol and drives real touch / mouse input:
 *   - "android-like": mobile viewport + touch emulation, loaded over the LAN
 *     IP (an insecure origin, the way a phone opens the dev server)
 *   - "localhost":    same touch setup on a secure origin
 *   - "desktop":      mouse input on a desktop viewport
 *
 * Run:   bun run test:canvas     (or: node scripts/canvas-drawing.test.mjs)
 * Needs: Google Chrome / Chromium. Override the path with CHROME_PATH.
 *
 * Note: this is Chrome's touch pipeline on desktop, not a physical Android
 * device. Verify on a real phone as well.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { networkInterfaces, tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const CANVAS = 'main[aria-label="Whiteboard canvas"] svg';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function lanAddress() {
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return null;
}

// ---------------------------------------------------------------- CDP client

async function launchBrowser() {
  const chromePath = CHROME_CANDIDATES.find((path) => existsSync(path));
  if (!chromePath) throw new Error("Chrome not found. Set CHROME_PATH.");

  const port = 9300 + Math.floor(Math.random() * 600);
  const profile = mkdtempSync(join(tmpdir(), "collabboard-test-"));
  const proc = spawn(
    chromePath,
    ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu", "about:blank"],
    { stdio: "ignore" },
  );

  let page;
  for (let attempt = 0; attempt < 75 && !page; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      page = targets.find((target) => target.type === "page");
    } catch {
      await sleep(200);
    }
  }
  if (!page) throw new Error("Could not connect to Chrome DevTools.");

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener("open", resolve));

  let nextId = 0;
  const pending = new Map();
  const exceptions = [];
  socket.addEventListener("message", (message) => {
    const data = JSON.parse(message.data);
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)(data);
      pending.delete(data.id);
    }
    if (data.method === "Runtime.exceptionThrown") {
      exceptions.push(data.params.exceptionDetails.exception?.description?.split("\n")[0] ?? "unknown error");
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++nextId;
      pending.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    });

  const evaluate = async (expression) =>
    (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.result.value;

  await send("Runtime.enable");
  await send("Page.enable");

  return {
    send,
    evaluate,
    exceptions,
    close() {
      socket.close();
      proc.kill();
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {
        // Chrome may still hold the profile lock on Windows; the OS cleans tmp.
      }
    },
  };
}

// ------------------------------------------------------------ page helpers

function createPage(browser, { url, mode }) {
  const { send, evaluate } = browser;
  const touch = mode !== "desktop";
  const initialSize = touch ? { width: 390, height: 800 } : { width: 1366, height: 800 };

  /** Set the viewport size — also used to simulate a window resize / device rotation. */
  async function resize(width, height) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: touch ? 2 : 1, mobile: touch });
    await sleep(400);
  }

  /** Opens a fresh workspace: boards live only in memory, so a navigation resets them. */
  async function open() {
    await resize(initialSize.width, initialSize.height);
    await send("Emulation.setTouchEmulationEnabled", { enabled: touch, maxTouchPoints: touch ? 5 : 1 });
    browser.exceptions.length = 0;
    await load();
  }

  async function load() {
    await send("Page.navigate", { url });
    for (let attempt = 0; attempt < 80; attempt++) {
      if (await evaluate(`!!document.querySelector('${CANVAS}')`)) {
        // Remember the last pointerId that went down on the canvas (for the lost-capture test).
        await evaluate(`document.querySelector('${CANVAS}').addEventListener('pointerdown', (e) => { window.__lastPointerId = e.pointerId; }, true)`);
        return;
      }
      await sleep(250);
    }
    throw new Error(`Canvas did not render at ${url}`);
  }

  async function toolCenter(label) {
    return evaluate(`(() => {
      const button = [...document.querySelectorAll('button[aria-label="${label}"]')].find((b) => b.offsetParent);
      const r = button.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
  }

  async function touchEvent(type, points) {
    await send("Input.dispatchTouchEvent", { type, touchPoints: points });
  }

  async function mouseEvent(type, x, y, pressed) {
    await send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: pressed ? 1 : 0, clickCount: 1 });
  }

  async function pointerDown(x, y) {
    if (touch) await touchEvent("touchStart", [{ x, y }]);
    else await mouseEvent("mousePressed", x, y, true);
  }
  async function pointerMove(x, y) {
    if (touch) await touchEvent("touchMove", [{ x, y }]);
    else await mouseEvent("mouseMoved", x, y, true);
  }
  async function pointerUp(x, y) {
    if (touch) await touchEvent("touchEnd", []);
    else await mouseEvent("mouseReleased", x, y, false);
    await sleep(120);
  }

  async function tap(x, y) {
    await pointerDown(x, y);
    await sleep(30);
    await pointerUp(x, y);
  }

  /** Press, move in steps, optionally release. */
  async function drag(from, to, { release = true } = {}) {
    await pointerDown(from.x, from.y);
    const steps = 8;
    for (let step = 1; step <= steps; step++) {
      await sleep(16);
      await pointerMove(from.x + ((to.x - from.x) * step) / steps, from.y + ((to.y - from.y) * step) / steps);
    }
    if (release) await pointerUp(to.x, to.y);
  }

  async function selectTool(label) {
    // Chrome's tap recogniser drops the synthesized click when a tap starts
    // within ~150ms of the previous gesture ending. Real users are never that
    // fast, so pause like a person would before tapping the toolbar.
    await sleep(400);
    const center = await toolCenter(label);
    await tap(center.x, center.y);
    return evaluate(`[...document.querySelectorAll('button[aria-label="${label}"]')].some((b) => b.offsetParent && b.getAttribute('aria-pressed') === 'true')`);
  }

  async function shapes() {
    return evaluate(`({
      committed: document.querySelectorAll('${CANVAS} [data-shape-id]').length,
      preview: document.querySelectorAll('${CANVAS} [data-preview]').length,
    })`);
  }

  /** Every committed element's type plus the SVG attributes that define its geometry. */
  async function elements() {
    return evaluate(`(() => {
      const num = (el, name) => Number(el.getAttribute(name));
      const pts = (value) => value.trim().split(/\\s+/).map((pair) => { const [x, y] = pair.split(',').map(Number); return { x, y }; });
      return [...document.querySelectorAll('${CANVAS} [data-shape-id]')].map((el) => {
        const type = el.getAttribute('data-element-type');
        const base = { id: el.getAttribute('data-shape-id'), type, tag: el.tagName };
        if (type === 'rectangle') return { ...base, x: num(el, 'x'), y: num(el, 'y'), width: num(el, 'width'), height: num(el, 'height') };
        if (type === 'ellipse') return { ...base, cx: num(el, 'cx'), cy: num(el, 'cy'), rx: num(el, 'rx'), ry: num(el, 'ry') };
        if (type === 'diamond') return { ...base, vertices: pts(el.getAttribute('points')) };
        if (type === 'line') return { ...base, start: { x: num(el, 'x1'), y: num(el, 'y1') }, end: { x: num(el, 'x2'), y: num(el, 'y2') } };
        if (type === 'arrow') {
          const shaft = el.querySelector('line');
          return { ...base, start: { x: num(shaft, 'x1'), y: num(shaft, 'y1') }, end: { x: num(shaft, 'x2'), y: num(shaft, 'y2') },
            head: pts(el.querySelector('[data-arrowhead]').getAttribute('points')) };
        }
        if (type === 'freehand') {
          const box = el.getBBox();
          return { ...base, d: el.getAttribute('d'), pointCount: num(el, 'data-point-count'), bbox: { x: box.x, y: box.y, width: box.width, height: box.height } };
        }
        return base;
      });
    })()`);
  }

  /** Release capture from the last canvas pointer, as the browser would on unexpected capture loss. */
  async function dropPointerCapture() {
    return evaluate(`(() => {
      const svg = document.querySelector('${CANVAS}');
      const id = window.__lastPointerId;
      const had = svg.hasPointerCapture(id);
      svg.releasePointerCapture(id);
      return had;
    })()`);
  }

  async function mouseClickDrag(from, to, button, { shift = false } = {}) {
    const buttons = { left: 1, right: 2, middle: 4 }[button];
    const modifiers = shift ? 8 : 0;
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: from.x, y: from.y, button, buttons, clickCount: 1, modifiers });
    for (let step = 1; step <= 6; step++) {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: from.x + ((to.x - from.x) * step) / 6, y: from.y + ((to.y - from.y) * step) / 6, button, buttons, modifiers });
    }
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: to.x, y: to.y, button, buttons: 0, clickCount: 1, modifiers });
    await sleep(120);
  }

  /** Stored world attributes + on-screen box (CSS px) of each committed rect, and the viewBox. */
  async function geometry() {
    return evaluate(`(() => {
      const svg = document.querySelector('${CANVAS}');
      const rects = [...svg.querySelectorAll('rect[data-shape-id]')].map((r) => {
        const b = r.getBoundingClientRect();
        return {
          world: { x: +r.getAttribute('x'), y: +r.getAttribute('y'), w: +r.getAttribute('width'), h: +r.getAttribute('height') },
          screen: { x: b.x, y: b.y, w: b.width, h: b.height },
        };
      });
      return { rects, viewBox: svg.getAttribute('viewBox'), svgSize: { w: svg.clientWidth, h: svg.clientHeight } };
    })()`);
  }

  /** Current selection as shown by the overlay, plus handle centres in client px. */
  async function selection() {
    return evaluate(`(() => {
      const g = document.querySelector('${CANVAS} [data-selection]');
      const ids = g ? g.getAttribute('data-selected-ids').split(' ').filter(Boolean) : [];
      const center = (el) => { const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
      const collect = (attr) => Object.fromEntries([...document.querySelectorAll('${CANVAS} [' + attr + ']')].map((h) => [h.getAttribute(attr), center(h)]));
      return { ids, handles: collect('data-handle'), endpoints: collect('data-endpoint'), marquee: !!document.querySelector('${CANVAS} [data-marquee]') };
    })()`);
  }

  /** Click (mouse, optionally with Shift) or tap (touch). */
  async function click(point, { shift = false } = {}) {
    if (touch) {
      await pointerDown(point.x, point.y);
      await sleep(30);
      await pointerUp(point.x, point.y);
      return;
    }
    const modifiers = shift ? 8 : 0;
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", buttons: 1, clickCount: 1, modifiers });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", buttons: 0, clickCount: 1, modifiers });
    await sleep(120);
  }

  /** Moves the mouse with no button pressed and returns the canvas cursor. */
  async function hover(point) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y, button: "none", buttons: 0 });
    await sleep(50);
    return canvasCursor();
  }

  async function canvasCursor() {
    return evaluate(`getComputedStyle(document.querySelector('${CANVAS}')).cursor`);
  }

  /** Wheel event at `point` (mouse wheel by default; ctrl simulates trackpad pinch). */
  async function wheel(point, { deltaX = 0, deltaY = 0, ctrl = false } = {}) {
    await send("Input.dispatchMouseEvent", {
      type: "mouseWheel", x: point.x, y: point.y, deltaX, deltaY, modifiers: ctrl ? 2 : 0,
    });
    await sleep(80);
  }

  /** Clicks / taps the visible button with this aria-label (toolbar or zoom controls). */
  async function press(label) {
    // Chrome suppresses the click of a tap that follows a drag too closely (measured:
    // lost at 400ms after a pan, delivered at 800ms+), so pause like a person would.
    await sleep(800);
    await click(await toolCenter(label));
  }

  /** Viewport as rendered: zoom % from the controls, and the SVG viewBox. */
  async function view() {
    return evaluate(`(() => {
      const svg = document.querySelector('${CANVAS}');
      const [x, y, width, height] = (svg.getAttribute('viewBox') ?? '').split(' ').map(Number);
      const level = [...document.querySelectorAll('[data-zoom-level]')].find((el) => el.offsetParent);
      return { percent: Number(level?.getAttribute('data-zoom-level')), viewBox: { x, y, width, height }, size: { width: svg.clientWidth, height: svg.clientHeight } };
    })()`);
  }

  /** On-screen boxes (client px) of committed elements, and of drawn handles. */
  async function screenBoxes() {
    return evaluate(`(() => {
      const box = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
      return {
        elements: [...document.querySelectorAll('${CANVAS} [data-shape-id]')].map(box),
        handles: [...document.querySelectorAll('${CANVAS} [data-handle]')].map(box),
      };
    })()`);
  }

  /** Ctrl (or ⌘ with meta) + key, optionally with Shift — e.g. modKey("z", { shift: true }). */
  async function modKey(letter, { shift = false, meta = false } = {}) {
    const upper = letter.toUpperCase();
    const modifiers = (meta ? 4 : 2) | (shift ? 8 : 0);
    for (const type of ["keyDown", "keyUp"]) {
      await send("Input.dispatchKeyEvent", {
        type, modifiers, key: shift ? upper : letter, code: `Key${upper}`,
        windowsVirtualKeyCode: upper.charCodeAt(0), nativeVirtualKeyCode: upper.charCodeAt(0),
      });
    }
    await sleep(80);
  }

  /** Undo / redo depth and button state, as shown by the visible History toolbar. */
  async function history() {
    return evaluate(`(() => {
      const bar = [...document.querySelectorAll('[aria-label="History"]')].find((el) => el.offsetParent);
      const button = (label) => bar?.querySelector('button[aria-label="' + label + '"]');
      return {
        undo: Number(bar?.getAttribute('data-undo-depth')),
        redo: Number(bar?.getAttribute('data-redo-depth')),
        undoEnabled: !button('Undo')?.disabled,
        redoEnabled: !button('Redo')?.disabled,
      };
    })()`);
  }

  /** Boards listed in the menu (opens it if needed). */
  async function boardList() {
    await openMenu();
    return evaluate(`[...document.querySelectorAll('[data-board-id]')].map((row) => ({
      id: row.getAttribute('data-board-id'),
      name: row.querySelector('[data-board-name]')?.textContent ?? row.textContent.trim(),
      active: !!row.querySelector('[aria-current="page"]'),
    }))`);
  }

  async function openMenu() {
    const open = await evaluate(`!!document.querySelector('#workspace-menu')`);
    if (!open) await press("Open board menu");
  }

  async function closeMenu() {
    const open = await evaluate(`!!document.querySelector('#workspace-menu')`);
    if (open) await press("Close board menu");
  }

  /** Clicks the visible button whose text is exactly `text` (e.g. a dialog button). */
  async function pressText(text) {
    await sleep(400);
    const center = await evaluate(`(() => {
      const button = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(text)} && b.getClientRects().length);
      if (!button) return null;
      const r = button.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    if (!center) throw new Error(`No visible button "${text}"`);
    await click(center);
  }

  /** Replaces the focused field's (selected) text, as typing would. */
  async function type(text) {
    await evaluate(`document.activeElement.select?.()`);
    await send("Input.insertText", { text });
    await sleep(80);
  }

  async function createBoard(name) {
    await openMenu();
    await press("New board");
    await type(name);
    await pressText("Create board");
    await sleep(200);
  }

  async function key(name) {
    const codes = { Delete: 46, Backspace: 8, Escape: 27 };
    for (const type of ["keyDown", "keyUp"]) {
      await send("Input.dispatchKeyEvent", { type, key: name, code: name, windowsVirtualKeyCode: codes[name], nativeVirtualKeyCode: codes[name] });
    }
    await sleep(100);
  }

  return {
    open, drag, selectTool, shapes, elements, geometry, resize, touchEvent, toolCenter,
    dropPointerCapture, mouseClickDrag, pointerDown, pointerMove, pointerUp, touch,
    selection, click, key, evaluate, hover, canvasCursor,
    wheel, press, view, screenBoxes, send, modKey, history,
    boardList, openMenu, closeMenu, pressText, type, createBoard,
  };
}

// ----------------------------------------------------- selection test helpers

/** One element of each type at fixed spots, with a point on each stroke. */
function layout(mode) {
  const cells = mode === "desktop"
    ? [[300, 200, 420, 290], [480, 200, 600, 290], [660, 200, 780, 290], [300, 420, 420, 500], [480, 420, 600, 500], [660, 420, 780, 500]]
    : [[40, 110, 160, 190], [220, 110, 340, 190], [40, 250, 160, 330], [220, 250, 340, 330], [40, 390, 160, 470], [220, 390, 340, 470]];
  return DRAWING_TOOLS.map(({ type, label }, index) => {
    const [x0, y0, x1, y1] = cells[index];
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const hit = {
      rectangle: { x: cx, y: y0 }, // top edge
      ellipse: { x: x1, y: cy }, // right-most point
      diamond: { x: (x0 + cx) / 2, y: (y0 + cy) / 2 }, // middle of the top-left edge
    }[type] ?? { x: cx, y: cy }; // line, arrow, freehand: middle of the stroke
    return { type, label, from: { x: x0, y: y0 }, to: { x: x1, y: y1 }, box: [x0, y0, x1, y1], hit };
  });
}

/** Draws one element per tool, switches to Select, and returns layout + element ids by type. */
async function drawAll(page, mode) {
  const items = layout(mode);
  for (const item of items) {
    await page.selectTool(item.label);
    await page.drag(item.from, item.to);
  }
  await page.selectTool("Select");
  const drawn = await page.elements();
  return items.map((item, index) => ({ ...item, id: drawn[index]?.id }));
}

/** Expected DOM geometry after moving by (dx, dy): every x / cx and y / cy shifts. */
function shifted(value, dx, dy) {
  if (Array.isArray(value)) return value.map((item) => shifted(item, dx, dy));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key,
        typeof v === "number" && (key === "x" || key === "cx") ? v + dx
          : typeof v === "number" && (key === "y" || key === "cy") ? v + dy
            : shifted(v, dx, dy),
      ]),
    );
  }
  return value;
}

/** Recursively compares numbers within 1px; ignores the path string `d`. */
function nearDeep(fail, label, actual, expected) {
  if (typeof expected === "number") return near(fail, label, actual, expected);
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) return fail(`${label}: length mismatch`);
    return expected.forEach((item, index) => nearDeep(fail, `${label}[${index}]`, actual[index], item));
  }
  if (expected && typeof expected === "object") {
    for (const [key, value] of Object.entries(expected)) {
      if (key !== "d") nearDeep(fail, `${label}.${key}`, actual?.[key], value);
    }
    return;
  }
  if (actual !== expected) fail(`${label}: expected ${expected}, got ${actual}`);
}

const byId = (list, id) => list.find((element) => element.id === id);
const sameList = (a, b) => [...a].sort().join(",") === [...b].sort().join(",");

// ------------------------------------------------------------ assertions

/** Records a failure unless |actual - expected| <= tolerance (CSS px). */
function near(fail, label, actual, expected, tolerance = 1) {
  if (Math.abs(actual - expected) > tolerance) fail(`${label}: expected ≈${expected}, got ${actual}`);
}

/** Asserts a rect's on-screen box matches the dragged pointer path exactly. */
function expectScreenBox(fail, label, rect, from, to) {
  if (!rect) return fail(`${label}: rectangle missing`);
  near(fail, `${label} left`, rect.screen.x, Math.min(from.x, to.x));
  near(fail, `${label} top`, rect.screen.y, Math.min(from.y, to.y));
  near(fail, `${label} width`, rect.screen.w, Math.abs(to.x - from.x));
  near(fail, `${label} height`, rect.screen.h, Math.abs(to.y - from.y));
}

// --------------------------------------------------------------- the tests

/** Spots inside the empty canvas area for each viewport. */
function areas(mode) {
  return mode === "desktop"
    ? [
        [{ x: 420, y: 200 }, { x: 600, y: 320 }],
        [{ x: 700, y: 250 }, { x: 900, y: 420 }],
        [{ x: 500, y: 480 }, { x: 760, y: 640 }],
      ]
    : [
        [{ x: 60, y: 120 }, { x: 180, y: 220 }],
        [{ x: 220, y: 300 }, { x: 330, y: 420 }],
        [{ x: 80, y: 470 }, { x: 200, y: 590 }],
      ];
}

/** A drag near the left and the right edge of the canvas (clear of floating UI). */
function edgeDrags(mode) {
  return mode === "desktop"
    ? [[{ x: 300, y: 300 }, { x: 360, y: 400 }], [{ x: 1290, y: 300 }, { x: 1362, y: 420 }]]
    : [[{ x: 3, y: 120 }, { x: 70, y: 200 }], [{ x: 320, y: 250 }, { x: 387, y: 330 }]];
}

/** Viewport after a resize / rotation. */
function resizeTarget(mode) {
  return mode === "desktop"
    ? { label: "resize 1366×800 → 1000×700", width: 1000, height: 700 }
    : { label: "rotate portrait 390×800 → landscape 800×390", width: 800, height: 390 };
}

function defineTests(page, mode) {
  const [a, b, c] = areas(mode);
  const touchOnly = mode !== "desktop";
  const target = resizeTarget(mode);

  return [
    {
      name: "A: draw two rectangles consecutively — both remain",
      async run(expect) {
        await page.drag(...a);
        await page.drag(...b);
        expect(await page.shapes(), { committed: 2, preview: 0 });
      },
    },
    {
      name: "B: cancel a second interaction — first rectangle remains",
      skip: !touchOnly && "touchCancel only applies to touch input",
      async run(expect) {
        await page.drag(...a);
        await page.drag(...b, { release: false });
        await page.touchEvent("touchCancel", []);
        await sleep(120);
        expect(await page.shapes(), { committed: 1, preview: 0 });
      },
    },
    {
      name: "C: draw three rectangles consecutively — all three remain",
      async run(expect) {
        await page.drag(...a);
        await page.drag(...b);
        await page.drag(...c);
        expect(await page.shapes(), { committed: 3, preview: 0 });
      },
    },
    {
      name: "D: release over the toolbar (outside the drawing area) — completes safely",
      async run(expect) {
        const toolbarSpot = await page.toolCenter("Line");
        await page.drag(a[0], toolbarSpot);
        expect(await page.shapes(), { committed: 1, preview: 0 });
      },
    },
    {
      name: "E: switch tool after drawing — rectangles stay, select tool draws nothing",
      async run(expect) {
        await page.drag(...a);
        await page.drag(...b);
        expect({ selectToolActive: await page.selectTool("Select") }, { selectToolActive: true });
        await page.drag(...c);
        expect(await page.shapes(), { committed: 2, preview: 0 });
      },
    },
    {
      name: "F: a square drag renders as a square, a rectangle keeps its proportions",
      async run(expect, fail) {
        const square = [{ x: 100, y: 150 }, { x: 200, y: 250 }];
        const wide = [{ x: 100, y: 300 }, { x: 260, y: 360 }];
        await page.drag(...square);
        await page.drag(...wide);
        const { rects, viewBox, svgSize } = await page.geometry();
        expectScreenBox(fail, "square", rects[0], ...square);
        expectScreenBox(fail, "rectangle", rects[1], ...wide);
        if (rects[0]) near(fail, "square world width vs height", rects[0].world.w, rects[0].world.h);
        expect({ viewBox }, { viewBox: `0 0 ${svgSize.w} ${svgSize.h}` });
      },
    },
    {
      name: "G: pointer maps exactly near the canvas edges",
      async run(_expect, fail) {
        const drags = edgeDrags(mode);
        for (const drag of drags) await page.drag(...drag);
        const { rects } = await page.geometry();
        drags.forEach((drag, index) => expectScreenBox(fail, `edge drag ${index + 1}`, rects[index], ...drag));
      },
    },
    {
      name: `H: ${target.label} — shapes keep world + screen position, new drags stay accurate`,
      async run(expect, fail) {
        const first = [{ x: 100, y: 150 }, { x: 200, y: 250 }];
        await page.drag(...first);
        const initial = (await page.geometry()).rects[0];

        await page.resize(target.width, target.height);
        const resized = await page.geometry();
        expect({ viewBox: resized.viewBox }, { viewBox: `0 0 ${resized.svgSize.w} ${resized.svgSize.h}` });
        expect({ size: `${resized.svgSize.w}x${resized.svgSize.h}` }, { size: `${target.width}x${target.height}` });
        if (!initial || !resized.rects[0]) return fail("rectangle missing after resize");
        expect(resized.rects[0].world, initial.world);
        for (const key of ["x", "y", "w", "h"]) {
          near(fail, `screen ${key} after resize`, resized.rects[0].screen[key], initial.screen[key]);
        }

        const after = [{ x: 300, y: 120 }, { x: 420, y: 200 }];
        await page.drag(...after);
        expectScreenBox(fail, "drag after resize", (await page.geometry()).rects[1], ...after);
      },
    },

    // ---- Milestone 2: every tool, pointer identity, capture loss, tiny drawings

    ...DRAWING_TOOLS.map(({ type, label }) => ({
      name: `I-${type}: ${label} draws correct geometry in all four directions`,
      async run(expect, fail) {
        expect({ toolActive: await page.selectTool(label) }, { toolActive: true });
        const drags = fourDirections(mode);
        for (const drag of drags) await page.drag(...drag);
        const drawn = await page.elements();
        expect({ count: drawn.length }, { count: 4 });
        drags.forEach((drag, index) => checkElement(fail, `${DIRECTION_NAMES[index]}`, drawn[index], type, ...drag));
      },
    })),
    {
      name: "J: freehand records each distinct sample once and renders one continuous path",
      async run(expect, fail) {
        expect({ toolActive: await page.selectTool("Draw") }, { toolActive: true });
        const origin = mode === "desktop" ? { x: 400, y: 250 } : { x: 40, y: 150 };
        const zigzag = Array.from({ length: 10 }, (_, i) => ({ x: origin.x + (i + 1) * 25, y: origin.y + ((i + 1) % 2) * 40 }));
        await page.pointerDown(origin.x, origin.y);
        for (const point of zigzag) {
          await sleep(16);
          await page.pointerMove(point.x, point.y);
        }
        const last = zigzag[zigzag.length - 1];
        for (let i = 0; i < 5; i++) {
          await sleep(16);
          await page.pointerMove(last.x, last.y); // duplicates must not be stored
        }
        await page.pointerUp(last.x, last.y);

        const [stroke] = await page.elements();
        if (!stroke) return fail("no freehand element");
        expect({ pointCount: stroke.pointCount }, { pointCount: 1 + zigzag.length });
        expect({ subpaths: stroke.d.match(/M/g)?.length }, { subpaths: 1 });
        near(fail, "bbox left", stroke.bbox.x, origin.x);
        near(fail, "bbox top", stroke.bbox.y, origin.y);
        near(fail, "bbox width", stroke.bbox.width, zigzag.length * 25);
      },
    },
    {
      name: "K: a second finger cannot start, update or finish the active drawing",
      skip: !touchOnly && "multi-touch only",
      async run(expect, fail) {
        const A = (x, y) => ({ id: 0, x, y });
        const B = (x, y) => ({ id: 1, x, y });
        await page.touchEvent("touchStart", [A(60, 150)]);
        await sleep(16);
        await page.touchEvent("touchMove", [A(100, 190)]);
        await sleep(16);
        await page.touchEvent("touchStart", [A(100, 190), B(300, 500)]); // second finger lands
        await sleep(16);
        await page.touchEvent("touchMove", [A(110, 200), B(340, 560)]);
        await sleep(16);
        await page.touchEvent("touchMove", [A(140, 230), B(360, 600)]);
        await sleep(16);
        // CDP's touchEnd lists the touch points that END (verified by logging pointer events).
        await page.touchEvent("touchEnd", [B(360, 600)]); // second finger lifts first
        await sleep(60);
        expect(await page.shapes(), { committed: 0, preview: 1 });
        await page.touchEvent("touchMove", [A(180, 260)]);
        await sleep(16);
        await page.touchEvent("touchEnd", [A(180, 260)]);
        await sleep(150);

        expect(await page.shapes(), { committed: 1, preview: 0 });
        const [rect] = await page.elements();
        if (rect) checkElement(fail, "first finger", rect, "rectangle", { x: 60, y: 150 }, { x: 180, y: 260 });
      },
    },
    {
      name: "L: right mouse button does not draw",
      skip: touchOnly && "mouse only",
      async run(expect) {
        await page.mouseClickDrag(a[0], a[1], "right");
        expect(await page.shapes(), { committed: 0, preview: 0 });
        await page.drag(...b);
        expect(await page.shapes(), { committed: 1, preview: 0 });
      },
    },
    {
      name: "M: losing pointer capture discards only the unfinished drawing and nothing gets stuck",
      async run(expect) {
        await page.drag(...a);
        await page.drag(...b, { release: false });
        expect(await page.shapes(), { committed: 1, preview: 1 });

        expect({ hadCapture: await page.dropPointerCapture() }, { hadCapture: true });

        // Per the Pointer Events spec, lostpointercapture may wait until the next
        // pointer event (Chrome does this for mice). The orphaned pointer moves on:
        // the draft must be gone and the move must not revive it.
        await page.pointerMove(b[1].x + 20, b[1].y + 20);
        await sleep(60);
        expect(await page.shapes(), { committed: 1, preview: 0 });

        // ...and releasing it must not commit anything.
        await page.pointerUp(b[1].x + 20, b[1].y + 20);
        expect(await page.shapes(), { committed: 1, preview: 0 });

        await page.drag(...c); // a fresh gesture still works
        expect(await page.shapes(), { committed: 2, preview: 0 });
      },
    },
    {
      name: "N: taps and 1px drags create nothing, for every tool",
      async run(expect) {
        for (const { label } of DRAWING_TOOLS) {
          expect({ [`${label} active`]: await page.selectTool(label) }, { [`${label} active`]: true });
          await page.drag(a[0], { x: a[0].x + 1, y: a[0].y + 1 });
        }
        expect(await page.shapes(), { committed: 0, preview: 0 });
      },
    },
    {
      name: "O: consecutive drawings with different tools all persist, in order",
      async run(expect) {
        const sequence = ["Rectangle", "Ellipse", "Arrow", "Draw"];
        const spots = [a, b, c, fourDirections(mode)[3]];
        for (const [index, label] of sequence.entries()) {
          await page.selectTool(label);
          await page.drag(...spots[index]);
        }
        const types = (await page.elements()).map((el) => el.type).join(",");
        expect({ types }, { types: "rectangle,ellipse,arrow,freehand" });
      },
    },

    // ---- Milestone 3: selection, move, multi-select, resize, delete

    {
      name: "S1: clicking each element type selects it; clicking empty canvas deselects",
      async run(expect, fail) {
        const items = await drawAll(page, mode);
        for (const item of items) {
          await page.click(item.hit);
          const { ids } = await page.selection();
          if (!(ids.length === 1 && ids[0] === item.id)) fail(`${item.type}: selection ${JSON.stringify(ids)}`);
          await page.click(item.hit); // clicking it again keeps it selected
          const again = await page.selection();
          if (!(again.ids.length === 1 && again.ids[0] === item.id)) fail(`${item.type}: re-click changed selection`);
        }
        const empty = mode === "desktop" ? { x: 1000, y: 600 } : { x: 300, y: 600 };
        await page.click(empty);
        expect({ selected: (await page.selection()).ids.length }, { selected: 0 });
        expect(await page.shapes(), { committed: 6, preview: 0 });
      },
    },
    {
      name: "S2: overlapping strokes — the topmost (last drawn) element is selected",
      async run(expect) {
        const [x0, y0, x1, y1] = mode === "desktop" ? [400, 250, 600, 400] : [80, 200, 300, 360];
        await page.drag({ x: x0, y: y0 }, { x: x1, y: y1 }); // rectangle (tool preselected)
        expect({ ellipse: await page.selectTool("Ellipse") }, { ellipse: true });
        await page.drag({ x: x0, y: y0 }, { x: x1, y: y1 }); // ellipse in the same box, on top
        await page.selectTool("Select");
        const [rect, ellipse] = await page.elements();
        await page.click({ x: (x0 + x1) / 2, y: y0 }); // both strokes pass through the top-centre
        expect({ selected: (await page.selection()).ids.join() }, { selected: ellipse.id });
        // On the rectangle's left edge, 15% down: clear of the ellipse stroke and the ellipse selection's handles.
        await page.click({ x: x0, y: y0 + (y1 - y0) * 0.15 });
        expect({ selected: (await page.selection()).ids.join() }, { selected: rect.id });
      },
    },
    {
      name: "S3: Shift-click adds to and removes from the selection",
      skip: touchOnly && "needs a keyboard modifier",
      async run(expect) {
        const [rect, ellipse, diamond] = await drawAll(page, mode);
        await page.click(rect.hit);
        await page.click(ellipse.hit, { shift: true });
        await page.click(diamond.hit, { shift: true });
        expect({ ids: (await page.selection()).ids.join() }, { ids: [rect.id, ellipse.id, diamond.id].join() });
        await page.click(rect.hit, { shift: true });
        expect({ ids: (await page.selection()).ids.join() }, { ids: [ellipse.id, diamond.id].join() });
      },
    },
    {
      name: "S4: dragging moves each element type by exactly the drag distance, size unchanged",
      async run(expect, fail) {
        const items = await drawAll(page, mode);
        const before = await page.elements();
        const [dx, dy] = [30, 25];
        for (const item of items) await page.drag(item.hit, { x: item.hit.x + dx, y: item.hit.y + dy });
        const after = await page.elements();
        for (const item of items) nearDeep(fail, item.type, byId(after, item.id), shifted(byId(before, item.id), dx, dy));
        expect(await page.shapes(), { committed: 6, preview: 0 }); // moving never draws
      },
    },
    {
      name: "S5: marquee selects fully contained elements; they move together keeping relative positions",
      async run(expect, fail) {
        const items = await drawAll(page, mode);
        const [a1, a2] = items; // first two cells of the layout
        const pad = 30; // marquees must start clear of the selection's handles (18px touch radius)
        const marqueeFrom = { x: Math.min(a1.box[0], a2.box[0]) - pad, y: Math.min(a1.box[1], a2.box[1]) - pad };
        const marqueeTo = { x: Math.max(a1.box[2], a2.box[2]) + pad, y: Math.max(a1.box[3], a2.box[3]) + pad };
        await page.click({ x: 5, y: marqueeTo.y + 300 }); // start from a clean selection
        await page.drag(marqueeFrom, marqueeTo);
        const { ids, marquee } = await page.selection();
        if (!sameList(ids, [a1.id, a2.id])) fail(`marquee selected ${JSON.stringify(ids)}`);
        expect({ marqueeVisibleAfterRelease: marquee }, { marqueeVisibleAfterRelease: false });

        // A marquee that only partly covers an element does not select it.
        await page.drag(marqueeFrom, { x: (a1.box[0] + a1.box[2]) / 2, y: marqueeTo.y });
        const partial = (await page.selection()).ids;
        if (partial.length !== 0) fail(`partial marquee selected ${JSON.stringify(partial)}`);

        await page.drag(marqueeFrom, marqueeTo);
        const before = await page.elements();
        const [dx, dy] = [20, 30];
        await page.drag(a1.hit, { x: a1.hit.x + dx, y: a1.hit.y + dy });
        const after = await page.elements();
        for (const item of items) {
          const moved = item.id === a1.id || item.id === a2.id;
          nearDeep(fail, item.type, byId(after, item.id), moved ? shifted(byId(before, item.id), dx, dy) : byId(before, item.id));
        }
      },
    },
    {
      name: "S6: Shift+marquee adds to the selection; a plain marquee replaces it",
      skip: touchOnly && "needs a keyboard modifier",
      async run(expect) {
        const items = await drawAll(page, mode);
        const last = items[5];
        await page.click(items[0].hit);
        const around = (box) => [{ x: box[0] - 10, y: box[1] - 10 }, { x: box[2] + 10, y: box[3] + 10 }];
        const [from, to] = around(last.box);
        await page.mouseClickDrag(from, to, "left", { shift: true });
        expect({ ids: (await page.selection()).ids.join() }, { ids: [items[0].id, last.id].join() });
        // A plain marquee must start outside the current selection box (inside it would move the selection).
        await page.drag({ x: last.box[2] + 20, y: last.box[3] + 20 }, { x: last.box[0] - 10, y: last.box[1] - 10 });
        expect({ ids: (await page.selection()).ids.join() }, { ids: last.id });
      },
    },
    {
      name: "S7: corner and edge handles resize, including past the opposite edge and down to the minimum",
      async run(expect, fail) {
        const [x0, y0, x1, y1] = mode === "desktop" ? [500, 250, 700, 400] : [100, 200, 260, 330];
        await page.drag({ x: x0, y: y0 }, { x: x1, y: y1 });
        await page.selectTool("Select");
        await page.click({ x: (x0 + x1) / 2, y: y0 });

        const rectNow = async () => (await page.elements())[0];
        const dragHandle = async (handle, dx, dy) => {
          const position = (await page.selection()).handles[handle];
          if (!position) return fail(`handle ${handle} not shown`);
          await page.drag(position, { x: position.x + dx, y: position.y + dy });
        };

        await dragHandle("se", 40, 30); // corner: grow
        nearDeep(fail, "se", await rectNow(), { x: x0, y: y0, width: x1 - x0 + 40, height: y1 - y0 + 30 });

        await dragHandle("n", 0, -20); // edge: only the top moves
        nearDeep(fail, "n", await rectNow(), { x: x0, y: y0 - 20, width: x1 - x0 + 40, height: y1 - y0 + 50 });

        await dragHandle("w", 25, 0); // edge: only the left moves
        let r = await rectNow();
        nearDeep(fail, "w", r, { x: x0 + 25, y: y0 - 20, width: x1 - x0 + 15, height: y1 - y0 + 50 });

        // Negative direction: drag the right edge 60px past the left edge → the box flips.
        await dragHandle("e", -(r.width + 60), 0);
        nearDeep(fail, "e flipped", await rectNow(), { x: r.x - 60, y: r.y, width: 60, height: r.height });

        // Minimum size: drag the bottom edge to 2px below the top → clamps at 8.
        r = await rectNow();
        await dragHandle("s", 0, -(r.height - 2));
        nearDeep(fail, "s min", await rectNow(), { x: r.x, y: r.y, width: r.width, height: 8 });
        expect(await page.shapes(), { committed: 1, preview: 0 });
      },
    },
    {
      name: "S8: line and arrow endpoints move independently; dragging the body moves the whole",
      async run(expect, fail) {
        for (const label of ["Line", "Arrow"]) {
          await page.open();
          await page.selectTool(label);
          const [from, to] = mode === "desktop" ? [{ x: 450, y: 300 }, { x: 650, y: 400 }] : [{ x: 80, y: 220 }, { x: 260, y: 360 }];
          await page.drag(from, to);
          await page.selectTool("Select");
          await page.click({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });

          const { endpoints, handles } = await page.selection();
          expect({ [`${label} box handles`]: Object.keys(handles).length }, { [`${label} box handles`]: 0 });
          if (!endpoints.end) return fail(`${label}: no endpoint handles`);
          await page.drag(endpoints.end, { x: endpoints.end.x + 40, y: endpoints.end.y - 30 });
          let el = (await page.elements())[0];
          nearDeep(fail, `${label} end moved`, el, { start: from, end: { x: to.x + 40, y: to.y - 30 } });
          if (label === "Arrow") nearDeep(fail, "arrowhead tip follows", el.head[1], el.end);

          const mid = { x: (el.start.x + el.end.x) / 2, y: (el.start.y + el.end.y) / 2 };
          await page.drag(mid, { x: mid.x - 20, y: mid.y + 15 });
          el = (await page.elements())[0];
          nearDeep(fail, `${label} body moved`, el, {
            start: { x: from.x - 20, y: from.y + 15 },
            end: { x: to.x + 40 - 20, y: to.y - 30 + 15 },
          });
        }
      },
    },
    {
      name: "S9: freehand resizes proportionally through its box",
      async run(expect, fail) {
        await page.selectTool("Draw");
        const [from, to] = mode === "desktop" ? [{ x: 450, y: 300 }, { x: 650, y: 400 }] : [{ x: 80, y: 220 }, { x: 260, y: 360 }];
        await page.drag(from, to);
        await page.selectTool("Select");
        await page.click({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
        const before = (await page.elements())[0];
        const se = (await page.selection()).handles.se;
        if (!se) return fail("no se handle");
        await page.drag(se, { x: se.x + 60, y: se.y + 40 });
        const after = (await page.elements())[0];
        expect({ pointCount: after.pointCount }, { pointCount: before.pointCount });
        nearDeep(fail, "bbox", after.bbox, { x: before.bbox.x, y: before.bbox.y, width: before.bbox.width + 60, height: before.bbox.height + 40 });
      },
    },
    {
      name: "S10: cancel, lost capture and tool switches mid-drag revert only the unfinished move/resize",
      async run(expect, fail) {
        const [x0, y0, x1, y1] = mode === "desktop" ? [500, 250, 700, 400] : [100, 200, 260, 330];
        await page.drag({ x: x0, y: y0 }, { x: x1, y: y1 });
        await page.selectTool("Select");
        const hit = { x: x0 + (x1 - x0) / 4, y: y0 }; // on the top edge, clear of the n / nw handles
        await page.click(hit);
        const original = (await page.elements())[0];

        // 1. Lost pointer capture during a resize.
        const se = (await page.selection()).handles.se;
        await page.drag(se, { x: se.x + 50, y: se.y + 50 }, { release: false });
        if ((await page.dropPointerCapture()) !== true) fail("resize had no pointer capture");
        await page.pointerMove(se.x + 70, se.y + 70);
        await page.pointerUp(se.x + 70, se.y + 70);
        nearDeep(fail, "after lost capture", (await page.elements())[0], original);

        // 2. Tool switched mid-move (e.g. by a shortcut): the move is abandoned.
        await page.drag(hit, { x: hit.x + 40, y: hit.y + 40 }, { release: false });
        await page.evaluate(`[...document.querySelectorAll('button[aria-label="Ellipse"]')].find((b) => b.offsetParent).click()`);
        await sleep(60);
        await page.pointerMove(hit.x + 60, hit.y + 60);
        await page.pointerUp(hit.x + 60, hit.y + 60);
        nearDeep(fail, "after tool switch", (await page.elements())[0], original);
        expect(await page.shapes(), { committed: 1, preview: 0 });
        await page.selectTool("Select");

        if (touchOnly) {
          // 3. touchcancel during a move.
          await page.drag(hit, { x: hit.x + 30, y: hit.y + 30 }, { release: false });
          await page.touchEvent("touchCancel", []);
          await sleep(100);
          nearDeep(fail, "after touchcancel", (await page.elements())[0], original);
        }

        // 4. Still fully usable afterwards.
        await page.drag(hit, { x: hit.x + 10, y: hit.y + 10 });
        nearDeep(fail, "normal move after", (await page.elements())[0], shifted(original, 10, 10));
      },
    },
    {
      name: "S11: a second finger cannot interfere with an active move",
      skip: !touchOnly && "multi-touch only",
      async run(expect, fail) {
        const [x0, y0, x1, y1] = [100, 200, 260, 330];
        await page.drag({ x: x0, y: y0 }, { x: x1, y: y1 });
        await page.selectTool("Select");
        await page.click({ x: 180, y: y0 });
        const original = (await page.elements())[0];
        const A = (x, y) => ({ id: 0, x, y });
        const B = (x, y) => ({ id: 1, x, y });
        // Finger A grabs the top edge clear of the n / nw handles; finger B lands on empty canvas.
        await page.touchEvent("touchStart", [A(140, y0)]);
        await sleep(16);
        await page.touchEvent("touchMove", [A(150, y0 + 10)]);
        await sleep(16);
        await page.touchEvent("touchStart", [A(150, y0 + 10), B(320, 620)]);
        await sleep(16);
        await page.touchEvent("touchMove", [A(160, y0 + 20), B(250, 680)]);
        await sleep(16);
        await page.touchEvent("touchEnd", [B(250, 680)]);
        await sleep(16);
        await page.touchEvent("touchMove", [A(170, y0 + 30)]);
        await sleep(16);
        await page.touchEvent("touchEnd", [A(170, y0 + 30)]);
        await sleep(150);

        nearDeep(fail, "moved by finger A only", (await page.elements())[0], shifted(original, 30, 30));
        expect({ stillSelected: (await page.selection()).ids.length }, { stillSelected: 1 });
      },
    },
    {
      name: "S12: Delete / Backspace / Delete button remove the selection; typing in a field does not",
      async run(expect, fail) {
        const items = await drawAll(page, mode);
        await page.click(items[0].hit);
        await page.key("Delete");
        expect({ count: (await page.elements()).length, selected: (await page.selection()).ids.length }, { count: 5, selected: 0 });

        // Multiple: marquee around the last two cells, then Backspace.
        const [c4, c5] = [items[4], items[5]];
        await page.drag(
          { x: Math.min(c4.box[0], c5.box[0]) - 10, y: Math.min(c4.box[1], c5.box[1]) - 10 },
          { x: Math.max(c4.box[2], c5.box[2]) + 10, y: Math.max(c4.box[3], c5.box[3]) + 10 },
        );
        expect({ selectedBeforeBackspace: (await page.selection()).ids.length }, { selectedBeforeBackspace: 2 });
        await page.key("Backspace");
        const remaining = (await page.elements()).map((el) => el.id);
        if (!sameList(remaining, [items[1].id, items[2].id, items[3].id])) fail(`remaining ${JSON.stringify(remaining)}`);

        // The Delete action in the UI.
        await page.click(items[1].hit);
        await page.evaluate(`[...document.querySelectorAll('button[aria-label^="Delete"]')].find((b) => b.offsetParent).click()`);
        await sleep(100);
        expect({ afterButton: (await page.elements()).length, selected: (await page.selection()).ids.length }, { afterButton: 2, selected: 0 });

        // Typing in an input must not delete.
        await page.click(items[2].hit);
        await page.evaluate(`(() => { const i = document.createElement('input'); i.id = 'test-input'; i.value = 'abc'; document.body.append(i); i.focus(); })()`);
        await page.key("Backspace");
        await page.key("Delete");
        expect({ whileTyping: (await page.elements()).length }, { whileTyping: 2 });
        expect({ inputStillWorks: await page.evaluate(`document.getElementById('test-input').value`) }, { inputStillWorks: "ab" });
        await page.evaluate(`document.getElementById('test-input').remove()`);
        await page.key("Delete");
        expect({ afterBlur: (await page.elements()).length }, { afterBlur: 1 });
      },
    },
    {
      name: "S13: hover cursors match the action — resize on handles, move inside, grab on endpoints",
      skip: touchOnly && "touch has no hover",
      async run(expect, fail) {
        const [x0, y0, x1, y1] = [500, 250, 700, 400];
        await page.drag({ x: x0, y: y0 }, { x: x1, y: y1 });
        expect({ drawingCursor: await page.hover({ x: 900, y: 600 }) }, { drawingCursor: "crosshair" });
        await page.selectTool("Select");
        await page.click({ x: x0 + 50, y: y0 });

        const expectedByHandle = {
          nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize",
          n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize",
        };
        const { handles } = await page.selection();
        for (const [handle, cursor] of Object.entries(expectedByHandle)) {
          if (!handles[handle]) {
            fail(`handle ${handle} missing`);
            continue;
          }
          const actual = await page.hover(handles[handle]);
          if (actual !== cursor) fail(`${handle}: expected ${cursor}, got ${actual}`);
        }
        expect({ inside: await page.hover({ x: 600, y: 325 }) }, { inside: "move" });
        expect({ empty: await page.hover({ x: 1000, y: 600 }) }, { empty: "default" });

        // The cursor holds for the whole drag, even when the pointer leaves the handle.
        await page.drag(handles.se, { x: handles.se.x + 80, y: handles.se.y + 60 }, { release: false });
        expect({ duringResize: await page.canvasCursor() }, { duringResize: "nwse-resize" });
        await page.pointerUp(handles.se.x + 80, handles.se.y + 60);

        await page.selectTool("Line");
        await page.drag({ x: 300, y: 500 }, { x: 450, y: 600 });
        await page.selectTool("Select");
        await page.click({ x: 375, y: 550 });
        const { endpoints } = await page.selection();
        expect({ start: await page.hover(endpoints.start), end: await page.hover(endpoints.end) }, { start: "grab", end: "grab" });
        expect({ lineBody: await page.hover({ x: 340, y: 527 }) }, { lineBody: "move" });
      },
    },

    // ---- Milestone 4: infinite canvas navigation

    {
      name: "V1: Hand tool pans the view; elements keep their world geometry and new drawings land under the pointer",
      async run(expect, fail) {
        const spots = navSpots(mode);
        await page.drag(...spots.rect);
        const before = (await page.screenBoxes()).elements[0];
        const worldBefore = (await page.elements())[0];

        expect({ hand: await page.selectTool("Hand (pan)") }, { hand: true });
        await page.drag(spots.empty, { x: spots.empty.x + 60, y: spots.empty.y - 40 });
        nearBox(fail, "after pan", (await page.screenBoxes()).elements[0], shiftedBox(before, 60, -40));
        nearDeep(fail, "world geometry", (await page.elements())[0], worldBefore);
        expect(await page.shapes(), { committed: 1, preview: 0 });
        const { viewBox } = await page.view();
        near(fail, "viewBox x", viewBox.x, -60);
        near(fail, "viewBox y", viewBox.y, 40);

        await page.selectTool("Rectangle");
        await page.drag(...spots.rect2);
        nearBox(fail, "drawn after pan", (await page.screenBoxes()).elements[1], boxOf(...spots.rect2));
      },
    },
    {
      name: "V2: middle-mouse drag pans with any tool and never draws",
      skip: touchOnly && "mouse only",
      async run(expect, fail) {
        const spots = navSpots(mode);
        await page.drag(...spots.rect);
        const before = (await page.screenBoxes()).elements[0];
        await page.mouseClickDrag(spots.empty, { x: spots.empty.x - 80, y: spots.empty.y + 30 }, "middle");
        nearBox(fail, "after middle-drag", (await page.screenBoxes()).elements[0], shiftedBox(before, -80, 30));
        expect(await page.shapes(), { committed: 1, preview: 0 });
      },
    },
    {
      name: "V3: wheel zooms towards the pointer; Ctrl+wheel zooms; trackpad scroll pans; the page never scrolls",
      skip: touchOnly && "needs a wheel",
      async run(expect, fail) {
        const spots = navSpots(mode);
        await page.drag(...spots.rect);
        const anchor = { x: 700, y: 420 };

        let before = (await page.screenBoxes()).elements[0];
        let v0 = await page.view();
        await page.wheel(anchor, { deltaY: -100 });
        let v1 = await page.view();
        const k = v0.viewBox.width / v1.viewBox.width;
        if (!(k > 1.05)) fail(`wheel up should zoom in, ratio ${k}`);
        if (!(v1.percent > 100)) fail(`zoom % ${v1.percent}`);
        nearBox(fail, "zoomed around the pointer", (await page.screenBoxes()).elements[0], scaledBox(before, anchor, k));

        before = (await page.screenBoxes()).elements[0];
        await page.wheel(anchor, { deltaY: 100 });
        v0 = v1;
        v1 = await page.view();
        const kOut = v0.viewBox.width / v1.viewBox.width;
        if (!(kOut < 0.95)) fail(`wheel down should zoom out, ratio ${kOut}`);
        nearBox(fail, "zoomed out around the pointer", (await page.screenBoxes()).elements[0], scaledBox(before, anchor, kOut));

        v0 = await page.view();
        await page.wheel(anchor, { deltaY: -10, ctrl: true });
        if (!((await page.view()).viewBox.width < v0.viewBox.width)) fail("Ctrl+wheel (trackpad pinch) should zoom in");

        before = (await page.screenBoxes()).elements[0];
        v0 = await page.view();
        await page.wheel(anchor, { deltaX: 5.5, deltaY: 12.5 });
        near(fail, "trackpad scroll keeps zoom", (await page.view()).viewBox.width, v0.viewBox.width, 0.001);
        nearBox(fail, "trackpad scroll pans", (await page.screenBoxes()).elements[0], shiftedBox(before, -5.5, -12.5));

        expect({ pageScroll: await page.evaluate("window.scrollX + window.scrollY") }, { pageScroll: 0 });
        expect(await page.shapes(), { committed: 1, preview: 0 });
      },
    },
    {
      name: "V4: zoom buttons, percentage, reset, and fit content (with and without content)",
      async run(expect, fail) {
        const percent = async () => (await page.view()).percent;
        expect({ start: await percent() }, { start: 100 });
        await page.press("Zoom in");
        expect({ in1: await percent() }, { in1: 120 });
        await page.press("Zoom in");
        expect({ in2: await percent() }, { in2: 144 });
        await page.press("Zoom out");
        expect({ out: await percent() }, { out: 120 });
        await page.press("Reset zoom");
        expect({ reset: await percent() }, { reset: 100 });

        // Content panned off-screen comes back with Fit content.
        const spots = navSpots(mode);
        await page.selectTool("Rectangle");
        await page.drag(...spots.rect);
        await page.selectTool("Hand (pan)");
        await page.drag(...spots.panAway);
        const away = (await page.screenBoxes()).elements[0];
        if (!(away.x + away.w < 0 || away.y + away.h < 0)) fail(`content should be off-screen before fit: ${JSON.stringify(away)}`);

        await page.press("Fit content");
        const { size, percent: fitPercent } = await page.view();
        const fitted = (await page.screenBoxes()).elements[0];
        if (fitPercent > 100) fail(`fit should not enlarge small content (${fitPercent}%)`);
        near(fail, "fit centres content x", fitted.x + fitted.w / 2, size.width / 2);
        near(fail, "fit centres content y", fitted.y + fitted.h / 2, size.height / 2);

        // Empty board: fit returns to the default view.
        await page.open();
        await page.selectTool("Hand (pan)");
        await page.drag(...spots.panAway);
        await page.press("Fit content");
        const empty = await page.view();
        expect({ x: empty.viewBox.x, y: empty.viewBox.y, percent: empty.percent }, { x: 0, y: 0, percent: 100 });
      },
    },
    {
      name: "V5: at 207% zoom, drawing, selecting, moving, resizing and endpoint editing all track the pointer",
      async run(expect, fail) {
        for (let i = 0; i < 4; i++) await page.press("Zoom in");
        const { percent, size, viewBox } = await page.view();
        expect({ percent }, { percent: 207 });
        const zoom = size.width / viewBox.width;
        const spots = navSpots(mode);

        await page.selectTool("Rectangle");
        await page.drag(...spots.rect);
        let box = (await page.screenBoxes()).elements[0];
        nearBox(fail, "drawn", box, boxOf(...spots.rect));
        near(fail, "stored in world units", (await page.elements())[0].width, (spots.rect[1].x - spots.rect[0].x) / zoom, 0.6);

        await page.selectTool("Select");
        const grab = { x: spots.rect[0].x + (spots.rect[1].x - spots.rect[0].x) / 4, y: spots.rect[0].y };
        await page.click(grab);
        expect({ selected: (await page.selection()).ids.length }, { selected: 1 });
        for (const handle of (await page.screenBoxes()).handles) {
          if (handle.w < 8 || handle.w > 10) fail(`handle should stay ~9px on screen at any zoom, got ${handle.w}`);
        }

        await page.drag(grab, { x: grab.x + 40, y: grab.y + 30 });
        const moved = (await page.screenBoxes()).elements[0];
        nearBox(fail, "moved", moved, shiftedBox(box, 40, 30));

        const se = (await page.selection()).handles.se;
        await page.drag(se, { x: se.x + 40, y: se.y + 20 });
        box = (await page.screenBoxes()).elements[0];
        nearBox(fail, "resized", box, { ...moved, w: moved.w + 40, h: moved.h + 20 });

        await page.selectTool("Line");
        await page.drag(...spots.line);
        await page.selectTool("Select");
        await page.click(midpoint(...spots.line));
        const { endpoints } = await page.selection();
        if (!endpoints.end) return fail("no endpoint handles at this zoom");
        await page.drag(endpoints.end, { x: endpoints.end.x + 30, y: endpoints.end.y - 20 });
        const after = (await page.selection()).endpoints;
        nearDeep(fail, "start unchanged", after.start, endpoints.start);
        nearDeep(fail, "end follows the pointer", after.end, { x: endpoints.end.x + 30, y: endpoints.end.y - 20 });
      },
    },
    {
      name: "V6: pinch zooms around the fingers' midpoint; two-finger drag pans; neither draws",
      skip: !touchOnly && "multi-touch only",
      async run(expect, fail) {
        const spots = navSpots(mode);
        await page.drag(...spots.rect); // rectangle tool stays active during the pinch
        let before = (await page.screenBoxes()).elements[0];
        const v0 = await page.view();

        const mid = { x: 200, y: 540 };
        await pinch(page, [{ x: 150, y: 540 }, { x: 250, y: 540 }], [{ x: 100, y: 540 }, { x: 300, y: 540 }]);
        const k = v0.viewBox.width / (await page.view()).viewBox.width;
        near(fail, "pinch ratio", k, 2, 0.02);
        nearBox(fail, "zoomed around the midpoint", (await page.screenBoxes()).elements[0], scaledBox(before, mid, k));
        expect(await page.shapes(), { committed: 1, preview: 0 });

        before = (await page.screenBoxes()).elements[0];
        const v1 = await page.view();
        await pinch(page, [{ x: 100, y: 540 }, { x: 300, y: 540 }], [{ x: 140, y: 570 }, { x: 340, y: 570 }]);
        near(fail, "two-finger pan keeps zoom", (await page.view()).viewBox.width, v1.viewBox.width, 0.01);
        nearBox(fail, "two-finger pan", (await page.screenBoxes()).elements[0], shiftedBox(before, 40, 30));
        expect(await page.shapes(), { committed: 1, preview: 0 });
      },
    },
    {
      name: "V7: a pinch never selects, moves or draws — even if the first finger landed on a shape",
      skip: !touchOnly && "multi-touch only",
      async run(expect, fail) {
        const spots = navSpots(mode);
        await page.drag(...spots.rect);
        const world = (await page.elements())[0];

        await page.selectTool("Select");
        const onStroke = { x: spots.rect[0].x + 30, y: spots.rect[0].y };
        await pinch(page, [onStroke, { x: onStroke.x + 120, y: onStroke.y + 200 }], [{ x: onStroke.x - 20, y: onStroke.y - 20 }, { x: onStroke.x + 150, y: onStroke.y + 240 }]);
        expect({ selected: (await page.selection()).ids.length }, { selected: 0 });
        nearDeep(fail, "shape not moved", (await page.elements())[0], world);

        await page.selectTool("Ellipse");
        await pinch(page, [{ x: 120, y: 520 }, { x: 260, y: 560 }], [{ x: 90, y: 500 }, { x: 300, y: 600 }]);
        expect(await page.shapes(), { committed: 1, preview: 0 });
      },
    },
    {
      name: "V8: cancelled or half-lifted pinches clean up; the next one-finger drawing works",
      skip: !touchOnly && "multi-touch only",
      async run(expect, fail) {
        const A = (x, y) => ({ id: 0, x, y });
        const B = (x, y) => ({ id: 1, x, y });

        // Cancelled mid-pinch.
        await page.touchEvent("touchStart", [A(150, 540)]);
        await page.touchEvent("touchStart", [A(150, 540), B(250, 540)]);
        await sleep(16);
        await page.touchEvent("touchMove", [A(130, 540), B(270, 540)]);
        await page.touchEvent("touchCancel", []);
        await sleep(100);

        // One finger lifts; the other keeps moving — it must not start drawing.
        await page.touchEvent("touchStart", [A(150, 540)]);
        await page.touchEvent("touchStart", [A(150, 540), B(250, 540)]);
        await sleep(16);
        await page.touchEvent("touchEnd", [B(250, 540)]);
        for (let i = 1; i <= 4; i++) {
          await sleep(16);
          await page.touchEvent("touchMove", [A(150 + i * 20, 540 - i * 15)]);
        }
        await page.touchEvent("touchEnd", [A(230, 480)]);
        await sleep(120);
        expect(await page.shapes(), { committed: 0, preview: 0 });

        const spots = navSpots(mode);
        await page.drag(...spots.rect);
        expect(await page.shapes(), { committed: 1, preview: 0 });
        nearBox(fail, "next drawing", (await page.screenBoxes()).elements[0], boxOf(...spots.rect));
      },
    },
    {
      name: "V9: a touch whose pointerup was never delivered cannot turn later drawings into pinches",
      skip: !touchOnly && "touch only",
      async run(expect, fail) {
        // A secondary touch goes down and its pointerup / pointercancel never arrives.
        await page.evaluate(`document.querySelector('${CANVAS}').dispatchEvent(new PointerEvent('pointerdown', {
          bubbles: true, pointerId: 99, pointerType: 'touch', isPrimary: false, clientX: 300, clientY: 600, button: 0, buttons: 1,
        }))`);
        const spots = navSpots(mode);
        await page.drag(...spots.rect); // a normal one-finger drawing (primary touch)
        expect(await page.shapes(), { committed: 1, preview: 0 });
        nearBox(fail, "drawn", (await page.screenBoxes()).elements[0], boxOf(...spots.rect));
      },
    },

    // ---- Milestone 5: undo / redo

    {
      name: "U1: each of the six element types is undone and redone exactly (ids, order, geometry)",
      async run(expect, fail) {
        await drawAll(page, mode);
        const full = await page.elements();
        expect(await page.history(), { undo: 6, redo: 0 });

        for (let remaining = 5; remaining >= 0; remaining--) {
          await undo(page, mode);
          nearDeep(fail, `after undo → ${remaining} left`, await page.elements(), full.slice(0, remaining));
        }
        expect(await page.history(), { undo: 0, redo: 6, undoEnabled: false, redoEnabled: true });

        for (let count = 1; count <= 6; count++) await redo(page, mode);
        nearDeep(fail, "all redone", await page.elements(), full);
        expect({ ids: (await page.elements()).map((el) => el.id).join() }, { ids: full.map((el) => el.id).join() });
        expect(await page.history(), { undo: 6, redo: 0, undoEnabled: true, redoEnabled: false });
      },
    },
    {
      name: "U2: single and multiple deletion (keyboard and Delete button) undo / redo in original order",
      async run(expect, fail) {
        const items = await drawAll(page, mode);
        const full = await page.elements();

        await page.click(items[1].hit);
        await page.key("Delete");
        expect({ count: (await page.elements()).length }, { count: 5 });
        await undo(page, mode);
        nearDeep(fail, "single delete undone", await page.elements(), full);
        await redo(page, mode);
        expect({ redone: (await page.elements()).some((el) => el.id === items[1].id) }, { redone: false });
        await undo(page, mode);

        // Multiple, via a marquee and the contextual Delete button.
        const [c4, c5] = [items[4], items[5]];
        await page.drag(
          { x: Math.min(c4.box[0], c5.box[0]) - 30, y: Math.min(c4.box[1], c5.box[1]) - 30 },
          { x: Math.max(c4.box[2], c5.box[2]) + 30, y: Math.max(c4.box[3], c5.box[3]) + 30 },
        );
        expect({ selected: (await page.selection()).ids.length }, { selected: 2 });
        await page.evaluate(`[...document.querySelectorAll('button[aria-label^="Delete"]')].find((b) => b.offsetParent).click()`);
        await sleep(100);
        expect({ count: (await page.elements()).length }, { count: 4 });
        const before = await page.history();
        await undo(page, mode);
        nearDeep(fail, "multi delete undone with original ordering", await page.elements(), full);
        await redo(page, mode);
        expect({ count: (await page.elements()).length, undo: (await page.history()).undo }, { count: 4, undo: before.undo });
      },
    },
    {
      name: "U3: one move = one entry (single and multiple); undo / redo restore exact geometry",
      async run(expect, fail) {
        const items = await drawAll(page, mode);
        const original = await page.elements();
        const start = (await page.history()).undo;

        // A single move through many pointer events.
        const from = items[0].hit;
        await page.pointerDown(from.x, from.y);
        for (let i = 1; i <= 30; i++) {
          await sleep(8);
          await page.pointerMove(from.x + i, from.y + i / 2);
        }
        await page.pointerUp(from.x + 30, from.y + 15);
        expect({ entries: (await page.history()).undo - start }, { entries: 1 });
        const movedOne = await page.elements();

        // Multiple: marquee the first two cells, then move them together.
        const [a1, a2] = items;
        await page.drag(
          { x: Math.min(a1.box[0], a2.box[0]) - 30, y: Math.min(a1.box[1], a2.box[1]) - 30 },
          { x: Math.max(a1.box[2], a2.box[2]) + 50, y: Math.max(a1.box[3], a2.box[3]) + 50 },
        );
        const grab = { x: a2.hit.x, y: a2.hit.y };
        await page.drag(grab, { x: grab.x + 20, y: grab.y + 25 });
        expect({ entries: (await page.history()).undo - start }, { entries: 2 });
        const movedBoth = await page.elements();

        await undo(page, mode);
        nearDeep(fail, "multi-move undone", await page.elements(), movedOne);
        await undo(page, mode);
        nearDeep(fail, "single move undone", await page.elements(), original);
        await redo(page, mode);
        await redo(page, mode);
        nearDeep(fail, "both redone", await page.elements(), movedBoth);
      },
    },
    {
      name: "U4: resizing every shape and editing line / arrow endpoints — one entry each, exact undo / redo",
      async run(expect, fail) {
        const items = await drawAll(page, mode);
        for (const item of items) {
          await page.click(item.hit);
          const before = await page.elements();
          const depth = (await page.history()).undo;
          const { handles, endpoints } = await page.selection();
          const grip = item.type === "line" || item.type === "arrow" ? endpoints.end : handles.se;
          if (!grip) {
            fail(`${item.type}: no handle`);
            continue;
          }
          await page.drag(grip, { x: grip.x + 20, y: grip.y + 15 });
          const after = await page.elements();
          expect({ [`${item.type} entries`]: (await page.history()).undo - depth }, { [`${item.type} entries`]: 1 });
          if (JSON.stringify(after) === JSON.stringify(before)) fail(`${item.type}: resize changed nothing`);

          await undo(page, mode);
          nearDeep(fail, `${item.type} undone`, await page.elements(), before);
          await redo(page, mode);
          nearDeep(fail, `${item.type} redone`, await page.elements(), after);
        }
      },
    },
    {
      name: "U5: cancelled and no-op gestures create no history entries",
      async run(expect, fail) {
        const [x0, y0, x1, y1] = mode === "desktop" ? [500, 250, 700, 400] : [100, 200, 260, 330];
        await page.drag({ x: x0, y: y0 }, { x: x1, y: y1 });
        const base = await page.history();
        const original = await page.elements();

        const cancel = async (at) => {
          if (touchOnly) {
            await page.touchEvent("touchCancel", []);
            await sleep(100);
          } else {
            await page.dropPointerCapture();
            await page.pointerMove(at.x + 10, at.y + 10);
            await page.pointerUp(at.x + 10, at.y + 10);
          }
        };

        // Cancelled drawing.
        await page.drag({ x: x0, y: y1 + 40 }, { x: x1, y: y1 + 120 }, { release: false });
        await cancel({ x: x1, y: y1 + 120 });
        expect({ afterCancelledDraw: (await page.elements()).length }, { afterCancelledDraw: 1 });

        // A tap and a 1px drag with a drawing tool.
        await page.drag({ x: x0, y: y1 + 60 }, { x: x0 + 1, y: y1 + 61 });

        await page.selectTool("Select");
        const hit = { x: x0 + (x1 - x0) / 4, y: y0 };

        // Click without moving.
        await page.click(hit);
        // Drag away and back to exactly the same spot.
        await page.pointerDown(hit.x, hit.y);
        await page.pointerMove(hit.x + 40, hit.y + 30);
        await page.pointerMove(hit.x, hit.y);
        await page.pointerUp(hit.x, hit.y);

        // Cancelled move.
        await page.drag(hit, { x: hit.x + 50, y: hit.y + 50 }, { release: false });
        await cancel({ x: hit.x + 50, y: hit.y + 50 });

        // Cancelled resize.
        const se = (await page.selection()).handles.se;
        if (se) {
          await page.drag(se, { x: se.x + 40, y: se.y + 40 }, { release: false });
          await cancel({ x: se.x + 40, y: se.y + 40 });
        } else fail("no se handle");

        expect(await page.history(), { undo: base.undo, redo: 0 });
        nearDeep(fail, "document unchanged", await page.elements(), original);
      },
    },
    {
      name: "U6: a new edit after undo clears redo",
      async run(expect) {
        const spots = navSpots(mode);
        await page.drag(...spots.rect);
        await page.drag(...spots.rect2);
        await undo(page, mode);
        expect(await page.history(), { undo: 1, redo: 1, redoEnabled: true });
        await page.drag(...spots.line);
        expect(await page.history(), { undo: 2, redo: 0, redoEnabled: false });
        await redo(page, mode);
        expect({ count: (await page.elements()).length }, { count: 2 });
      },
    },
    {
      name: "U7: panning, zooming, tool switches and selection changes never touch history",
      async run(expect) {
        const spots = navSpots(mode);
        await page.drag(...spots.rect);
        const base = await page.history();

        await page.selectTool("Hand (pan)");
        await page.drag(spots.empty, { x: spots.empty.x - 40, y: spots.empty.y - 30 });
        await page.press("Zoom in");
        await page.press("Zoom out");
        await page.press("Fit content");
        if (!touchOnly) await page.wheel({ x: 600, y: 400 }, { deltaY: -100 });
        await page.selectTool("Ellipse");
        await page.selectTool("Select");
        const box = (await page.screenBoxes()).elements[0];
        await page.click({ x: box.x + box.w / 4, y: box.y }); // select
        await page.click({ x: 5, y: box.y + box.h + 200 }); // deselect

        expect(await page.history(), { undo: base.undo, redo: base.redo });
      },
    },
    {
      name: "U8: Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y and ⌘ variants; ignored while typing in a field",
      skip: touchOnly && "keyboard",
      async run(expect) {
        const spots = navSpots(mode);
        await page.drag(...spots.rect);
        await page.drag(...spots.rect2);

        await page.modKey("z");
        expect({ afterCtrlZ: (await page.elements()).length }, { afterCtrlZ: 1 });
        await page.modKey("z", { shift: true });
        expect({ afterCtrlShiftZ: (await page.elements()).length }, { afterCtrlShiftZ: 2 });
        await page.modKey("z", { meta: true });
        expect({ afterCmdZ: (await page.elements()).length }, { afterCmdZ: 1 });
        await page.modKey("y");
        expect({ afterCtrlY: (await page.elements()).length }, { afterCtrlY: 2 });
        await page.modKey("z", { meta: true, shift: true });
        expect({ afterCmdShiftZ: (await page.elements()).length }, { afterCmdShiftZ: 2 }); // nothing to redo

        await page.evaluate(`(() => { const i = document.createElement('input'); i.id = 'test-input'; document.body.append(i); i.focus(); })()`);
        await page.modKey("z");
        expect({ whileTyping: (await page.elements()).length }, { whileTyping: 2 });
        await page.evaluate(`document.getElementById('test-input').remove()`);
        await page.modKey("z");
        expect({ afterBlur: (await page.elements()).length }, { afterBlur: 1 });
      },
    },
    {
      name: "U9: Undo / Redo buttons enable, disable and act like the shortcuts",
      async run(expect) {
        expect(await page.history(), { undo: 0, redo: 0, undoEnabled: false, redoEnabled: false });
        const spots = navSpots(mode);
        await page.drag(...spots.rect);
        expect(await page.history(), { undo: 1, redo: 0, undoEnabled: true, redoEnabled: false });
        await page.press("Undo");
        expect({ count: (await page.elements()).length }, { count: 0 });
        expect(await page.history(), { undo: 0, redo: 1, undoEnabled: false, redoEnabled: true });
        await page.press("Redo");
        expect({ count: (await page.elements()).length }, { count: 1 });
        expect(await page.history(), { undo: 1, redo: 0, undoEnabled: true, redoEnabled: false });
      },
    },
    {
      name: "U10: undo during a drag cancels the drag instead of overwriting the undo",
      skip: touchOnly && "keyboard",
      async run(expect, fail) {
        const spots = navSpots(mode);
        await page.drag(...spots.rect);
        const [created] = await page.elements();
        await page.selectTool("Select");

        // Move it once (history: create, move).
        const hit = { x: spots.rect[0].x + 30, y: spots.rect[0].y };
        await page.drag(hit, { x: hit.x + 40, y: hit.y });
        expect(await page.history(), { undo: 2, redo: 0 });

        // Start dragging it again, and undo the first move mid-drag.
        const moved = { x: hit.x + 40, y: hit.y };
        await page.drag(moved, { x: moved.x + 60, y: moved.y + 40 }, { release: false });
        await page.modKey("z");
        await page.pointerMove(moved.x + 80, moved.y + 60);
        await page.pointerUp(moved.x + 80, moved.y + 60);

        // The undo stands: the stale drag must not be applied on release.
        nearDeep(fail, "back at its created position", await page.elements(), [created]);
        expect(await page.history(), { undo: 1, redo: 1 });
      },
    },

    // ---- Milestone 6: boards (in-memory state)

    {
      name: "P1: first launch opens an empty 'Untitled board'",
      async run(expect) {
        const boards = await page.boardList();
        expect({ count: boards.length, name: boards[0]?.name, active: boards[0]?.active }, { count: 1, name: "Untitled board", active: true });
        expect({ elements: (await page.elements()).length }, { elements: 0 });
      },
    },
    {
      name: "P2: renaming a board; empty and duplicate names are refused",
      async run(expect, fail) {
        const [board] = await page.boardList();
        await page.press(`Rename ${board.name}`);
        await page.type("   ");
        await page.pressText("Rename");
        const emptyError = await page.evaluate(`document.querySelector('dialog [role="alert"]')?.textContent ?? ""`);
        if (!/Enter a board name/.test(emptyError)) fail(`empty name error: "${emptyError}"`);

        await page.type("Product roadmap");
        await page.pressText("Rename");
        await sleep(200);
        expect({ dialogClosed: await page.evaluate(`!document.querySelector('dialog[open]')`) }, { dialogClosed: true });

        await page.createBoard("Second");
        const second = (await page.boardList()).find((b) => b.name === "Second");
        await page.press(`Rename ${second.name}`);
        await page.type("product ROADMAP");
        await page.pressText("Rename");
        const dupError = await page.evaluate(`document.querySelector('dialog [role="alert"]')?.textContent ?? ""`);
        if (!/already exists/.test(dupError)) fail(`duplicate error: "${dupError}"`);
        await page.pressText("Cancel");

        const names = (await page.boardList()).map((b) => b.name).sort().join();
        expect({ names }, { names: "Product roadmap,Second" });
        expect({ header: await page.evaluate(`document.querySelector('[data-active-board-name]').textContent`) }, { header: "Second" });
      },
    },
    {
      name: "P3: boards are isolated — each keeps its own elements, and selection doesn't leak",
      async run(expect, fail) {
        const spots = navSpots(mode);
        await page.drag(...spots.rect);
        await page.selectTool("Select");
        await page.click({ x: spots.rect[0].x + 20, y: spots.rect[0].y });
        expect({ selected: (await page.selection()).ids.length }, { selected: 1 });
        const onFirst = await page.elements();

        await page.createBoard("Board B");
        expect({ emptyB: (await page.elements()).length, selected: (await page.selection()).ids.length }, { emptyB: 0, selected: 0 });
        expect(await page.history(), { undo: 0, redo: 0 });
        await page.closeMenu();
        await page.selectTool("Ellipse");
        await page.drag(...spots.rect2);
        const onSecond = await page.elements();

        const boards = await page.boardList();
        await page.click(await rowCenter(page, boards.find((b) => b.name === "Untitled board").id));
        await sleep(300);
        nearDeep(fail, "first board", await page.elements(), onFirst);
        expect({ selected: (await page.selection()).ids.length, undo: (await page.history()).undo }, { selected: 0, undo: 0 });

        await page.click(await rowCenter(page, boards.find((b) => b.name === "Board B").id));
        await sleep(300);
        nearDeep(fail, "second board", await page.elements(), onSecond);
      },
    },
    {
      name: "P4: each board restores its own viewport",
      async run(expect) {
        await page.press("Zoom in");
        await page.press("Zoom in");
        expect({ a: (await page.view()).percent }, { a: 144 });
        await page.createBoard("Board B");
        expect({ b: (await page.view()).percent }, { b: 100 });
        await page.closeMenu();
        await page.press("Zoom out");
        expect({ b: (await page.view()).percent }, { b: 83 });

        const boards = await page.boardList();
        await page.click(await rowCenter(page, boards.find((b) => b.name === "Untitled board").id));
        await sleep(300);
        expect({ backOnA: (await page.view()).percent }, { backOnA: 144 });

        await page.click(await rowCenter(page, boards.find((b) => b.name === "Board B").id));
        await sleep(300);
        expect({ backOnB: (await page.view()).percent }, { backOnB: 83 });
      },
    },
    {
      name: "P5: deleting a board, the active board, and the last board (with confirmation)",
      async run(expect, fail) {
        const spots = navSpots(mode);
        await page.drag(...spots.rect);
        await page.createBoard("Keep me");
        await page.createBoard("Delete me");

        // Cancel keeps it. (Creating a board closes the menu, so reopen it.)
        await page.openMenu();
        await page.press("Delete Keep me");
        await page.pressText("Cancel");
        expect({ count: (await page.boardList()).length }, { count: 3 });

        // Inactive board.
        await page.openMenu();
        await page.press("Delete Keep me");
        await page.pressText("Delete board");
        await sleep(200);
        let boards = await page.boardList();
        expect({ names: boards.map((b) => b.name).sort().join(), active: boards.find((b) => b.active)?.name }, { names: "Delete me,Untitled board", active: "Delete me" });

        // Active board → moves to the remaining one, with its content.
        await page.openMenu();
        await page.press("Delete Delete me");
        await page.pressText("Delete board");
        await sleep(300);
        boards = await page.boardList();
        expect({ names: boards.map((b) => b.name).join(), active: boards[0]?.active }, { names: "Untitled board", active: true });
        expect({ elementsBack: (await page.elements()).length }, { elementsBack: 1 });

        // Last board → a new empty default board replaces it.
        await page.openMenu();
        await page.press("Delete Untitled board");
        await page.pressText("Delete board");
        await sleep(300);
        boards = await page.boardList();
        expect({ count: boards.length, empty: (await page.elements()).length }, { count: 1, empty: 0 });
        if (boards[0]?.name !== "Untitled board") fail(`new board name ${boards[0]?.name}`);
      },
    },
    {
      name: "P7: switching boards immediately after an edit loses nothing",
      async run(expect, fail) {
        await page.createBoard("Board B");
        const firstId = (await page.boardList()).find((b) => b.name === "Untitled board").id;
        await page.closeMenu();
        const spots = navSpots(mode);
        await page.drag(...spots.rect);
        const drawn = await page.elements();
        await page.evaluate(`(async () => {
          document.querySelector('[aria-label="Open board menu"]').click();
          await new Promise((r) => setTimeout(r, 0));
          document.querySelector('[data-board-id="${firstId}"] button').click();
        })()`);
        await sleep(300);
        expect({ otherBoard: (await page.elements()).length }, { otherBoard: 0 });

        const after = await page.boardList();
        await page.click(await rowCenter(page, after.find((b) => b.name === "Board B").id));
        await sleep(300);
        nearDeep(fail, "edit survived the switch", await page.elements(), drawn);
      },
    },
    {
      name: "P10: switching boards mid-drag cancels the drag; nothing moves on either board",
      skip: touchOnly && "needs the mouse held while switching",
      async run(expect, fail) {
        const spots = navSpots(mode);
        await page.drag(...spots.rect);
        await page.createBoard("Board B");
        await page.drag(...spots.rect);
        const onB = await page.elements();
        await page.selectTool("Select");
        const boards = await page.boardList();
        const firstId = boards.find((b) => b.name === "Untitled board").id;
        await page.closeMenu();

        const hit = { x: spots.rect[0].x + 20, y: spots.rect[0].y };
        await page.drag(hit, { x: hit.x + 60, y: hit.y + 40 }, { release: false });
        await page.evaluate(`window.__boardRow = ${JSON.stringify(firstId)}`);
        await page.evaluate(`(async () => {
          document.querySelector('[aria-label="Open board menu"]').click();
          await new Promise((r) => setTimeout(r, 50));
          document.querySelector('[data-board-id="' + window.__boardRow + '"] button').click();
        })()`);
        await sleep(400);
        await page.pointerMove(hit.x + 80, hit.y + 60);
        await page.pointerUp(hit.x + 80, hit.y + 60);
        const onA = await page.elements();
        expect({ onA: onA.length, undo: (await page.history()).undo }, { onA: 1, undo: 0 });

        const back = await page.boardList();
        await page.click(await rowCenter(page, back.find((b) => b.name === "Board B").id));
        await sleep(300);
        nearDeep(fail, "board B unmoved", await page.elements(), onB);
      },
    },
  ];
}

/** Centre of a board row's main button in the (open) board menu. */
async function rowCenter(page, boardId) {
  await page.openMenu();
  await sleep(150);
  return page.evaluate(`(() => {
    const button = document.querySelector('[data-board-id="${boardId}"] button');
    const r = button.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
}

/** Undo by keyboard on desktop, by the toolbar button on touch. */
async function undo(page, mode) {
  if (mode === "desktop") await page.modKey("z");
  else await page.press("Undo");
}

async function redo(page, mode) {
  if (mode === "desktop") await page.modKey("z", { shift: true });
  else await page.press("Redo");
}

// --------------------------------------------------- navigation test helpers

/** Fixed spots for the navigation tests, clear of the floating UI. */
function navSpots(mode) {
  return mode === "desktop"
    ? {
        rect: [{ x: 500, y: 300 }, { x: 650, y: 400 }],
        rect2: [{ x: 300, y: 500 }, { x: 420, y: 600 }],
        line: [{ x: 420, y: 480 }, { x: 640, y: 600 }],
        empty: { x: 900, y: 550 },
        panAway: [{ x: 900, y: 550 }, { x: 100, y: 120 }],
      }
    : {
        rect: [{ x: 100, y: 200 }, { x: 220, y: 300 }],
        rect2: [{ x: 60, y: 380 }, { x: 180, y: 460 }],
        line: [{ x: 80, y: 340 }, { x: 260, y: 440 }],
        empty: { x: 250, y: 450 },
        panAway: [{ x: 300, y: 560 }, { x: 40, y: 130 }],
      };
}

const boxOf = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) });
const shiftedBox = (box, dx, dy) => ({ ...box, x: box.x + dx, y: box.y + dy });
/** A box scaled by `k` around screen point `m` (what zooming about m does to it). */
const scaledBox = (box, m, k) => ({ x: m.x + (box.x - m.x) * k, y: m.y + (box.y - m.y) * k, w: box.w * k, h: box.h * k });
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function nearBox(fail, label, actual, expected, tolerance = 1.5) {
  if (!actual) return fail(`${label}: element missing`);
  for (const key of ["x", "y", "w", "h"]) near(fail, `${label} ${key}`, actual[key], expected[key], tolerance);
}

/** Two fingers land (almost) together and move from `from` to `to` in steps, then lift. */
async function pinch(page, from, to) {
  const finger = (id, p) => ({ id, x: p.x, y: p.y });
  await page.touchEvent("touchStart", [finger(0, from[0])]);
  await sleep(16);
  await page.touchEvent("touchStart", [finger(0, from[0]), finger(1, from[1])]);
  const steps = 6;
  for (let s = 1; s <= steps; s++) {
    await sleep(16);
    const at = (i) => ({ x: from[i].x + ((to[i].x - from[i].x) * s) / steps, y: from[i].y + ((to[i].y - from[i].y) * s) / steps });
    await page.touchEvent("touchMove", [finger(0, at(0)), finger(1, at(1))]);
  }
  await sleep(16);
  await page.touchEvent("touchEnd", [finger(1, to[1])]);
  await page.touchEvent("touchEnd", [finger(0, to[0])]);
  await sleep(120);
}

const DRAWING_TOOLS = [
  { type: "rectangle", label: "Rectangle" },
  { type: "ellipse", label: "Ellipse" },
  { type: "diamond", label: "Diamond" },
  { type: "line", label: "Line" },
  { type: "arrow", label: "Arrow" },
  { type: "freehand", label: "Draw" },
];

const DIRECTION_NAMES = ["↘", "↙", "↖", "↗"];

/** Four boxes, each dragged from a different corner (↘ ↙ ↖ ↗). */
function fourDirections(mode) {
  const boxes = mode === "desktop"
    ? [[350, 200, 550, 320], [750, 200, 950, 320], [350, 450, 550, 570], [750, 450, 950, 570]]
    : [[30, 100, 150, 200], [220, 100, 340, 200], [30, 330, 150, 430], [220, 330, 340, 430]];
  const corners = [
    ([x0, y0, x1, y1]) => [{ x: x0, y: y0 }, { x: x1, y: y1 }],
    ([x0, y0, x1, y1]) => [{ x: x1, y: y0 }, { x: x0, y: y1 }],
    ([x0, y0, x1, y1]) => [{ x: x1, y: y1 }, { x: x0, y: y0 }],
    ([x0, y0, x1, y1]) => [{ x: x0, y: y1 }, { x: x1, y: y0 }],
  ];
  return boxes.map((box, index) => corners[index](box));
}

/** Checks an element read from the DOM against the drag that created it (world = CSS px). */
function checkElement(fail, label, el, type, from, to) {
  if (!el) return fail(`${label}: element missing`);
  if (el.type !== type) return fail(`${label}: expected type ${type}, got ${el.type}`);
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  const width = Math.abs(to.x - from.x);
  const height = Math.abs(to.y - from.y);
  const nearPoint = (name, actual, expected) => {
    near(fail, `${label} ${name}.x`, actual.x, expected.x);
    near(fail, `${label} ${name}.y`, actual.y, expected.y);
  };

  switch (type) {
    case "rectangle":
      near(fail, `${label} x`, el.x, x);
      near(fail, `${label} y`, el.y, y);
      near(fail, `${label} width`, el.width, width);
      near(fail, `${label} height`, el.height, height);
      break;
    case "ellipse":
      near(fail, `${label} cx`, el.cx, x + width / 2);
      near(fail, `${label} cy`, el.cy, y + height / 2);
      near(fail, `${label} rx`, el.rx, width / 2);
      near(fail, `${label} ry`, el.ry, height / 2);
      break;
    case "diamond": {
      const expected = [
        { x: x + width / 2, y }, { x: x + width, y: y + height / 2 },
        { x: x + width / 2, y: y + height }, { x, y: y + height / 2 },
      ];
      if (el.vertices.length !== 4) return fail(`${label}: expected 4 vertices`);
      el.vertices.forEach((vertex, index) => nearPoint(["top", "right", "bottom", "left"][index], vertex, expected[index]));
      break;
    }
    case "line":
      nearPoint("start", el.start, from);
      nearPoint("end", el.end, to);
      break;
    case "arrow": {
      nearPoint("start", el.start, from);
      nearPoint("end", el.end, to);
      const [wingA, tip, wingB] = el.head;
      nearPoint("arrowhead tip", tip, to);
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      const dir = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
      const along = (w) => (w.x - tip.x) * dir.x + (w.y - tip.y) * dir.y;
      const side = (w) => (w.x - tip.x) * dir.y - (w.y - tip.y) * dir.x;
      if (!(along(wingA) < 0 && along(wingB) < 0)) fail(`${label}: arrowhead does not point along the drag`);
      if (!(side(wingA) * side(wingB) < 0)) fail(`${label}: arrowhead wings not on opposite sides`);
      break;
    }
    case "freehand":
      near(fail, `${label} bbox x`, el.bbox.x, x);
      near(fail, `${label} bbox y`, el.bbox.y, y);
      near(fail, `${label} bbox width`, el.bbox.width, width);
      near(fail, `${label} bbox height`, el.bbox.height, height);
      if (!(el.pointCount >= 2)) fail(`${label}: expected ≥ 2 points, got ${el.pointCount}`);
      if (el.d.match(/M/g)?.length !== 1) fail(`${label}: path is not continuous`);
      break;
  }
}

async function runSuite(browser, { label, url, mode }) {
  const page = createPage(browser, { url, mode });
  const results = [];
  console.log(`\n▸ ${label}  (${url})`);

  for (const test of defineTests(page, mode)) {
    // ONLY=S2 runs just the tests whose name starts with "S2" (handy while debugging).
    if (process.env.ONLY && !process.env.ONLY.split(",").some((prefix) => test.name.startsWith(prefix))) continue;
    if (test.skip) {
      console.log(`  - skip  ${test.name}  (${test.skip})`);
      continue;
    }
    const failures = [];
    const fail = (message) => failures.push(message);
    const expect = (actual, expected) => {
      for (const [key, value] of Object.entries(expected)) {
        if (actual[key] !== value) fail(`${key}: expected ${value}, got ${actual[key]}`);
      }
    };

    try {
      await page.open();
      if (!(await page.selectTool("Rectangle"))) fail("rectangle tool did not become active");
      await test.run(expect, fail);
      if (browser.exceptions.length) fail(`page threw: ${[...new Set(browser.exceptions)].join("; ")}`);
    } catch (error) {
      fail(String(error));
    }

    const passed = failures.length === 0;
    results.push(passed);
    console.log(`  ${passed ? "✓ pass" : "✗ FAIL"}  ${test.name}`);
    for (const failure of failures) console.log(`           ${failure}`);
  }
  return results;
}

// --------------------------------------------------------------------- main

const server = await createServer({ server: { host: "0.0.0.0", port: 0 }, logLevel: "error" });
await server.listen();
const port = server.httpServer.address().port;
const lan = lanAddress();

const suites = [
  ...(lan ? [{ label: "android-like: touch, insecure LAN origin", url: `http://${lan}:${port}/board`, mode: "touch" }] : []),
  { label: "localhost: touch, secure origin", url: `http://localhost:${port}/board`, mode: "touch" },
  { label: "desktop: mouse", url: `http://localhost:${port}/board`, mode: "desktop" },
];
if (!lan) console.warn("No LAN IPv4 address found — skipping the insecure-origin suite.");

let browser;
let allResults = [];
try {
  browser = await launchBrowser();
  for (const suite of suites) allResults = allResults.concat(await runSuite(browser, suite));
} finally {
  browser?.close();
  await server.close();
}

const failed = allResults.filter((passed) => !passed).length;
console.log(`\n${allResults.length - failed}/${allResults.length} passed`);
process.exit(failed ? 1 : 0);
