import { Check, CloudOff, LoaderCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { boardSession } from "../boardSession";
import { useBoardsStore, type SaveStatus } from "../boardsStore";

interface SaveStatusIndicatorProps {
  className?: string;
  floating?: boolean;
}

const APPEARANCE: Record<SaveStatus, { label: string; icon: LucideIcon; tone: string; spin?: boolean }> = {
  saved: { label: "Saved", icon: Check, tone: "text-muted-foreground" },
  pending: { label: "Saving…", icon: LoaderCircle, tone: "text-muted-foreground", spin: true },
  saving: { label: "Saving…", icon: LoaderCircle, tone: "text-muted-foreground", spin: true },
  error: { label: "Save failed", icon: TriangleAlert, tone: "text-destructive" },
  temporary: { label: "Not saved", icon: CloudOff, tone: "text-destructive" },
};

export function SaveStatusIndicator({ className, floating = false }: SaveStatusIndicatorProps) {
  const status = useBoardsStore((state) => state.saveStatus);
  const error = useBoardsStore((state) => state.saveError);
  const { label, icon: Icon, tone, spin } = APPEARANCE[status];
  const title =
    status === "error"
      ? `Your latest changes aren't saved yet. ${error ?? ""}`.trim()
      : status === "temporary"
        ? "Storage is unavailable. Changes on this board will be lost when the page closes."
        : undefined;

  return (
    <span
      role="status"
      aria-live="polite"
      data-save-status={status}
      title={title}
      className={cn(
        "pointer-events-auto flex items-center gap-1.5 text-xs whitespace-nowrap",
        floating && "surface-floating h-9 px-3",
        tone,
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn("size-3.5 shrink-0", spin && "animate-spin")} strokeWidth={2} />
      <span>{label}</span>
      {status === "error" && (
        <button
          type="button"
          onClick={() => void boardSession.retrySave()}
          className="ml-0.5 rounded-md px-1.5 py-0.5 font-medium text-destructive underline-offset-2 transition-colors hover:bg-destructive/10 hover:underline"
        >
          Retry
        </button>
      )}
    </span>
  );
}
