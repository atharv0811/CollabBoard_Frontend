import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Kbd } from "./Kbd";

type TooltipSide = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  label: string;
  shortcut?: string;
  side?: TooltipSide;
  children: ReactNode;
  className?: string;
}

const sideClass: Record<TooltipSide, string> = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  left: "right-full top-1/2 mr-2 -translate-y-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
};

/**
 * CSS-only tooltip: appears on hover, or when the wrapped element has
 * keyboard focus (:focus-visible). Mouse clicks don't keep it open.
 * No JavaScript positioning — swap for a floating-ui tooltip later if needed.
 */
export function Tooltip({ label, shortcut, side = "bottom", children, className }: TooltipProps) {
  return (
    <span className={cn("group/tooltip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-(--z-tooltip) flex items-center gap-2 rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium whitespace-nowrap text-popover-foreground opacity-0 shadow-popover transition-opacity duration-150",
          // Hover, or keyboard focus only (:focus-visible) — a mouse click focuses
          // the button but must not keep the tooltip open after the pointer leaves.
          "group-hover/tooltip:opacity-100 group-has-[:focus-visible]/tooltip:opacity-100",
          sideClass[side],
        )}
      >
        {label}
        {shortcut && <Kbd className="h-4 min-w-4 px-1 text-[0.625rem]">{shortcut}</Kbd>}
      </span>
    </span>
  );
}
