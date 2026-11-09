/**
 * Persistence tests: model rules, validation / migration, the IndexedDB
 * repository (against fake-indexeddb, a complete in-memory IndexedDB), and
 * the BoardSession controller (startup, autosave, ordering, switching).
 * Run: bun run test:unit
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { createBoardsStore } from "../src/features/boards/boardsStore.ts";
import { createIndexedDbBoardRepository } from "../src/features/boards/indexedDbRepository.ts";
import {
  BOARD_SCHEMA_VERSION,
  checkBoardName,
  emptyDocument,
  nextDefaultName,
  type Board,
  type BoardDocument,
  type BoardMeta,
} from "../src/features/boards/model.ts";
import {
  BoardNotFoundError,
  BoardUnreadableError,
  StorageUnavailableError,
  type BoardRepository,
} from "../src/features/boards/repository.ts";
import { BoardSession } from "../src/features/boards/session.ts";
import {
  IncompatibleVersionError,
  InvalidRecordError,
  migrateDocumentRecord,
  parseBoardDocument,
} from "../src/features/boards/validation.ts";
import { DEFAULT_STYLE, type CanvasElement } from "../src/features/workspace/canvas/elements.ts";
import { DEFAULT_VIEWPORT } from "../src/features/workspace/canvas/viewport.ts";
import { createWorkspaceStore } from "../src/features/workspace/store/workspaceStore.ts";

const style = DEFAULT_STYLE;
const p = (x: number, y: number) => ({ x, y });
const rect = (id: string, x = 0): CanvasElement => ({ id, type: "rectangle", style, x, y: 0, width: 40, height: 30 });
const ALL_TYPES: CanvasElement[] = [
  rect("r"),
  { id: "e", type: "ellipse", style, cx: 50, cy: 50, rx: 20, ry: 10 },
  { id: "d", type: "diamond", style, x: 0, y: 100, width: 40, height: 30 },
  { id: "l", type: "line", style, start: p(0, 0), end: p(10, 20) },
  { id: "a", type: "arrow", style, start: p(5, 5), end: p(50, 5) },
  { id: "f", type: "freehand", style: { strokeWidth: 3, fill: "transparent" }, points: [p(0, 0), p(4, 6), p(9, 2)] },
];

const board = (id: string, name: string, updatedAt: number, document: BoardDocument = emptyDocument()): Board => ({
  id,
  name,
  createdAt: updatedAt,
  updatedAt,
  ...document,
});

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

/** Raw access to the same fake database, to plant corrupt records. */
function rawPut(factory: IDBFactory, store: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = factory.open("collabboard", 1);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    open.onerror = () => reject(open.error);
  });
}

function rawGet(factory: IDBFactory, store: string, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const open = factory.open("collabboard", 1);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction(store).objectStore(store).get(key);
      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    };
    open.onerror = () => reject(open.error);
  });
}

function setup(options: { factory?: IDBFactory; wrap?: (repo: BoardRepository) => BoardRepository; ids?: string[] } = {}) {
  const factory = options.factory ?? new IDBFactory();
  const base = createIndexedDbBoardRepository(factory);
  const repository = options.wrap ? options.wrap(base) : base;
  const workspace = createWorkspaceStore();
  const boards = createBoardsStore();
  let clock = 1000;
  let counter = 0;
  const session = new BoardSession({
    repository,
    workspace,
    boards,
    saveDelayMs: 5,
    now: () => ++clock,
    createId: () => options.ids?.[counter++] ?? `board-${++counter}`,
  });
  return { factory, base, repository, workspace, boards, session };
}

// --------------------------------------------------------------- model

