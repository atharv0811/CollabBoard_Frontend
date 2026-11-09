import type { Board, BoardDocument, BoardMeta } from "./model.ts";

export class BoardNotFoundError extends Error {
  readonly boardId: string;

  constructor(boardId: string) {
    super(`Board ${boardId} no longer exists.`);
    this.name = "BoardNotFoundError";
    this.boardId = boardId;
  }
}

export class BoardUnreadableError extends Error {
  readonly boardId: string;

  constructor(boardId: string, reason: string) {
    super(reason);
    this.name = "BoardUnreadableError";
    this.boardId = boardId;
  }
}

export class StorageUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "StorageUnavailableError";
  }
}

export interface UnreadableBoard {
  id: string;
  name: string | null;
  reason: string;
}

export interface BoardList {
  boards: BoardMeta[];
  unreadable: UnreadableBoard[];
}

export interface BoardRepository {
  listBoards(): Promise<BoardList>;
  loadDocument(id: string): Promise<BoardDocument>;
  createBoard(board: Board): Promise<void>;
  saveDocument(id: string, document: BoardDocument, updatedAt: number): Promise<void>;
  renameBoard(id: string, name: string, updatedAt: number): Promise<void>;
  deleteBoard(id: string): Promise<void>;
  getActiveBoardId(): Promise<string | null>;
  setActiveBoardId(id: string): Promise<void>;
}

export const describeError = (error: unknown) =>
  error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown storage error.";
