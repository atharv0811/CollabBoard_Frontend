import { DEFAULT_STYLE, type CanvasElement, type DrawingToolId, type ElementStyle, type Point } from "./elements.ts";
import { boundsFromPoints, boundsOfPoints, distance, ellipseFromBounds, shouldAppendPoint } from "./geometry.ts";

/*
 * An in-progress drawing ("draft") and the rules for turning it into an
 * element. Shared by every tool; only `elementFromDraft` is tool-specific.
 */

export interface DrawingDraft {
  tool: DrawingToolId;
  start: Point;
  /** Latest pointer position */
  current: Point;
  /** Recorded samples — only grows for the freehand tool */
  points: Point[];
}

/** Shapes smaller than this (either side) are treated as accidental taps. */
export const MIN_SHAPE_SIZE = 2;
/** Lines, arrows and freehand strokes shorter than this are discarded. */
export const MIN_STROKE_LENGTH = 2;
/** Freehand samples closer than this to the previous one are skipped. */
export const FREEHAND_MIN_POINT_DISTANCE = 1.5;

export function startDraft(tool: DrawingToolId, point: Point): DrawingDraft {
  return { tool, start: point, current: point, points: [point] };
}

/**
 * Applies new pointer samples (e.g. coalesced events) to a draft.
 * Returns the *same* object when nothing changed, so callers can skip a render.
 */
export function updateDraft(draft: DrawingDraft, samples: readonly Point[]): DrawingDraft {
  const latest = samples[samples.length - 1];
  if (!latest) return draft;

  if (draft.tool !== "freehand") {
    if (latest.x === draft.current.x && latest.y === draft.current.y) return draft;
    return { ...draft, current: latest };
  }

  // Copy the array only once, and only if at least one sample is kept.
  let next: Point[] | null = null;
  for (const sample of samples) {
    if (shouldAppendPoint(next ?? draft.points, sample, FREEHAND_MIN_POINT_DISTANCE)) {
      next ??= [...draft.points];
      next.push(sample);
    }
  }
  return next ? { ...draft, current: latest, points: next } : draft;
}

/**
 * Builds the element a draft describes, or `null` when it is too small to keep.
 * Used both for the live preview and for the final commit.
 */
export function elementFromDraft(
  draft: DrawingDraft,
  id: string,
  style: ElementStyle = DEFAULT_STYLE,
): CanvasElement | null {
  const { tool, start, current } = draft;

  switch (tool) {
    case "rectangle":
    case "diamond": {
      const bounds = boundsFromPoints(start, current);
      if (bounds.width < MIN_SHAPE_SIZE || bounds.height < MIN_SHAPE_SIZE) return null;
      return { id, type: tool, style, ...bounds };
    }
    case "ellipse": {
      const bounds = boundsFromPoints(start, current);
      if (bounds.width < MIN_SHAPE_SIZE || bounds.height < MIN_SHAPE_SIZE) return null;
      return { id, type: "ellipse", style, ...ellipseFromBounds(bounds) };
    }
    case "line":
    case "arrow": {
      if (distance(start, current) < MIN_STROKE_LENGTH) return null;
      return { id, type: tool, style, start, end: current };
    }
    case "freehand": {
      const { width, height } = boundsOfPoints(draft.points);
      if (draft.points.length < 2 || Math.max(width, height) < MIN_STROKE_LENGTH) return null;
      return { id, type: "freehand", style, points: draft.points };
    }
  }
}