describe("board names", () => {
  const existing: BoardMeta[] = [{ id: "1", name: "Roadmap", createdAt: 0, updatedAt: 0 }];

  test("trims, collapses spaces, and rejects empty / whitespace-only names", () => {
    assert.deepEqual(checkBoardName("  Sprint   plan ", existing), { ok: true, name: "Sprint plan" });
    assert.equal(checkBoardName("   ", existing).ok, false);
    assert.equal(checkBoardName("", existing).ok, false);
  });

  test("rejects duplicates case-insensitively, except the board being renamed", () => {
    assert.equal(checkBoardName("roadmap", existing).ok, false);
    assert.deepEqual(checkBoardName("ROADMAP", existing, "1"), { ok: true, name: "ROADMAP" });
  });

  test("rejects overly long names", () => {
    assert.equal(checkBoardName("x".repeat(81), existing).ok, false);
  });

  test("default names are numbered to stay unique", () => {
    assert.equal(nextDefaultName([]), "Untitled board");
    const taken = ["Untitled board", "Untitled board 2"].map((name, i) => ({ id: `${i}`, name, createdAt: 0, updatedAt: 0 }));
    assert.equal(nextDefaultName(taken), "Untitled board 3");
  });
});

// --------------------------------------------------------------- validation

describe("validation and migration", () => {
  const record = (patch: Record<string, unknown> = {}) => ({
    id: "b",
    schemaVersion: BOARD_SCHEMA_VERSION,
    elements: ALL_TYPES,
    viewport: { x: 10, y: -5, zoom: 2 },
    ...patch,
  });

  test("a valid document of every element type round-trips unchanged", () => {
    assert.deepEqual(parseBoardDocument(record()), { elements: ALL_TYPES, viewport: { x: 10, y: -5, zoom: 2 } });
  });

  test("malformed documents are rejected with a reason", () => {
    const bad: Record<string, unknown>[] = [
      { elements: "nope" },
      { elements: [{ ...rect("r"), width: Number.NaN }] },
      { elements: [{ ...rect("r"), width: -4 }] },
      { elements: [{ id: "x", type: "triangle", style }] },
      { elements: [{ ...rect("r"), style: undefined }] },
      { elements: [rect("same"), rect("same")] },
      { elements: [{ id: "f", type: "freehand", style, points: [] }] },
      { viewport: { x: 0, y: 0, zoom: 0 } },
      { viewport: null },
      { schemaVersion: "1" },
    ];
    for (const patch of bad) assert.throws(() => parseBoardDocument(record(patch)), InvalidRecordError, JSON.stringify(patch));
  });

  test("a newer schema version is reported as incompatible, not discarded", () => {
    assert.throws(() => parseBoardDocument(record({ schemaVersion: BOARD_SCHEMA_VERSION + 1 })), IncompatibleVersionError);
  });

  test("migrations run in order up to the current version", () => {
    const migrations = {
      1: (r: Record<string, unknown>) => ({ ...r, renamed: r.old }),
      2: (r: Record<string, unknown>) => ({ ...r, doubled: (r.renamed as number) * 2 }),
    };
    const result = migrateDocumentRecord({ schemaVersion: 1, old: 21 }, migrations, 3);
    assert.deepEqual(result, { schemaVersion: 3, old: 21, renamed: 21, doubled: 42 });
    assert.throws(() => migrateDocumentRecord({ schemaVersion: 1 }, {}, 2), InvalidRecordError, "missing migration step");
  });

  test("out-of-range zoom is clamped on load", () => {
    assert.equal(parseBoardDocument(record({ viewport: { x: 0, y: 0, zoom: 500 } })).viewport.zoom, 8);
  });
});

// --------------------------------------------------------------- repository

