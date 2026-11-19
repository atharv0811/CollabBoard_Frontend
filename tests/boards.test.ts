import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createBoardsStore } from "../src/features/boards/store/boardsStore.ts";
import { checkBoardName, nextDefaultName, type BoardMeta } from "../src/features/boards/lib/model.ts";
import { DEFAULT_STYLE, type CanvasElement } from "../src/features/workspace/canvas/elements.ts";
import { DEFAULT_VIEWPORT } from "../src/features/workspace/canvas/viewport.ts";
import { createWorkspaceStore } from "../src/features/workspace/store/workspaceStore.ts";

const rect = (id: string, x = 0): CanvasElement => ({
  id,
  type: "rectangle",
  style: DEFAULT_STYLE,
  x,
  y: 0,
  width: 40,
  height: 30,
});

function setup(ids?: string[]) {
  const workspace = createWorkspaceStore();
  let clock = 1000;
  let counter = 0;
  const boards = createBoardsStore({
    workspace,
    now: () => ++clock,
    createId: () => ids?.[counter++] ?? `board-${++counter}`,
  });
  return { workspace, boards };
}

function twoBoards() {
  const env = setup();
  const first = env.boards.getState().activeBoardId;
  env.workspace.getState().addElement(rect("on-first"));
  env.workspace.getState().setSelection(["on-first"]);
  env.workspace.getState().panViewport(40, 0);
  assert.deepEqual(env.boards.getState().createBoard("Second"), { ok: true });
  const second = env.boards.getState().activeBoardId;
  return { ...env, first, second };
}

const elementIds = (env: { workspace: ReturnType<typeof createWorkspaceStore> }) =>
  env.workspace.getState().elements.map((element) => element.id);

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
    const taken = ["Untitled board", "Untitled board 2"].map((name, i) => ({
      id: `${i}`,
      name,
      createdAt: 0,
      updatedAt: 0,
    }));
    assert.equal(nextDefaultName(taken), "Untitled board 3");
  });
});

describe("boards state", () => {
  test("starts with one empty default board, opened in the workspace", () => {
    const env = setup();
    const state = env.boards.getState();
    assert.equal(state.boards.length, 1);
    assert.equal(state.boards[0]?.name, "Untitled board");
    assert.equal(state.activeBoardId, state.boards[0]?.id);
    assert.equal(env.workspace.getState().boardId, state.activeBoardId);
    assert.deepEqual(env.workspace.getState().elements, []);
    assert.deepEqual(env.workspace.getState().viewport, DEFAULT_VIEWPORT);
  });

  test("creating a board keeps the current one in state and opens a fresh, empty board", () => {
    const env = twoBoards();
    assert.notEqual(env.first, env.second);
    assert.deepEqual(env.workspace.getState().elements, []);
    assert.deepEqual(env.workspace.getState().selectedIds, []);
    assert.deepEqual(env.workspace.getState().viewport, DEFAULT_VIEWPORT);
    assert.deepEqual(env.workspace.getState().history, { past: [], future: [] });
    assert.deepEqual(
      env.boards.getState().documents[env.first]?.elements.map((element) => element.id),
      ["on-first"],
    );
  });

  test("switching restores each board's own elements and viewport, with no leaks", () => {
    const env = twoBoards();
    env.workspace.getState().addElement(rect("on-second"));
    assert.deepEqual(env.boards.getState().switchBoard(env.first), { ok: true });
    assert.deepEqual(elementIds(env), ["on-first"]);
    assert.deepEqual(env.workspace.getState().viewport, { x: -40, y: 0, zoom: 1 });
    assert.deepEqual(env.workspace.getState().selectedIds, []);
    assert.equal(env.workspace.getState().undo(), false);

    env.boards.getState().switchBoard(env.second);
    assert.deepEqual(elementIds(env), ["on-second"]);
    assert.deepEqual(env.workspace.getState().viewport, DEFAULT_VIEWPORT);
  });

  test("switching to a missing board is refused and changes nothing", () => {
    const env = twoBoards();
    assert.equal(env.boards.getState().switchBoard("nope").ok, false);
    assert.equal(env.boards.getState().activeBoardId, env.second);
  });

  test("rename validates; duplicates are refused", () => {
    const env = twoBoards();
    assert.equal(env.boards.getState().renameBoard(env.second, "  ").ok, false);
    assert.equal(env.boards.getState().renameBoard(env.second, "untitled BOARD").ok, false);
    assert.deepEqual(env.boards.getState().renameBoard(env.second, "Roadmap"), { ok: true });
    assert.equal(env.boards.getState().boards.find((board) => board.id === env.second)?.name, "Roadmap");
  });

  test("duplicate names are refused on create", () => {
    const env = twoBoards();
    assert.equal(env.boards.getState().createBoard("second").ok, false);
    assert.equal(env.boards.getState().boards.length, 2);
  });

  test("board ids are unique", () => {
    const env = setup(["x", "y", "z"]);
    env.boards.getState().createBoard("Two");
    env.boards.getState().createBoard("Three");
    assert.deepEqual(
      env.boards.getState().boards.map((board) => board.id),
      ["x", "y", "z"],
    );
  });

  test("deleting an inactive board keeps the current one", () => {
    const env = twoBoards();
    env.boards.getState().deleteBoard(env.first);
    assert.equal(env.boards.getState().activeBoardId, env.second);
    assert.deepEqual(
      env.boards.getState().boards.map((board) => board.id),
      [env.second],
    );
    assert.equal(env.boards.getState().documents[env.first], undefined);
  });

  test("deleting the active board opens a remaining one with its content", () => {
    const env = twoBoards();
    env.boards.getState().deleteBoard(env.second);
    assert.equal(env.boards.getState().activeBoardId, env.first);
    assert.deepEqual(elementIds(env), ["on-first"]);
  });

  test("deleting the last board creates a new default board", () => {
    const env = setup();
    const only = env.boards.getState().activeBoardId;
    env.workspace.getState().addElement(rect("x"));
    env.boards.getState().deleteBoard(only);
    const state = env.boards.getState();
    assert.equal(state.boards.length, 1);
    assert.equal(state.boards[0]?.name, "Untitled board");
    assert.notEqual(state.activeBoardId, only);
    assert.deepEqual(env.workspace.getState().elements, []);
  });
});
