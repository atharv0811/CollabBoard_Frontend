import { Check, CloudOff, LoaderCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSaveStatusStore } from "../store/saveStatusStore";

export type SaveStatus = "saved" | "pending" | "saving" | "error" | "temporary";

interface SaveStatusIndicatorProps {
  className?: string;
  floating?: boolean;
  status?: SaveStatus;
}

const APPEARANCE: Record<SaveStatus, { label: string; icon: LucideIcon; tone: string; spin?: boolean }> = {
  saved: { label: "Saved", icon: Check, tone: "text-muted-foreground" },
  pending: { label: "Saving…", icon: LoaderCircle, tone: "text-muted-foreground", spin: true },
  saving: { label: "Saving…", icon: LoaderCircle, tone: "text-muted-foreground", spin: true },
  error: { label: "Save failed", icon: TriangleAlert, tone: "text-destructive" },
  temporary: { label: "Not saved", icon: CloudOff, tone: "text-destructive" },
};

export function SaveStatusIndicator({ className, floating = false, status }: SaveStatusIndicatorProps) {
  const storedStatus = useSaveStatusStore((state) => state.status);
  const { label, icon: Icon, tone, spin } = APPEARANCE[status ?? storedStatus];

  return (
    <span
      role="status"
      aria-live="polite"
      data-save-status={status}
      className={cn(
        "pointer-events-auto flex items-center gap-1.5 text-xs whitespace-nowrap",
        floating && "h-9 surface-floating px-3",
        tone,
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn("size-3.5 shrink-0", spin && "animate-spin")} strokeWidth={2} />
      <span>{label}</span>
    </span>
  );
}
