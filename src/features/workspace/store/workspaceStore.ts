import { create } from "zustand";
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

export interface WorkspaceState {
  /** The document. Only addElement / updateElements / deleteElements / undo / redo change it. */
  elements: CanvasElement[];
  /**
   * Undo / redo of the document only. Selection, tool, viewport and canvas
   * size are separate fields, so they can never be recorded.
   */
  history: History<CanvasElement[]>;
  selectedIds: string[];
  activeTool: ToolId;
  /**
   * What part of the world is visible. Navigation only ever changes this —
   * element geometry is never touched by pan or zoom.
   */
  viewport: Viewport;
  /** Measured canvas size in px (set by the canvas; needed for centre zoom and fit). */
  canvasSize: Size;
}

export interface WorkspaceActions {
  addElement: (element: CanvasElement) => void;
  updateElements: (updated: readonly CanvasElement[]) => void;
  deleteElements: (ids: readonly string[]) => void;
  deleteSelected: () => number;
  /** Restores the previous document. Returns false when there is nothing to undo. */
  undo: () => boolean;
  /** Re-applies the last undone change. Returns false when there is nothing to redo. */
  redo: () => boolean;
  setSelection: (ids: readonly string[]) => void;
  clearSelection: () => void;
  setActiveTool: (tool: ToolId) => void;

  setCanvasSize: (size: Size) => void;
  setViewport: (viewport: Viewport) => void;
  /** Pan by a canvas-px delta. */
  panViewport: (dx: number, dy: number) => void;
  /** Zoom to `zoom` (clamped), keeping `anchor` (canvas px; default: centre) fixed. */
  zoomTo: (zoom: number, anchor?: Point) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  /** Back to 100% around the canvas centre. */
  resetZoom: () => void;
  /** Show every element; on an empty board, return to the default view. */
  fitContent: () => void;
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);

const sameViewport = (a: Viewport, b: Viewport) => a.x === b.x && a.y === b.y && a.zoom === b.zoom;

/** Tools that keep the current selection when chosen (navigation doesn't edit). */
const KEEPS_SELECTION: ReadonlySet<ToolId> = new Set<ToolId>(["selection", "hand"]);

/** Selection without ids that no longer exist (e.g. after undoing a creation). */
const pruneSelection = (selectedIds: string[], elements: readonly CanvasElement[]) => {
  const existing = new Set(elements.map((element) => element.id));
  const kept = selectedIds.filter((id) => existing.has(id));
  return kept.length === selectedIds.length ? selectedIds : kept;
};

export const initialWorkspaceState: WorkspaceState = {
  elements: [],
  history: emptyHistory(),
  selectedIds: [],
  activeTool: "selection",
  viewport: DEFAULT_VIEWPORT,
  canvasSize: { width: 0, height: 0 },
};

export const createWorkspaceStore = () =>
  create<WorkspaceStore>()((set, get) => {
    /**
     * The single write path for document edits: one call = one undo step.
     * A no-op (same array back) records nothing; a real edit records the
     * previous array and discards the redo future.
     */
    const commit = (next: CanvasElement[]) => {
      const { elements, history, selectedIds } = get();
      if (next === elements) return;
      set({
        elements: next,
        history: recordEdit(history, elements),
        selectedIds: pruneSelection(selectedIds, next),
      });
    };

    /** Applies an undo / redo result, keeping the selection valid. */
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

      addElement: (element) => commit([...get().elements, element]),

      updateElements: (updated) => {
        const byId = new Map(updated.map((element) => [element.id, element]));
        let changed = false;
        const next = get().elements.map((element) => {
          const replacement = byId.get(element.id);
          // Unchanged geometry (e.g. dragged away and back) keeps the old object → no-op.
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
