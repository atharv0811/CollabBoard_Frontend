import { Trash } from "lucide-react";
import { Divider } from "@/components/common/Divider";
import { Kbd } from "@/components/common/Kbd";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "../store/workspaceStore";
import { CanvasHint } from "./CanvasHint";

interface CanvasContextBarProps {
  className?: string;
}

export function CanvasContextBar({ className }: CanvasContextBarProps) {
  const count = useWorkspaceStore((state) => state.selectedIds.length);
  const deleteSelected = useWorkspaceStore((state) => state.deleteSelected);

  if (count === 0) return <CanvasHint className={className} />;

  return (
    <div
      role="toolbar"
      aria-label="Selection actions"
      className={cn(
        "surface-floating flex h-9 items-center gap-1 pr-1 pl-3 text-xs",
        className,
      )}
    >
      <span className="text-muted-foreground" aria-live="polite">
        {count} selected
      </span>
      <Divider orientation="vertical" className="h-4" />
      <button
        type="button"
        onClick={deleteSelected}
        aria-label={`Delete ${count} selected`}
        className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 font-medium text-destructive transition-colors duration-150 hover:bg-destructive/10"
      >
        <Trash aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
        Delete
        <Kbd className="hidden h-4 min-w-4 px-1 text-[0.625rem] sm:inline-flex">
          Del
        </Kbd>
      </button>
    </div>
  );
}
