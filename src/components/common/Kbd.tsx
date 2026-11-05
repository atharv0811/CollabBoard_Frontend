import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface KbdProps {
  children: ReactNode;
  className?: string;
}

/** Keyboard shortcut chip, e.g. <Kbd>Ctrl+O</Kbd> */
export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-border bg-secondary px-1.5 font-sans text-[0.6875rem] leading-none font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
