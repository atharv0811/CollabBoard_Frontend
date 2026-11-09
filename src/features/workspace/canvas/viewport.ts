import type { Point } from "./elements.ts";
import type { Bounds } from "./geometry.ts";

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface Size {
  width: number;
  height: number;
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;
export const ZOOM_STEP = 1.2;
export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function canvasToWorld(viewport: Viewport, point: Point): Point {
  return { x: point.x / viewport.zoom + viewport.x, y: point.y / viewport.zoom + viewport.y };
}

export function worldToCanvas(viewport: Viewport, point: Point): Point {
  return { x: (point.x - viewport.x) * viewport.zoom, y: (point.y - viewport.y) * viewport.zoom };
}

export function panBy(viewport: Viewport, dx: number, dy: number): Viewport {
  return { ...viewport, x: viewport.x - dx / viewport.zoom, y: viewport.y - dy / viewport.zoom };
}

export function zoomAt(viewport: Viewport, nextZoom: number, anchor: Point): Viewport {
  const zoom = clampZoom(nextZoom);
  const world = canvasToWorld(viewport, anchor);
  return { zoom, x: world.x - anchor.x / zoom, y: world.y - anchor.y / zoom };
}

export const canvasCenter = (size: Size): Point => ({ x: size.width / 2, y: size.height / 2 });

export function viewBoxFor(viewport: Viewport, size: Size): Bounds {
  return { x: viewport.x, y: viewport.y, width: size.width / viewport.zoom, height: size.height / viewport.zoom };
}

export const FIT_PADDING = 64;
export const MAX_FIT_ZOOM = 1;

export function fitBounds(bounds: Bounds | null, size: Size, padding = FIT_PADDING, maxZoom = MAX_FIT_ZOOM): Viewport {
  if (!bounds || size.width <= 0 || size.height <= 0) return DEFAULT_VIEWPORT;

  const availableWidth = Math.max(1, size.width - padding * 2);
  const availableHeight = Math.max(1, size.height - padding * 2);
  const fitX = bounds.width > 0 ? availableWidth / bounds.width : Infinity;
  const fitY = bounds.height > 0 ? availableHeight / bounds.height : Infinity;
  const zoom = clampZoom(Math.min(fitX, fitY, maxZoom));

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  return { zoom, x: centerX - size.width / 2 / zoom, y: centerY - size.height / 2 / zoom };
}

export interface PinchStart {
  viewport: Viewport;
  midpoint: Point;
  distance: number;
}

export function pinchViewport(start: PinchStart, midpoint: Point, distance: number): Viewport {
  const zoom = clampZoom(start.viewport.zoom * (start.distance > 0 ? distance / start.distance : 1));
  const anchorWorld = canvasToWorld(start.viewport, start.midpoint);
  return { zoom, x: anchorWorld.x - midpoint.x / zoom, y: anchorWorld.y - midpoint.y / zoom };
}

export interface WheelInput {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export type WheelIntent = { kind: "zoom"; factor: number } | { kind: "pan"; dx: number; dy: number };

const LINE_HEIGHT = 16;
const PAGE_HEIGHT = 800;
const MAX_WHEEL_FACTOR = 1.5;

export function wheelIntent(input: WheelInput): WheelIntent {
  const scale = input.deltaMode === 1 ? LINE_HEIGHT : input.deltaMode === 2 ? PAGE_HEIGHT : 1;
  const dx = input.deltaX * scale;
  const dy = input.deltaY * scale;

  const pinchOrModifier = input.ctrlKey || input.metaKey;
  const mouseWheel =
    !input.shiftKey &&
    (input.deltaMode !== 0 || (input.deltaX === 0 && Number.isInteger(input.deltaY) && Math.abs(input.deltaY) >= 50));

  if (pinchOrModifier || mouseWheel) {
    const sensitivity = pinchOrModifier && !mouseWheel ? 0.01 : 0.0015;
    const factor = Math.exp(-dy * sensitivity);
    return { kind: "zoom", factor: Math.min(MAX_WHEEL_FACTOR, Math.max(1 / MAX_WHEEL_FACTOR, factor)) };
  }

  if (input.shiftKey && dx === 0) return { kind: "pan", dx: -dy, dy: 0 };
  return { kind: "pan", dx: -dx, dy: -dy };
}

const BASE_GRID = 22;
const MIN_GRID_PX = 11;
const MAX_GRID_PX = 44;

export function gridFor(viewport: Viewport, base = BASE_GRID): { size: number; offsetX: number; offsetY: number } {
  let step = base;
  while (step * viewport.zoom < MIN_GRID_PX) step *= 2;
  while (step * viewport.zoom > MAX_GRID_PX) step /= 2;

  const size = step * viewport.zoom;
  const mod = (value: number) => ((value % size) + size) % size;
  return { size, offsetX: mod(-viewport.x * viewport.zoom - size / 2), offsetY: mod(-viewport.y * viewport.zoom - size / 2) };
}
