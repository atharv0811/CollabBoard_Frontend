import type { Point } from "./elements";

export type ScreenToWorld = (clientX: number, clientY: number) => Point | null;

export function createScreenToWorld(svg: SVGSVGElement): ScreenToWorld | null {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;

  const inverse = matrix.inverse();

  return (clientX, clientY) => {
    const { x, y } = new DOMPoint(clientX, clientY).matrixTransform(inverse);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  };
}