describe("IndexedDB repository", () => {
  test("create, list, load, save, rename and delete", async () => {
    const repo = createIndexedDbBoardRepository(new IDBFactory());
    await repo.createBoard(board("a", "Alpha", 1));
    await repo.createBoard(board("b", "Beta", 2, { elements: [rect("x")], viewport: { x: 5, y: 6, zoom: 1.5 } }));

    const list = await repo.listBoards();
    assert.deepEqual(list.boards.map((b) => b.id).sort(), ["a", "b"]);
    assert.deepEqual(await repo.loadDocument("b"), { elements: [rect("x")], viewport: { x: 5, y: 6, zoom: 1.5 } });

    await repo.saveDocument("a", { elements: ALL_TYPES, viewport: DEFAULT_VIEWPORT }, 10);
    assert.deepEqual((await repo.loadDocument("a")).elements, ALL_TYPES, "ids, types, order and properties preserved");
    assert.equal((await repo.listBoards()).boards.find((b) => b.id === "a")?.updatedAt, 10);

    await repo.renameBoard("a", "Alpha 2", 11);
    assert.equal((await repo.listBoards()).boards.find((b) => b.id === "a")?.name, "Alpha 2");

    await repo.deleteBoard("b");
    assert.deepEqual((await repo.listBoards()).boards.map((b) => b.id), ["a"]);
    await assert.rejects(repo.loadDocument("b"), BoardNotFoundError);
  });

  test("missing records are reported, and a save never resurrects a deleted board", async () => {
    const repo = createIndexedDbBoardRepository(new IDBFactory());
    await assert.rejects(repo.loadDocument("nope"), BoardNotFoundError);
    await assert.rejects(repo.saveDocument("nope", emptyDocument(), 1), BoardNotFoundError);
    await assert.rejects(repo.renameBoard("nope", "x", 1), BoardNotFoundError);
    assert.deepEqual((await repo.listBoards()).boards, []);
  });

  test("a corrupt record is isolated: other boards still list and load", async () => {
    const factory = new IDBFactory();
    const repo = createIndexedDbBoardRepository(factory);
    await repo.createBoard(board("good", "Good", 1, { elements: [rect("g")], viewport: DEFAULT_VIEWPORT }));
    await repo.createBoard(board("bad-doc", "Bad content", 2));
    await rawPut(factory, "documents", { id: "bad-doc", schemaVersion: 1, elements: [{ id: 1 }], viewport: DEFAULT_VIEWPORT });
    await rawPut(factory, "boards", { id: "bad-meta", name: 42, schemaVersion: 1 });

    const list = await repo.listBoards();
    assert.deepEqual(list.boards.map((b) => b.id).sort(), ["bad-doc", "good"]);
    assert.deepEqual(list.unreadable.map((u) => u.id), ["bad-meta"]);
    await assert.rejects(repo.loadDocument("bad-doc"), BoardUnreadableError);
    assert.deepEqual((await repo.loadDocument("good")).elements, [rect("g")]);
  });

  test("the active board id is stored and read back", async () => {
    const repo = createIndexedDbBoardRepository(new IDBFactory());
    assert.equal(await repo.getActiveBoardId(), null);
    await repo.setActiveBoardId("x");
    assert.equal(await repo.getActiveBoardId(), "x");
  });

  test("storage that can't be opened fails with StorageUnavailableError, and can be retried", async () => {
    let fail = true;
    const real = new IDBFactory();
    const flaky = {
      open: (...args: Parameters<IDBFactory["open"]>) => {
        if (fail) throw new Error("disk full");
        return real.open(...args);
      },
    } as IDBFactory;
    const repo = createIndexedDbBoardRepository(flaky);
    await assert.rejects(repo.listBoards(), StorageUnavailableError);
    fail = false;
    assert.deepEqual((await repo.listBoards()).boards, []);
    await assert.rejects(createIndexedDbBoardRepository(undefined).listBoards(), StorageUnavailableError);
  });

  test("a failing write rejects and leaves the stored data unchanged", async () => {
    const repo = createIndexedDbBoardRepository(new IDBFactory());
    await repo.createBoard(board("a", "Alpha", 1, { elements: [rect("old")], viewport: DEFAULT_VIEWPORT }));
    await assert.rejects(repo.createBoard(board("a", "Duplicate id", 2)));
    assert.deepEqual((await repo.loadDocument("a")).elements, [rect("old")], "the aborted transaction wrote nothing");
    assert.equal((await repo.listBoards()).boards[0]?.name, "Alpha");
  });
});

// --------------------------------------------------------------- session

