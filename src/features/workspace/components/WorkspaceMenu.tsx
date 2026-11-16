import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { IconButton } from "@/components/common/IconButton";
import { cn } from "@/lib/utils";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

interface WorkspaceMenuProps {
  defaultOpen?: boolean;
  className?: string;
}

export function WorkspaceMenu({ defaultOpen = false, className }: WorkspaceMenuProps) {
  const [open, setOpen] = useState(defaultOpen);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("flex flex-col items-start gap-2", className)}>
      <IconButton
        ref={buttonRef}
        icon={open ? X : Menu}
        label={open ? "Close board menu" : "Open board menu"}
        variant="floating"
        size="lg"
        aria-expanded={open}
        aria-controls="workspace-menu"
        onClick={() => setOpen((value) => !value)}
        className="size-11 aria-expanded:border-selected-border aria-expanded:bg-selected aria-expanded:text-selected-foreground"
      />

      {open && (
        <WorkspaceSidebar className="max-h-[calc(100svh-5.5rem)] animate-in duration-150 fade-in-0 slide-in-from-top-1" />
      )}
    </div>
  );
}
