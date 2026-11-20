import { create } from "zustand";
import { resolveBindings } from "../canvas/bindings.ts";
import type { CanvasElement, Point } from "../canvas/elements.ts";
import { elementBounds, unionBounds } from "../canvas/hitTest.ts";
import {
  canvasCenter,
  DEFAULT_VIEWPORT,
  fitBounds,
  panBy,
  ZOOM_STEP,
  zoomAt,
  type Size,
  type Viewport,
} from "../canvas/viewport.ts";
import type { ToolId } from "../data/tools.ts";
import { deepEqual, emptyHistory, recordEdit, redoStep, undoStep, type History } from "./history.ts";

export interface LoadedDocument {
  elements: CanvasElement[];
  viewport: Viewport;
}

export interface WorkspaceState {
  boardId: string | null;
  elements: CanvasElement[];
  history: History<CanvasElement[]>;
  selectedIds: string[];
  activeTool: ToolId;
  viewport: Viewport;
  canvasSize: Size;
}

export interface WorkspaceActions {
  loadDocument: (boardId: string, document: LoadedDocument) => void;
  addElement: (element: CanvasElement) => void;
  finishDrawing: (element: CanvasElement) => void;
  updateElements: (updated: readonly CanvasElement[]) => void;
  deleteElements: (ids: readonly string[]) => void;
  deleteSelected: () => number;
  undo: () => boolean;
  redo: () => boolean;
  setSelection: (ids: readonly string[]) => void;
  clearSelection: () => void;
  setActiveTool: (tool: ToolId) => void;

  setCanvasSize: (size: Size) => void;
  setViewport: (viewport: Viewport) => void;
  panViewport: (dx: number, dy: number) => void;
  zoomTo: (zoom: number, anchor?: Point) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fitContent: () => void;
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);

const sameViewport = (a: Viewport, b: Viewport) => a.x === b.x && a.y === b.y && a.zoom === b.zoom;

const KEEPS_SELECTION: ReadonlySet<ToolId> = new Set<ToolId>(["selection", "hand"]);

const pruneSelection = (selectedIds: string[], elements: readonly CanvasElement[]) => {
  const existing = new Set(elements.map((element) => element.id));
  const kept = selectedIds.filter((id) => existing.has(id));
  return kept.length === selectedIds.length ? selectedIds : kept;
};

export const initialWorkspaceState: WorkspaceState = {
  boardId: null,
  elements: [],
  history: emptyHistory(),
  selectedIds: [],
  activeTool: "selection",
  viewport: DEFAULT_VIEWPORT,
  canvasSize: { width: 0, height: 0 },
};

export const createWorkspaceStore = () =>
  create<WorkspaceStore>()((set, get) => {
    const commit = (edited: CanvasElement[]) => {
      // Connectors attached to shapes that moved, resized or were deleted follow along in the same step.
      const next = resolveBindings(edited);
      const { elements, history, selectedIds } = get();
      if (next === elements) return;
      set({
        elements: next,
        history: recordEdit(history, elements),
        selectedIds: pruneSelection(selectedIds, next),
      });
    };

    const travel = (step: { history: History<CanvasElement[]>; value: CanvasElement[] } | null) => {
      if (!step) return false;
      set((state) => ({
        elements: step.value,
        history: step.history,
        selectedIds: pruneSelection(state.selectedIds, step.value),
      }));
      return true;
    };

    return {
      ...initialWorkspaceState,

      loadDocument: (boardId, document) =>
        set({
          boardId,
          elements: document.elements,
          viewport: document.viewport,
          history: emptyHistory(),
          selectedIds: [],
        }),

      addElement: (element) => commit([...get().elements, element]),

      // After a shape is drawn, go back to the Select tool.
      finishDrawing: (element) => {
        get().addElement(element);
        set({ activeTool: "selection" });
      },

      updateElements: (updated) => {
        const byId = new Map(updated.map((element) => [element.id, element]));
        let changed = false;
        const next = get().elements.map((element) => {
          const replacement = byId.get(element.id);
          if (!replacement || deepEqual(replacement, element)) return element;
          changed = true;
          return replacement;
        });
        if (changed) commit(next);
      },

      deleteElements: (ids) => {
        const doomed = new Set(ids);
        const next = get().elements.filter((element) => !doomed.has(element.id));
        if (next.length !== get().elements.length) commit(next);
      },

      undo: () => travel(undoStep(get().history, get().elements)),
      redo: () => travel(redoStep(get().history, get().elements)),

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
          selectedIds: KEEPS_SELECTION.has(tool) ? state.selectedIds : [],
        })),

      setCanvasSize: (size) => {
        const current = get().canvasSize;
        if (current.width !== size.width || current.height !== size.height) set({ canvasSize: size });
      },

      setViewport: (viewport) => {
        if (!sameViewport(viewport, get().viewport)) set({ viewport });
      },

      panViewport: (dx, dy) => get().setViewport(panBy(get().viewport, dx, dy)),

      zoomTo: (zoom, anchor) => {
        const { viewport, canvasSize, setViewport } = get();
        setViewport(zoomAt(viewport, zoom, anchor ?? canvasCenter(canvasSize)));
      },

      zoomIn: () => get().zoomTo(get().viewport.zoom * ZOOM_STEP),
      zoomOut: () => get().zoomTo(get().viewport.zoom / ZOOM_STEP),
      resetZoom: () => get().zoomTo(1),

      fitContent: () => {
        const { elements, canvasSize, setViewport } = get();
        setViewport(fitBounds(unionBounds(elements.map(elementBounds)), canvasSize));
      },
    };
  });

export const useWorkspaceStore = createWorkspaceStore();
