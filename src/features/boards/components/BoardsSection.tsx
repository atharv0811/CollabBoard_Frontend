import { LayoutGrid, Pencil, Plus, Trash } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBoardsStore } from "../boardsStore";

const rowAction =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-subtle-foreground transition-colors duration-150 group-hover/row:text-muted-foreground hover:bg-accent hover:text-foreground";

export function BoardsSection() {
  const boards = useBoardsStore((state) => state.boards);
  const activeBoardId = useBoardsStore((state) => state.activeBoardId);
  const switchBoard = useBoardsStore((state) => state.switchBoard);
  const openDialog = useBoardsStore((state) => state.openDialog);

  return (
    <section aria-labelledby="sidebar-boards" className="px-1.5">
      <div className="flex items-center justify-between px-2.5 pt-0.5 pb-1">
        <h2
          id="sidebar-boards"
          className="text-[0.6875rem] font-semibold tracking-wide text-subtle-foreground uppercase"
        >
          Boards <span className="font-medium normal-case">· {boards.length}</span>
        </h2>
        <button
          type="button"
          aria-label="New board"
          onClick={() => openDialog({ kind: "create" })}
          className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Plus aria-hidden="true" className="size-3.5" strokeWidth={2} />
        </button>
      </div>

      <ul className="flex flex-col gap-px" aria-label="Your boards">
        {boards.map((board) => {
          const active = board.id === activeBoardId;
          return (
            <li
              key={board.id}
              data-board-id={board.id}
              className="group/row flex items-center gap-0.5 rounded-tool pr-1 hover:bg-accent/60"
            >
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => switchBoard(board.id)}
                className={cn(
                  "flex h-7.5 min-w-0 flex-1 items-center gap-2.5 rounded-tool px-2.5 text-left text-[0.8125rem] text-foreground/85 transition-colors duration-150",
                  "aria-[current=page]:bg-selected aria-[current=page]:font-medium aria-[current=page]:text-selected-foreground",
                )}
              >
                <LayoutGrid aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate" data-board-name="">
                  {board.name}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Rename ${board.name}`}
                onClick={() => openDialog({ kind: "rename", boardId: board.id })}
                className={rowAction}
              >
                <Pencil aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                aria-label={`Delete ${board.name}`}
                onClick={() => openDialog({ kind: "delete", boardId: board.id })}
                className={cn(rowAction, "hover:bg-destructive/10 hover:text-destructive")}
              >
                <Trash aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
