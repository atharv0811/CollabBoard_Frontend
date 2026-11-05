import { MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils";

interface CanvasHintProps {
  className?: string;
}

/** Subtle onboarding hint shown beneath the toolbar on an empty board. */
export function CanvasHint({ className }: CanvasHintProps) {
  return (
    <p className={cn("flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground", className)}>
      <MousePointerClick aria-hidden="true" className="size-3.5 shrink-0 text-brand dark:text-brand-soft" />
      Select a tool and start creating your ideas
    </p>
  );
}
