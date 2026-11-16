import { Redo2, Undo2 } from "lucide-react";
import { IconButton } from "@/components/common/IconButton";
import { Tooltip } from "@/components/common/Tooltip";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "../store/workspaceStore";

interface HistoryControlsProps {
  className?: string;
  tooltipSide?: "top" | "bottom";
}

const isApple = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const UNDO_SHORTCUT = isApple ? "⌘Z" : "Ctrl+Z";
const REDO_SHORTCUT = isApple ? "⇧⌘Z" : "Ctrl+Y";

export function HistoryControls({ className, tooltipSide = "top" }: HistoryControlsProps) {
  const undoDepth = useWorkspaceStore((state) => state.history.past.length);
  const redoDepth = useWorkspaceStore((state) => state.history.future.length);
  const undo = useWorkspaceStore((state) => state.undo);
  const redo = useWorkspaceStore((state) => state.redo);

  return (
    <div
      role="toolbar"
      aria-label="History"
      data-undo-depth={undoDepth}
      data-redo-depth={redoDepth}
      className={cn("pointer-events-auto flex h-9 items-center gap-0.5 surface-floating px-0.5", className)}
    >
      <Tooltip label="Undo" shortcut={UNDO_SHORTCUT} side={tooltipSide}>
        <IconButton icon={Undo2} label="Undo" size="sm" onClick={undo} disabled={undoDepth === 0} />
      </Tooltip>
      <Tooltip label="Redo" shortcut={REDO_SHORTCUT} side={tooltipSide}>
        <IconButton icon={Redo2} label="Redo" size="sm" onClick={redo} disabled={redoDepth === 0} />
      </Tooltip>
    </div>
  );
}
