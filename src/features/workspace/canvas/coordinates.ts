import type { Point } from "./elements";

export type ScreenToWorld = (clientX: number, clientY: number) => Point | null;

/**
 * Returns a converter from client (screen) pixels to world coordinates,
 * based on the SVG's own screen transform — so it stays correct for any
 * viewBox, viewport size, scroll position or CSS transform.
 * The inverse matrix is computed once, so converting a batch of coalesced
 * pointer samples costs one matrix inversion.
 * Returns null when the transform is unavailable.
 */
export function createScreenToWorld(svg: SVGSVGElement): ScreenToWorld | null {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;

  const inverse = matrix.inverse();

  return (clientX, clientY) => {
    const { x, y } = new DOMPoint(clientX, clientY).matrixTransform(inverse);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  };
}
