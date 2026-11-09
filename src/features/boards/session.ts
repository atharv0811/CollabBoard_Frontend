import type { StoreApi } from "zustand";
import { createId as defaultCreateId } from "../../lib/createId.ts";
import type { WorkspaceStore } from "../workspace/store/workspaceStore.ts";
import type { BoardsState, BoardsStore } from "./boardsStore.ts";
import {
  byMostRecent,
  checkBoardName,
  emptyDocument,
  nextDefaultName,
  type Board,
  type BoardDocument,
  type BoardMeta,
} from "./model.ts";
import {
  BoardNotFoundError,
  BoardUnreadableError,
  describeError,
  type BoardRepository,
  type UnreadableBoard,
} from "./repository.ts";

export const DEFAULT_SAVE_DELAY_MS = 400;
export const TEMPORARY_BOARD_ID = "temporary";

export type ActionResult = { ok: true } | { ok: false; reason: string };

export interface BoardSessionOptions {
  repository: BoardRepository;
  workspace: Pick<StoreApi<WorkspaceStore>, "getState" | "subscribe">;
  boards: Pick<StoreApi<BoardsStore>, "getState" | "setState">;
  saveDelayMs?: number;
  now?: () => number;
  createId?: () => string;
}

interface SaveJob {
  boardId: string;
  document: BoardDocument;
  revision: number;
  updatedAt: number;
}

