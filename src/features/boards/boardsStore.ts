import { create } from "zustand";
import type { BoardMeta } from "./model.ts";
import type { UnreadableBoard } from "./repository.ts";

export type StartupPhase = "idle" | "loading" | "ready" | "failed";

export type SaveStatus = "saved" | "pending" | "saving" | "error" | "temporary";

export type BoardDialog =
  | { kind: "create" }
  | { kind: "rename"; boardId: string }
  | { kind: "delete"; boardId: string }
  | null;

export interface BoardsState {
  phase: StartupPhase;
  startupError: string | null;
  boards: BoardMeta[];
  unreadable: UnreadableBoard[];
  activeBoardId: string | null;
  switchingTo: string | null;
  saveStatus: SaveStatus;
  saveError: string | null;
  notice: string | null;
  dialog: BoardDialog;
}

export interface BoardsActions {
  openDialog: (dialog: BoardDialog) => void;
  closeDialog: () => void;
  dismissNotice: () => void;
}

export type BoardsStore = BoardsState & BoardsActions;

export const initialBoardsState: BoardsState = {
  phase: "idle",
  startupError: null,
  boards: [],
  unreadable: [],
  activeBoardId: null,
  switchingTo: null,
  saveStatus: "saved",
  saveError: null,
  notice: null,
  dialog: null,
};

export const createBoardsStore = () =>
  create<BoardsStore>()((set) => ({
    ...initialBoardsState,
    openDialog: (dialog) => set({ dialog }),
    closeDialog: () => set({ dialog: null }),
    dismissNotice: () => set({ notice: null }),
  }));

export const useBoardsStore = createBoardsStore();

export type BoardsStoreApi = typeof useBoardsStore;
