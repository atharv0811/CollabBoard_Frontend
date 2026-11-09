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

export interface WorkspaceState {
  elements: CanvasElement[];
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

export const initialWorkspaceState: WorkspaceState = {
  elements: [],
  selectedIds: [],
  activeTool: "selection",
  viewport: DEFAULT_VIEWPORT,
  canvasSize: { width: 0, height: 0 },
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
  }));

export const useWorkspaceStore = createWorkspaceStore();
