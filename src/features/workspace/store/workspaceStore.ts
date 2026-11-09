import { create } from "zustand";
import type { CanvasElement } from "../canvas/elements.ts";
import type { ToolId } from "../data/tools.ts";

/*
 * Workspace store: the board document and editing state shared across the
 * canvas, toolbar, keyboard shortcuts and selection actions.
 *
 * Deliberately NOT in here:
 *   - transient pointer state (active pointer, drag origin, live previews)
 *     → lives in useCanvasInteraction and is committed once per gesture
 *   - geometry / hit testing → pure modules in ../canvas
 *
 * All document changes go through addElement / updateElements /
 * deleteElements, which is the seam future undo/redo, persistence and
 * collaboration will wrap.
 */

export interface WorkspaceState {
  /** Render order: later elements are drawn on top. */
  elements: CanvasElement[];
  /** Ids of selected elements, in selection order. */
  selectedIds: string[];
  activeTool: ToolId;
}

export interface WorkspaceActions {
  addElement: (element: CanvasElement) => void;
  /** Replaces elements by id; ids that no longer exist are ignored. */
  updateElements: (updated: readonly CanvasElement[]) => void;
  deleteElements: (ids: readonly string[]) => void;
  /** Deletes the selection and clears it. Returns how many were deleted. */
  deleteSelected: () => number;
  setSelection: (ids: readonly string[]) => void;
  clearSelection: () => void;
  /** Switching away from the selection tool clears the selection. */
  setActiveTool: (tool: ToolId) => void;
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);

export const initialWorkspaceState: WorkspaceState = {
  elements: [],
  selectedIds: [],
  activeTool: "selection",
};

export const createWorkspaceStore = () =>
  create<WorkspaceStore>()((set, get) => ({
    ...initialWorkspaceState,

    addElement: (element) => set((state) => ({ elements: [...state.elements, element] })),

    updateElements: (updated) => {
      if (updated.length === 0) return;
      const byId = new Map(updated.map((element) => [element.id, element]));
      set((state) => ({ elements: state.elements.map((element) => byId.get(element.id) ?? element) }));
    },

    deleteElements: (ids) => {
      if (ids.length === 0) return;
      const doomed = new Set(ids);
      set((state) => ({
        elements: state.elements.filter((element) => !doomed.has(element.id)),
        selectedIds: state.selectedIds.filter((id) => !doomed.has(id)),
      }));
    },

    deleteSelected: () => {
      const { selectedIds, deleteElements } = get();
      const count = selectedIds.length;
      deleteElements(selectedIds);
      set({ selectedIds: [] });
      return count;
    },

    setSelection: (ids) => {
      // Keep only ids that exist, and skip the update when nothing changed.
      const existing = new Set(get().elements.map((element) => element.id));
      const next = ids.filter((id, index) => existing.has(id) && ids.indexOf(id) === index);
      if (!sameIds(next, get().selectedIds)) set({ selectedIds: next });
    },

    clearSelection: () => {
      if (get().selectedIds.length > 0) set({ selectedIds: [] });
    },

    setActiveTool: (tool) =>
      set((state) => ({
        activeTool: tool,
        selectedIds: tool === "selection" ? state.selectedIds : [],
      })),
  }));

/** The app's workspace store. Tests can build isolated ones with createWorkspaceStore(). */
export const useWorkspaceStore = createWorkspaceStore();
