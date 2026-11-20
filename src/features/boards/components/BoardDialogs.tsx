import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Input } from "@/components/common/Input";
import { Button } from "@/components/ui/button";
import { useCreateBoardMutation } from "../hooks/mutations/useCreateBoardMutation";
import { useDeleteBoardMutation } from "../hooks/mutations/useDeleteBoardMutation";
import { useRenameBoardMutation } from "../hooks/mutations/useRenameBoardMutation";
import { useBoardsStore } from "../store/boardsStore";
import { checkBoardName, MAX_BOARD_NAME_LENGTH, nextDefaultName } from "../lib/model";

interface ModalProps {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

function Modal({ title, description, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-panel border border-border bg-popover p-0 text-popover-foreground shadow-popover backdrop:bg-black/45"
    >
      <div className="p-5">
        <h2 id={titleId} className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}

function BoardNameDialog({ mode, boardId }: { mode: "create" | "rename"; boardId?: string }) {
  const boards = useBoardsStore((state) => state.boards);
  const closeDialog = useBoardsStore((state) => state.closeDialog);
  const current = boards.find((board) => board.id === boardId);
  const [name, setName] = useState(() => (mode === "rename" ? (current?.name ?? "") : nextDefaultName(boards)));
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

  const createBoard = useCreateBoardMutation();
  const renameBoard = useRenameBoardMutation();
  const saving = createBoard.isPending || renameBoard.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;

    const check = checkBoardName(name, boards, mode === "rename" ? boardId : undefined);
    if (!check.ok) {
      setError(check.reason);
      return;
    }

    const callbacks = { onSuccess: () => closeDialog() };

    if (mode === "rename") {
      if (check.name === current?.name) {
        closeDialog();
        return;
      }
      renameBoard.mutate({ boardId: boardId ?? "", name: check.name }, callbacks);
    } else {
      createBoard.mutate(check.name, callbacks);
    }
  };

  const submitLabel = mode === "create" ? (saving ? "Creating…" : "Create board") : saving ? "Renaming…" : "Rename";

  return (
    <Modal
      title={mode === "create" ? "New board" : "Rename board"}
      description={mode === "create" ? "It opens right away, with an empty canvas." : undefined}
      onClose={closeDialog}
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="text-sm font-medium text-foreground">
            Board name
          </label>
          <Input
            id={inputId}
            name="board-name"
            value={name}
            maxLength={MAX_BOARD_NAME_LENGTH + 20}
            autoFocus
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            onFocus={(event) => event.target.select()}
          />
          {error && (
            <p id={errorId} role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={closeDialog}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteBoardDialog({ boardId }: { boardId: string }) {
  const boards = useBoardsStore((state) => state.boards);
  const activeBoardId = useBoardsStore((state) => state.activeBoardId);
  const closeDialog = useBoardsStore((state) => state.closeDialog);
  const deleteBoard = useDeleteBoardMutation();

  const name = boards.find((board) => board.id === boardId)?.name ?? "this board";
  const isActive = boardId === activeBoardId;
  const isLast = isActive && boards.length === 1;

  const confirm = () => {
    if (deleteBoard.isPending) return;
    deleteBoard.mutate(boardId, { onSuccess: () => closeDialog() });
  };

  return (
    <Modal
      title={`Delete “${name}”?`}
      description={
        <>
          This permanently removes the board and its drawing. It can't be undone.
          {isLast ? " A new empty board will be created." : isActive ? " You'll be moved to another board." : ""}
        </>
      }
      onClose={closeDialog}
    >
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={closeDialog} autoFocus>
          Cancel
        </Button>
        <Button type="button" variant="destructive" onClick={confirm} disabled={deleteBoard.isPending}>
          {deleteBoard.isPending ? "Deleting…" : "Delete board"}
        </Button>
      </div>
    </Modal>
  );
}

export function BoardDialogs() {
  const dialog = useBoardsStore((state) => state.dialog);
  if (!dialog) return null;
  if (dialog.kind === "delete") return <DeleteBoardDialog key={`delete-${dialog.boardId}`} boardId={dialog.boardId} />;
  if (dialog.kind === "rename")
    return <BoardNameDialog key={`rename-${dialog.boardId}`} mode="rename" boardId={dialog.boardId} />;
  return <BoardNameDialog key="create" mode="create" />;
}
