import { Logo } from "@/components/common/Logo";
import { cn } from "@/lib/utils";
import { useBoardsStore } from "@/features/boards/boardsStore";
import { BoardsSection } from "@/features/boards/components/BoardsSection";
import { mainActions } from "../data/menuItems";
import { SidebarFooter } from "./SidebarFooter";
import { SidebarSection } from "./SidebarSection";

interface WorkspaceSidebarProps {
  className?: string;
}

export function WorkspaceSidebar({ className }: WorkspaceSidebarProps) {
  const boardName = useBoardsStore(
    (state) => state.boards.find((board) => board.id === state.activeBoardId)?.name ?? "",
  );
  const openDialog = useBoardsStore((state) => state.openDialog);

  const onAction = (id: string) => {
    if (id === "new") openDialog({ kind: "create" });
  };

  return (
    <nav
      id="workspace-menu"
      aria-label="Board menu"
      className={cn(
        "flex w-(--sidebar-width) max-w-[calc(100vw-2rem)] flex-col overflow-hidden surface-floating shadow-popover",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <Logo size="sm" />
        <span data-active-board-name="" title={boardName} className="truncate text-xs text-muted-foreground">
          {boardName}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 scrollbar-thin flex-col gap-2 overflow-y-auto py-1.5">
        <SidebarSection items={mainActions} onItemClick={onAction} />
        <div className="mx-4 h-px bg-border" />
        <BoardsSection />
      </div>

      <div className="border-t border-border py-2">
        <SidebarFooter />
      </div>
    </nav>
  );
}
