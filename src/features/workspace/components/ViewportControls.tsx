import { Minus, Plus, RotateCcw, Scan, type LucideIcon } from "lucide-react";
import { Divider } from "@/components/common/Divider";
import { IconButton } from "@/components/common/IconButton";
import { Tooltip } from "@/components/common/Tooltip";
import { cn } from "@/lib/utils";
import { MAX_ZOOM, MIN_ZOOM } from "../canvas/viewport";
import { useWorkspaceStore } from "../store/workspaceStore";

interface ViewportControlsProps {
  className?: string;
  tooltipSide?: "top" | "bottom";
}

export function ViewportControls({ className, tooltipSide = "top" }: ViewportControlsProps) {
  const zoom = useWorkspaceStore((state) => state.viewport.zoom);
  const zoomIn = useWorkspaceStore((state) => state.zoomIn);
  const zoomOut = useWorkspaceStore((state) => state.zoomOut);
  const resetZoom = useWorkspaceStore((state) => state.resetZoom);
  const fitContent = useWorkspaceStore((state) => state.fitContent);
  const percent = Math.round(zoom * 100);

  const control = (icon: LucideIcon, label: string, onClick: () => void, disabled = false) => (
    <Tooltip label={label} side={tooltipSide}>
      <IconButton icon={icon} label={label} size="sm" onClick={onClick} disabled={disabled} />
    </Tooltip>
  );

  return (
    <div
      role="toolbar"
      aria-label="Zoom controls"
      className={cn("surface-floating pointer-events-auto flex h-9 items-center gap-0.5 px-0.5", className)}
    >
      {control(Minus, "Zoom out", zoomOut, zoom <= MIN_ZOOM)}
      <output
        aria-label="Zoom level"
        data-zoom-level={percent}
        className="min-w-11 text-center text-xs font-medium text-foreground tabular-nums"
      >
        {percent}%
      </output>
      {control(Plus, "Zoom in", zoomIn, zoom >= MAX_ZOOM)}
      <Divider orientation="vertical" className="mx-0.5 h-4" />
      {control(RotateCcw, "Reset zoom", resetZoom, zoom === 1)}
      {control(Scan, "Fit content", fitContent)}
    </div>
  );
}
