import { create, type StoreApi } from "zustand";
import { createId } from "../../../lib/createId.ts";
import { useWorkspaceStore, type WorkspaceStore } from "../../workspace/store/workspaceStore.ts";
import {
  checkBoardName,
  DEFAULT_BOARD_NAME,
  emptyDocument,
  nextDefaultName,
  type BoardDocument,
  type BoardMeta,
} from "../lib/model.ts";

export type ActionResult = { ok: true } | { ok: false; reason: string };

export type BoardDialog =
  { kind: "create" } | { kind: "rename"; boardId: string } | { kind: "delete"; boardId: string } | null;

export interface BoardsState {
  boards: BoardMeta[];
  documents: Record<string, BoardDocument>;
  activeBoardId: string;
  dialog: BoardDialog;
}

export interface BoardsActions {
  syncBoards: (boards: readonly BoardMeta[]) => void;
  addBoard: (board: BoardMeta, document?: BoardDocument) => void;
  createBoard: (name: string) => ActionResult;
  renameBoard: (boardId: string, name: string) => ActionResult;
  deleteBoard: (boardId: string) => ActionResult;
  switchBoard: (boardId: string) => ActionResult;
  openDialog: (dialog: BoardDialog) => void;
  closeDialog: () => void;
}

export type BoardsStore = BoardsState & BoardsActions;

export interface BoardsStoreOptions {
  workspace?: Pick<StoreApi<WorkspaceStore>, "getState">;
  now?: () => number;
  createId?: () => string;
  seedDefaultBoard?: boolean;
}

export const createBoardsStore = (options: BoardsStoreOptions = {}) => {
  const workspace = options.workspace ?? useWorkspaceStore;
  const now = options.now ?? Date.now;
  const newId = options.createId ?? createId;
  const seedDefaultBoard = options.seedDefaultBoard ?? true;

  const newBoard = (name: string): BoardMeta => {
    const time = now();
    return { id: newId(), name, createdAt: time, updatedAt: time };
  };

  const open = (boardId: string, document: BoardDocument) => workspace.getState().loadDocument(boardId, document);

  return create<BoardsStore>()((set, get) => {
    const withCurrentDocument = (): Record<string, BoardDocument> => {
      const { activeBoardId, documents } = get();
      if (!activeBoardId) return documents;
      const { elements, viewport } = workspace.getState();
      return { ...documents, [activeBoardId]: { elements, viewport } };
    };

    const addBoard = (board: BoardMeta, document: BoardDocument = emptyDocument()) => {
      const exists = get().boards.some((existing) => existing.id === board.id);
      set({
        boards: exists ? get().boards : [...get().boards, board],
        documents: { ...withCurrentDocument(), [board.id]: document },
        activeBoardId: board.id,
      });
      open(board.id, document);
    };

    const first = seedDefaultBoard ? newBoard(DEFAULT_BOARD_NAME) : null;
    if (first) open(first.id, emptyDocument());

    return {
      boards: first ? [first] : [],
      documents: first ? { [first.id]: emptyDocument() } : {},
      activeBoardId: first?.id ?? "",
      dialog: null,

      syncBoards: (incoming) => {
        const boards = [...incoming];
        const documents = withCurrentDocument();
        const { activeBoardId } = get();
        if (boards.some((board) => board.id === activeBoardId)) {
          set({ boards, documents });
          return;
        }

        const next = boards[0];
        if (!next) {
          set({ boards, documents, activeBoardId: "" });
          return;
        }
        const document = documents[next.id] ?? emptyDocument();
        set({ boards, documents: { ...documents, [next.id]: document }, activeBoardId: next.id });
        open(next.id, document);
      },

      addBoard,

      createBoard: (rawName) => {
        const check = checkBoardName(rawName, get().boards);
        if (!check.ok) return check;
        addBoard(newBoard(check.name));
        return { ok: true };
      },

      renameBoard: (boardId, rawName) => {
        const check = checkBoardName(rawName, get().boards, boardId);
        if (!check.ok) return check;
        set({
          boards: get().boards.map((board) =>
            board.id === boardId ? { ...board, name: check.name, updatedAt: now() } : board,
          ),
        });
        return { ok: true };
      },

      deleteBoard: (boardId) => {
        const { activeBoardId } = get();
        const boards = get().boards.filter((board) => board.id !== boardId);
        const documents = { ...get().documents };
        delete documents[boardId];
        if (boardId !== activeBoardId) {
          set({ boards, documents });
          return { ok: true };
        }

        const fallback = boards.at(-1);
        const next = fallback ?? newBoard(nextDefaultName(boards));
        const document = documents[next.id] ?? emptyDocument();
        set({
          boards: fallback ? boards : [next],
          documents: { ...documents, [next.id]: document },
          activeBoardId: next.id,
        });
        open(next.id, document);
        return { ok: true };
      },

      switchBoard: (boardId) => {
        if (boardId === get().activeBoardId) return { ok: true };
        const document = get().documents[boardId];
        if (!document) return { ok: false, reason: "That board no longer exists." };
        set({ documents: withCurrentDocument(), activeBoardId: boardId });
        open(boardId, document);
        return { ok: true };
      },

      openDialog: (dialog) => set({ dialog }),
      closeDialog: () => set({ dialog: null }),
    };
  });
};

export const useBoardsStore = createBoardsStore({ seedDefaultBoard: false });

export type BoardsStoreApi = typeof useBoardsStore;
