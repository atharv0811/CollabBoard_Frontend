import { Logo } from "@/components/common/Logo";
import { cn } from "@/lib/utils";
import {
  mainActions,
  PREVIEW_ACTIVE_MENU_ITEM,
  workspaceLinks,
} from "../data/menuItems";
import { SidebarFooter } from "./SidebarFooter";
import { SidebarSection } from "./SidebarSection";

interface WorkspaceSidebarProps {
  className?: string;
}

export function WorkspaceSidebar({ className }: WorkspaceSidebarProps) {
  return (
    <nav
      id="workspace-menu"
      aria-label="Board menu"
      className={cn(
        "surface-floating flex w-(--sidebar-width) max-w-[calc(100vw-2rem)] flex-col overflow-hidden shadow-popover",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <Logo size="sm" />
        <span className="truncate text-xs text-muted-foreground">
          Untitled board
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto py-1.5 scrollbar-thin">
        <SidebarSection items={mainActions} />
        <div className="mx-4 h-px bg-border" />
        <SidebarSection
          title="Workspace"
          items={workspaceLinks}
          activeId={PREVIEW_ACTIVE_MENU_ITEM}
        />
      </div>

      <div className="border-t border-border py-2">
        <SidebarFooter />
      </div>
    </nav>
  );
}