describe("startup and restoration", () => {
  test("first launch creates one default empty board and opens it", async () => {
    const env = setup();
    await env.session.start();
    const state = env.boards.getState();
    assert.equal(state.phase, "ready");
    assert.equal(state.boards.length, 1);
    assert.equal(state.boards[0]?.name, "Untitled board");
    assert.equal(env.workspace.getState().boardId, state.activeBoardId);
    assert.deepEqual(env.workspace.getState().elements, []);
    assert.deepEqual(env.workspace.getState().viewport, DEFAULT_VIEWPORT);
    assert.equal((await env.base.listBoards()).boards.length, 1, "persisted");
  });

  test("start is idempotent (StrictMode double effects create one board)", async () => {
    const env = setup();
    await Promise.all([env.session.start(), env.session.start()]);
    assert.equal((await env.base.listBoards()).boards.length, 1);
  });

  test("restores the previously active board with its elements and viewport, and fresh history", async () => {
    const factory = new IDBFactory();
    const seed = createIndexedDbBoardRepository(factory);
    await seed.createBoard(board("a", "A", 50, { elements: [rect("a1")], viewport: DEFAULT_VIEWPORT }));
    await seed.createBoard(board("b", "B", 10, { elements: [rect("b1"), rect("b2")], viewport: { x: 30, y: 40, zoom: 2 } }));
    await seed.setActiveBoardId("b");

    const env = setup({ factory });
    await env.session.start();
    assert.equal(env.boards.getState().activeBoardId, "b");
    assert.deepEqual(env.workspace.getState().elements.map((e) => e.id), ["b1", "b2"]);
    assert.deepEqual(env.workspace.getState().viewport, { x: 30, y: 40, zoom: 2 });
    assert.deepEqual(env.workspace.getState().history, { past: [], future: [] });
  });

  test("a deleted previously-active board falls back to the most recent board", async () => {
    const factory = new IDBFactory();
    const seed = createIndexedDbBoardRepository(factory);
    await seed.createBoard(board("old", "Old", 1));
    await seed.createBoard(board("new", "New", 99));
    await seed.setActiveBoardId("gone");
    const env = setup({ factory });
    await env.session.start();
    assert.equal(env.boards.getState().activeBoardId, "new");
  });

  test("a corrupt board is skipped, reported, and never overwritten", async () => {
    const factory = new IDBFactory();
    const seed = createIndexedDbBoardRepository(factory);
    await seed.createBoard(board("broken", "Broken", 99));
    await seed.createBoard(board("fine", "Fine", 1, { elements: [rect("ok")], viewport: DEFAULT_VIEWPORT }));
    const corrupt = { id: "broken", schemaVersion: 1, elements: [{ nonsense: true }], viewport: DEFAULT_VIEWPORT };
    await rawPut(factory, "documents", corrupt);
    await seed.setActiveBoardId("broken");

    const env = setup({ factory });
    await env.session.start();
    const state = env.boards.getState();
    assert.equal(state.activeBoardId, "fine");
    assert.deepEqual(state.unreadable.map((u) => u.id), ["broken"]);
    assert.ok(state.notice?.includes("couldn't be opened"));
    env.workspace.getState().addElement(rect("new"));
    await env.session.flush();
    assert.deepEqual(await rawGet(factory, "documents", "broken"), corrupt, "corrupt record untouched");
  });

  test("when every board is unreadable, a new board is created alongside them", async () => {
    const factory = new IDBFactory();
    const seed = createIndexedDbBoardRepository(factory);
    await seed.createBoard(board("broken", "Untitled board", 5));
    await rawPut(factory, "documents", { id: "broken", schemaVersion: 99, elements: [], viewport: DEFAULT_VIEWPORT });
    const env = setup({ factory });
    await env.session.start();
    const list = await env.base.listBoards();
    assert.equal(list.boards.length, 2, "broken board kept, new one added");
    assert.equal(env.boards.getState().boards[0]?.name, "Untitled board 2", "no duplicate name with the kept board");
  });

  test("storage failure at startup reports an error; retry and temporary mode both recover", async () => {
    let fail = true;
    const real = new IDBFactory();
    const flaky = { open: (...args: Parameters<IDBFactory["open"]>) => (fail ? (() => { throw new Error("blocked"); })() : real.open(...args)) } as IDBFactory;
    const env = setup({ factory: flaky });
    await env.session.start();
    assert.equal(env.boards.getState().phase, "failed");
    assert.match(env.boards.getState().startupError ?? "", /blocked/);

    env.session.startTemporary();
    assert.equal(env.boards.getState().phase, "ready");
    assert.equal(env.boards.getState().saveStatus, "temporary");
    env.workspace.getState().addElement(rect("t"));
    await env.session.flush();
    assert.equal(env.boards.getState().saveStatus, "temporary", "nothing claims to be saved");

    fail = false;
    await env.session.retryStart();
    assert.equal(env.boards.getState().phase, "ready");
    assert.equal(env.boards.getState().saveStatus, "saved");
  });
});

