import { cn } from "@/lib/utils";

interface DividerProps {
  orientation?: "horizontal" | "vertical";
  /** Optional centered label, e.g. "or" (horizontal only) */
  label?: string;
  className?: string;
}

export function Divider({ orientation = "horizontal", label, className }: DividerProps) {
  if (orientation === "vertical") {
    return (
      <span
        role="separator"
        aria-orientation="vertical"
        className={cn("mx-1 h-5 w-px shrink-0 bg-border", className)}
      />
    );
  }

  if (label) {
    return (
      <div role="separator" className={cn("flex items-center gap-3", className)}>
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    );
  }

  return <hr className={cn("h-px w-full border-0 bg-border", className)} />;
}
