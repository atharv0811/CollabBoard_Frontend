import { create } from "zustand";
import type { CanvasElement } from "../canvas/elements.ts";
import type { ToolId } from "../data/tools.ts";

export interface WorkspaceState {
  elements: CanvasElement[];
  selectedIds: string[];
  activeTool: ToolId;
}

export interface WorkspaceActions {
  addElement: (element: CanvasElement) => void;
  updateElements: (updated: readonly CanvasElement[]) => void;
  deleteElements: (ids: readonly string[]) => void;
  deleteSelected: () => number;
  setSelection: (ids: readonly string[]) => void;
  clearSelection: () => void;
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

export const useWorkspaceStore = createWorkspaceStore();