describe("autosave", () => {
  function counting(repo: BoardRepository) {
    const calls: { id: string; document: BoardDocument }[] = [];
    return {
      calls,
      wrap: (): BoardRepository => ({
        ...repo,
        saveDocument: async (id, document, updatedAt) => {
          calls.push({ id, document });
          await repo.saveDocument(id, document, updatedAt);
        },
      }),
    };
  }

  test("rapid edits are debounced into one write of the final state", async () => {
    const factory = new IDBFactory();
    const spy = counting(createIndexedDbBoardRepository(factory));
    const env = setup({ factory, wrap: () => spy.wrap() });
    await env.session.start();
    for (let i = 0; i < 10; i++) env.workspace.getState().addElement(rect(`e${i}`, i));
    assert.equal(env.boards.getState().saveStatus, "pending");
    assert.equal(spy.calls.length, 0, "nothing written during the burst");
    await tick(30);
    await env.session.flush();
    assert.equal(spy.calls.length, 1);
    assert.equal(spy.calls[0]?.document.elements.length, 10);
    assert.equal(env.boards.getState().saveStatus, "saved");
  });

  test("'saved' is only shown after storage confirms the write", async () => {
    const factory = new IDBFactory();
    const real = createIndexedDbBoardRepository(factory);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const env = setup({
      factory,
      wrap: (repo) => ({ ...repo, saveDocument: async (...args) => { await gate; await real.saveDocument(...args); } }),
    });
    await env.session.start();
    env.workspace.getState().addElement(rect("a"));
    const flushing = env.session.flush();
    await tick(5);
    assert.equal(env.boards.getState().saveStatus, "saving");
    release();
    await flushing;
    assert.equal(env.boards.getState().saveStatus, "saved");
  });

  test("saves are serialized: a slow older write can't overwrite a newer one", async () => {
    const factory = new IDBFactory();
    const real = createIndexedDbBoardRepository(factory);
    let first = true;
    const env = setup({
      factory,
      wrap: (repo) => ({
        ...repo,
        saveDocument: async (...args) => {
          if (first) {
            first = false;
            await tick(40);
          }
          await real.saveDocument(...args);
        },
      }),
    });
    await env.session.start();
    const id = env.boards.getState().activeBoardId!;
    env.workspace.getState().addElement(rect("old"));
    void env.session.flushNow();
    env.workspace.getState().addElement(rect("new"));
    await env.session.flush();
    assert.deepEqual((await real.loadDocument(id)).elements.map((e) => e.id), ["old", "new"]);
    assert.equal(env.boards.getState().saveStatus, "saved");
  });

  test("viewport changes are saved; selection and tool changes are not", async () => {
    const factory = new IDBFactory();
    const spy = counting(createIndexedDbBoardRepository(factory));
    const env = setup({ factory, wrap: () => spy.wrap() });
    await env.session.start();
    env.workspace.getState().setSelection([]);
    env.workspace.getState().setActiveTool("ellipse");
    await tick(20);
    assert.equal(spy.calls.length, 0);
    env.workspace.getState().panViewport(100, 50);
    await tick(20);
    await env.session.flush();
    assert.deepEqual(spy.calls.at(-1)?.document.viewport, { x: -100, y: -50, zoom: 1 });
  });

  test("undo and redo results are persisted", async () => {
    const factory = new IDBFactory();
    const env = setup({ factory });
    await env.session.start();
    const id = env.boards.getState().activeBoardId!;
    env.workspace.getState().addElement(rect("a"));
    env.workspace.getState().addElement(rect("b"));
    await env.session.flush();
    env.workspace.getState().undo();
    await env.session.flush();
    assert.deepEqual((await env.base.loadDocument(id)).elements.map((e) => e.id), ["a"]);
    env.workspace.getState().redo();
    await env.session.flush();
    assert.deepEqual((await env.base.loadDocument(id)).elements.map((e) => e.id), ["a", "b"]);
  });

  test("a failed save shows an error, keeps the changes, and retry succeeds", async () => {
    const factory = new IDBFactory();
    const real = createIndexedDbBoardRepository(factory);
    let broken = true;
    const env = setup({
      factory,
      wrap: (repo) => ({
        ...repo,
        saveDocument: async (...args) => {
          if (broken) throw new Error("QuotaExceededError");
          await real.saveDocument(...args);
        },
      }),
    });
    await env.session.start();
    const id = env.boards.getState().activeBoardId!;
    env.workspace.getState().addElement(rect("keep"));
    await env.session.flush();
    assert.equal(env.boards.getState().saveStatus, "error");
    assert.match(env.boards.getState().saveError ?? "", /Quota/);
    assert.deepEqual((await real.loadDocument(id)).elements, []);

    broken = false;
    await env.session.retrySave();
    assert.equal(env.boards.getState().saveStatus, "saved");
    assert.deepEqual((await real.loadDocument(id)).elements.map((e) => e.id), ["keep"]);
  });
});

