import { DEFAULT_STYLE, type CanvasElement, type DrawingToolId, type ElementStyle, type Point } from "./elements.ts";
import { boundsFromPoints, boundsOfPoints, distance, ellipseFromBounds, shouldAppendPoint } from "./geometry.ts";

export interface DrawingDraft {
  tool: DrawingToolId;
  start: Point;
  current: Point;
  points: Point[];
}

export const MIN_SHAPE_SIZE = 2;
export const MIN_STROKE_LENGTH = 2;
export const FREEHAND_MIN_POINT_DISTANCE = 1.5;

export function startDraft(tool: DrawingToolId, point: Point): DrawingDraft {
  return { tool, start: point, current: point, points: [point] };
}

export function updateDraft(draft: DrawingDraft, samples: readonly Point[]): DrawingDraft {
  const latest = samples[samples.length - 1];
  if (!latest) return draft;

  if (draft.tool !== "freehand") {
    if (latest.x === draft.current.x && latest.y === draft.current.y) return draft;
    return { ...draft, current: latest };
  }

  let next: Point[] | null = null;
  for (const sample of samples) {
    if (shouldAppendPoint(next ?? draft.points, sample, FREEHAND_MIN_POINT_DISTANCE)) {
      next ??= [...draft.points];
      next.push(sample);
    }
  }
  return next ? { ...draft, current: latest, points: next } : draft;
}

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
