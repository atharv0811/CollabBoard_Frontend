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
    (await send("Runtime.evaluate", { expression, returnByValue: true })).result.result.value;

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

  async function open() {
    await resize(initialSize.width, initialSize.height);
    await send("Emulation.setTouchEmulationEnabled", { enabled: touch, maxTouchPoints: touch ? 5 : 1 });
    browser.exceptions.length = 0;
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
        const base = { type, tag: el.tagName };
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

  async function mouseClickDrag(from, to, button) {
    const buttons = button === "right" ? 2 : 1;
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: from.x, y: from.y, button, buttons, clickCount: 1 });
    for (let step = 1; step <= 6; step++) {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: from.x + ((to.x - from.x) * step) / 6, y: from.y + ((to.y - from.y) * step) / 6, button, buttons });
    }
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: to.x, y: to.y, button, buttons: 0, clickCount: 1 });
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

  return {
    open, drag, selectTool, shapes, elements, geometry, resize, touchEvent, toolCenter,
    dropPointerCapture, mouseClickDrag, pointerDown, pointerMove, pointerUp, touch,
  };
}

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
  ];
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