describe("board management and isolation", () => {
  async function twoBoards() {
    const env = setup();
    await env.session.start();
    const first = env.boards.getState().activeBoardId!;
    env.workspace.getState().addElement(rect("on-first"));
    env.workspace.getState().setSelection(["on-first"]);
    env.workspace.getState().panViewport(40, 0);
    assert.deepEqual(await env.session.createBoard("Second"), { ok: true });
    const second = env.boards.getState().activeBoardId!;
    return { ...env, first, second };
  }

  test("creating a board saves the current one and opens a fresh, empty board", async () => {
    const env = await twoBoards();
    assert.notEqual(env.first, env.second);
    assert.deepEqual(env.workspace.getState().elements, []);
    assert.deepEqual(env.workspace.getState().selectedIds, []);
    assert.deepEqual(env.workspace.getState().viewport, DEFAULT_VIEWPORT);
    assert.deepEqual(env.workspace.getState().history, { past: [], future: [] });
    assert.deepEqual((await env.base.loadDocument(env.first)).elements.map((e) => e.id), ["on-first"], "saved without waiting");
  });

  test("switching restores each board's own elements and viewport, with no leaks", async () => {
    const env = await twoBoards();
    env.workspace.getState().addElement(rect("on-second"));
    assert.deepEqual(await env.session.switchBoard(env.first), { ok: true });
    assert.deepEqual(env.workspace.getState().elements.map((e) => e.id), ["on-first"]);
    assert.deepEqual(env.workspace.getState().viewport, { x: -40, y: 0, zoom: 1 });
    assert.deepEqual(env.workspace.getState().selectedIds, []);
    assert.equal(env.workspace.getState().undo(), false, "history doesn't cross boards");

    await env.session.switchBoard(env.second);
    assert.deepEqual(env.workspace.getState().elements.map((e) => e.id), ["on-second"]);
    assert.deepEqual(env.workspace.getState().viewport, DEFAULT_VIEWPORT);
  });

  test("rapid switching ends on the last board requested", async () => {
    const env = await twoBoards();
    await env.session.createBoard("Third");
    const third = env.boards.getState().activeBoardId!;
    const results = await Promise.all([
      env.session.switchBoard(env.first),
      env.session.switchBoard(env.second),
      env.session.switchBoard(third === env.boards.getState().activeBoardId ? env.first : third),
    ]);
    assert.equal(results.at(-1)?.ok, true);
    assert.equal(env.boards.getState().activeBoardId, env.first);
    assert.deepEqual(env.workspace.getState().elements.map((e) => e.id), ["on-first"]);
  });

  test("an edit made while a switch is loading is still saved", async () => {
    const env = await twoBoards();
    const switching = env.session.switchBoard(env.first);
    env.workspace.getState().addElement(rect("late"));
    await switching;
    await env.session.flush();
    assert.deepEqual((await env.base.loadDocument(env.second)).elements.map((e) => e.id), ["late"]);
  });

  test("switching is refused when the current board can't be saved", async () => {
    let broken = false;
    const factory = new IDBFactory();
    const real = createIndexedDbBoardRepository(factory);
    const env = setup({
      factory,
      wrap: (repo) => ({ ...repo, saveDocument: async (...args) => { if (broken) throw new Error("io"); await real.saveDocument(...args); } }),
    });
    await env.session.start();
    const first = env.boards.getState().activeBoardId!;
    await env.session.createBoard("Other");
    broken = true;
    env.workspace.getState().addElement(rect("unsaved"));
    const result = await env.session.switchBoard(first);
    assert.equal(result.ok, false);
    assert.notEqual(env.boards.getState().activeBoardId, first);
    assert.deepEqual(env.workspace.getState().elements.map((e) => e.id), ["unsaved"], "nothing lost");
  });

  test("rename validates and persists; duplicates are refused", async () => {
    const env = await twoBoards();
    assert.equal((await env.session.renameBoard(env.second, "  ")).ok, false);
    assert.equal((await env.session.renameBoard(env.second, "untitled BOARD")).ok, false);
    assert.deepEqual(await env.session.renameBoard(env.second, "Roadmap"), { ok: true });
    assert.equal((await env.base.listBoards()).boards.find((b) => b.id === env.second)?.name, "Roadmap");
  });

  test("board ids are unique", async () => {
    const env = setup({ ids: ["x", "y", "z"] });
    await env.session.start();
    await env.session.createBoard("Two");
    await env.session.createBoard("Three");
    assert.deepEqual(env.boards.getState().boards.map((b) => b.id).sort(), ["x", "y", "z"]);
    const real = setup();
    await real.session.start();
    for (let i = 0; i < 20; i++) await real.session.createBoard(`B${i}`);
    const ids = real.boards.getState().boards.map((b) => b.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test("deleting an inactive board keeps the current one", async () => {
    const env = await twoBoards();
    await env.session.deleteBoard(env.first);
    assert.equal(env.boards.getState().activeBoardId, env.second);
    assert.deepEqual(env.boards.getState().boards.map((b) => b.id), [env.second]);
    await assert.rejects(env.base.loadDocument(env.first), BoardNotFoundError);
  });

  test("deleting the active board opens the most recent remaining one", async () => {
    const env = await twoBoards();
    await env.session.deleteBoard(env.second);
    assert.equal(env.boards.getState().activeBoardId, env.first);
    assert.deepEqual(env.workspace.getState().elements.map((e) => e.id), ["on-first"]);
  });

  test("deleting the last board creates a new default board", async () => {
    const env = setup();
    await env.session.start();
    const only = env.boards.getState().activeBoardId!;
    env.workspace.getState().addElement(rect("x"));
    await env.session.deleteBoard(only);
    const state = env.boards.getState();
    assert.equal(state.boards.length, 1);
    assert.notEqual(state.activeBoardId, only);
    assert.deepEqual(env.workspace.getState().elements, []);
    await tick(20);
    assert.deepEqual((await env.base.listBoards()).boards.map((b) => b.id), [state.activeBoardId], "the deleted board stays deleted");
  });
});
