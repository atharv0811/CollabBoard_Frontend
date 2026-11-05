import { cn } from "@/lib/utils";

interface CanvasSurfaceProps {
  className?: string;
}

/**
 * Full-bleed, empty drawing surface with a CSS dot grid.
 * Mount your <canvas> / <svg> renderer inside this element later.
 * Grid density is controlled by --grid-size / --grid-dot-size in tokens.css.
 */
export function CanvasSurface({ className }: CanvasSurfaceProps) {
  return (
    <main
      aria-label="Whiteboard canvas"
      className={cn("absolute inset-0 z-(--z-canvas) bg-dot-grid", className)}
    />
  );
}