const toMeta = (board: Board): BoardMeta => ({
  id: board.id,
  name: board.name,
  createdAt: board.createdAt,
  updatedAt: board.updatedAt,
});

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export class BoardSession {
  private readonly repository: BoardRepository;
  private readonly workspace: BoardSessionOptions["workspace"];
  private readonly boards: BoardSessionOptions["boards"];
  private readonly saveDelayMs: number;
  private readonly now: () => number;
  private readonly createId: () => string;

  private startPromise: Promise<void> | null = null;
  private unsubscribe: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private revision = 0;
  private queue: Promise<void> = Promise.resolve();
  private switchToken = 0;
  private temporary = false;

  constructor(options: BoardSessionOptions) {
    this.repository = options.repository;
    this.workspace = options.workspace;
    this.boards = options.boards;
    this.saveDelayMs = options.saveDelayMs ?? DEFAULT_SAVE_DELAY_MS;
    this.now = options.now ?? Date.now;
    this.createId = options.createId ?? defaultCreateId;
  }

  start(): Promise<void> {
    this.startPromise ??= this.initialize();
    return this.startPromise;
  }

  retryStart(): Promise<void> {
    this.startPromise = null;
    return this.start();
  }

  startTemporary(): void {
    this.temporary = true;
    this.cancelTimer();
    this.dirty = false;
    this.workspace.getState().loadDocument(TEMPORARY_BOARD_ID, emptyDocument());
    const now = this.now();
    this.set({
      phase: "ready",
      boards: [{ id: TEMPORARY_BOARD_ID, name: "Unsaved board", createdAt: now, updatedAt: now }],
      unreadable: [],
      activeBoardId: TEMPORARY_BOARD_ID,
      saveStatus: "temporary",
      saveError: null,
    });
  }

  get isTemporary(): boolean {
    return this.temporary;
  }

  dispose(): void {
    this.cancelTimer();
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private set(partial: Partial<BoardsState>) {
    this.boards.setState(partial);
  }

  private get state(): BoardsState {
    return this.boards.getState();
  }

  private async initialize(): Promise<void> {
    this.temporary = false;
    this.set({ phase: "loading", startupError: null });
    try {
      const list = await this.repository.listBoards();
      const storedActive = await this.repository.getActiveBoardId().catch(() => null);
      const sorted = [...list.boards].sort(byMostRecent);
      const ordered = [...sorted.filter((board) => board.id === storedActive), ...sorted.filter((board) => board.id !== storedActive)];
      const unreadable: UnreadableBoard[] = [...list.unreadable];

      let opened: { meta: BoardMeta; document: BoardDocument } | null = null;
      for (const meta of ordered) {
        try {
          opened = { meta, document: await this.repository.loadDocument(meta.id) };
          break;
        } catch (error) {
          if (error instanceof BoardUnreadableError) unreadable.push({ id: meta.id, name: meta.name, reason: error.message });
          else if (!(error instanceof BoardNotFoundError)) throw error;
        }
      }

      const boards = sorted.filter((board) => !unreadable.some((entry) => entry.id === board.id));
      if (!opened) {
        const taken = [...boards, ...unreadable.map((entry) => ({ id: entry.id, name: entry.name ?? "", createdAt: 0, updatedAt: 0 }))];
        const board = this.newBoard(nextDefaultName(taken));
        await this.repository.createBoard(board);
        boards.push(toMeta(board));
        opened = { meta: toMeta(board), document: board };
      }

      this.attachAutosave();
      this.show(opened.meta.id, opened.document);
      this.set({
        phase: "ready",
        boards,
        unreadable,
        notice: unreadable.length
          ? `${plural(unreadable.length, "board")} couldn't be opened and ${unreadable.length === 1 ? "was" : "were"} left untouched.`
          : null,
      });
      void this.rememberActive(opened.meta.id);
    } catch (error) {
      this.startPromise = null;
      this.set({ phase: "failed", startupError: describeError(error) });
    }
  }

  private attachAutosave() {
    if (this.unsubscribe) return;
    this.unsubscribe = this.workspace.subscribe((state, previous) => {
      if (this.temporary || !state.boardId || state.boardId !== previous.boardId) return;
      if (state.elements !== previous.elements || state.viewport !== previous.viewport) this.markDirty();
    });
  }

  private newBoard(name: string): Board {
    const now = this.now();
    return { id: this.createId(), name, createdAt: now, updatedAt: now, ...emptyDocument() };
  }

  private show(boardId: string, document: BoardDocument) {
    this.cancelTimer();
    this.dirty = false;
    this.workspace.getState().loadDocument(boardId, document);
    this.set({ activeBoardId: boardId, saveStatus: "saved", saveError: null, switchingTo: null });
  }

  private rememberActive(boardId: string) {
    return this.repository.setActiveBoardId(boardId).catch(() => undefined);
  }

  private cancelTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private markDirty() {
    this.dirty = true;
    this.revision += 1;
    this.set({ saveStatus: "pending" });
    this.cancelTimer();
    this.timer = setTimeout(() => void this.flushNow(), this.saveDelayMs);
  }

  flushNow(): Promise<void> {
    this.cancelTimer();
    const { boardId, elements, viewport } = this.workspace.getState();
    if (!this.dirty || this.temporary || !boardId) return this.queue;

    this.dirty = false;
    const job: SaveJob = { boardId, document: { elements, viewport }, revision: this.revision, updatedAt: this.now() };
    this.queue = this.queue.then(() => this.write(job));
    return this.queue;
  }

  async flush(): Promise<boolean> {
    await this.flushNow();
    return this.state.saveStatus !== "error";
  }

  retrySave(): Promise<void> {
    if (this.temporary) return this.queue;
    this.dirty = true;
    return this.flushNow();
  }

  private isLatest(job: SaveJob) {
    return job.boardId === this.workspace.getState().boardId && job.revision === this.revision;
  }

  private async write(job: SaveJob): Promise<void> {
    if (this.isLatest(job)) this.set({ saveStatus: "saving" });
    try {
      await this.repository.saveDocument(job.boardId, job.document, job.updatedAt);
      this.set({
        boards: this.state.boards.map((board) => (board.id === job.boardId ? { ...board, updatedAt: job.updatedAt } : board)),
      });
      if (this.isLatest(job) && !this.dirty) this.set({ saveStatus: "saved", saveError: null });
    } catch (error) {
      if (error instanceof BoardNotFoundError) return;
      if (job.boardId !== this.workspace.getState().boardId) return;
      if (job.revision === this.revision) this.dirty = true;
      this.set({ saveStatus: "error", saveError: describeError(error) });
    }
  }

  async switchBoard(boardId: string): Promise<ActionResult> {
    if (this.temporary) return { ok: false, reason: "Boards are unavailable without storage." };
    if (boardId === this.state.activeBoardId) return { ok: true };
    const token = ++this.switchToken;
    this.set({ switchingTo: boardId });

    const leave = async (): Promise<ActionResult | null> => {
      const saved = await this.flush();
      if (token !== this.switchToken) return { ok: false, reason: "Superseded by another switch." };
      if (saved) return null;
      this.set({ switchingTo: null, notice: "Couldn't save this board, so it stayed open. Retry saving first." });
      return { ok: false, reason: "The current board could not be saved." };
    };

    const blocked = await leave();
    if (blocked) return blocked;

    let document: BoardDocument;
    try {
      document = await this.repository.loadDocument(boardId);
    } catch (error) {
      if (token !== this.switchToken) return { ok: false, reason: "Superseded by another switch." };
      this.set({ switchingTo: null, ...this.unreadableUpdate(boardId, error) });
      return { ok: false, reason: describeError(error) };
    }
    if (token !== this.switchToken) return { ok: false, reason: "Superseded by another switch." };

    if (this.dirty) {
      const stillBlocked = await leave();
      if (stillBlocked) return stillBlocked;
    }

    this.show(boardId, document);
    void this.rememberActive(boardId);
    return { ok: true };
  }

  private unreadableUpdate(boardId: string, error: unknown): Partial<BoardsState> {
    if (error instanceof BoardNotFoundError) {
      return { boards: this.state.boards.filter((board) => board.id !== boardId), notice: "That board no longer exists." };
    }
    if (error instanceof BoardUnreadableError) {
      const meta = this.state.boards.find((board) => board.id === boardId);
      return {
        boards: this.state.boards.filter((board) => board.id !== boardId),
        unreadable: [...this.state.unreadable, { id: boardId, name: meta?.name ?? null, reason: error.message }],
        notice: `“${meta?.name ?? "That board"}” couldn't be opened. It was left untouched.`,
      };
    }
    return { notice: `Couldn't open the board: ${describeError(error)}` };
  }

  async createBoard(rawName: string): Promise<ActionResult> {
    if (this.temporary) return { ok: false, reason: "Boards are unavailable without storage." };
    const check = checkBoardName(rawName, this.state.boards);
    if (!check.ok) return check;
    if (!(await this.flush())) return { ok: false, reason: "Couldn't save the current board. Retry saving first." };

    const board = this.newBoard(check.name);
    try {
      await this.repository.createBoard(board);
    } catch (error) {
      return { ok: false, reason: `Couldn't create the board: ${describeError(error)}` };
    }
    this.switchToken += 1;
    if (this.dirty && !(await this.flush())) {
      this.set({ boards: [...this.state.boards, toMeta(board)] });
      return { ok: false, reason: "Board created, but the current board couldn't be saved, so it stayed open." };
    }
    this.set({ boards: [...this.state.boards, toMeta(board)] });
    this.show(board.id, board);
    void this.rememberActive(board.id);
    return { ok: true };
  }

  async renameBoard(boardId: string, rawName: string): Promise<ActionResult> {
    if (this.temporary) return { ok: false, reason: "Boards are unavailable without storage." };
    const check = checkBoardName(rawName, this.state.boards, boardId);
    if (!check.ok) return check;
    const updatedAt = this.now();
    try {
      await this.repository.renameBoard(boardId, check.name, updatedAt);
    } catch (error) {
      return { ok: false, reason: `Couldn't rename the board: ${describeError(error)}` };
    }
    this.set({
      boards: this.state.boards.map((board) => (board.id === boardId ? { ...board, name: check.name, updatedAt } : board)),
    });
    return { ok: true };
  }

  async deleteBoard(boardId: string): Promise<ActionResult> {
    if (this.temporary) return { ok: false, reason: "Boards are unavailable without storage." };
    const wasActive = boardId === this.state.activeBoardId;
    if (wasActive) {
      this.cancelTimer();
      this.dirty = false;
    }
    await this.queue;

    try {
      await this.repository.deleteBoard(boardId);
    } catch (error) {
      return { ok: false, reason: `Couldn't delete the board: ${describeError(error)}` };
    }
    this.set({
      boards: this.state.boards.filter((board) => board.id !== boardId),
      unreadable: this.state.unreadable.filter((entry) => entry.id !== boardId),
    });
    if (!wasActive) return { ok: true };

    this.switchToken += 1;
    for (const candidate of [...this.state.boards].sort(byMostRecent)) {
      try {
        const document = await this.repository.loadDocument(candidate.id);
        this.show(candidate.id, document);
        void this.rememberActive(candidate.id);
        return { ok: true };
      } catch (error) {
        this.set(this.unreadableUpdate(candidate.id, error));
      }
    }

    const board = this.newBoard(nextDefaultName(this.state.boards));
    try {
      await this.repository.createBoard(board);
    } catch (error) {
      return { ok: false, reason: `Board deleted, but a new one couldn't be created: ${describeError(error)}` };
    }
    this.set({ boards: [...this.state.boards, toMeta(board)] });
    this.show(board.id, board);
    void this.rememberActive(board.id);
    return { ok: true };
  }
}
