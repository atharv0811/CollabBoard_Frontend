import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Input } from "@/components/common/Input";
import { Button } from "@/components/ui/button";
import { boardSession } from "../boardSession";
import { useBoardsStore } from "../boardsStore";
import { MAX_BOARD_NAME_LENGTH, nextDefaultName } from "../model";

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
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const errorId = useId();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const result =
      mode === "create" ? await boardSession.createBoard(name) : await boardSession.renameBoard(boardId ?? "", name);
    setBusy(false);
    if (result.ok) closeDialog();
    else setError(result.reason);
  };

  return (
    <Modal
      title={mode === "create" ? "New board" : "Rename board"}
      description={mode === "create" ? "It opens right away, with an empty canvas." : undefined}
      onClose={closeDialog}
    >
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
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
          <Button type="submit" disabled={busy}>
            {mode === "create" ? "Create board" : "Rename"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteBoardDialog({ boardId }: { boardId: string }) {
  const boards = useBoardsStore((state) => state.boards);
  const unreadable = useBoardsStore((state) => state.unreadable);
  const activeBoardId = useBoardsStore((state) => state.activeBoardId);
  const closeDialog = useBoardsStore((state) => state.closeDialog);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const name =
    boards.find((board) => board.id === boardId)?.name ??
    unreadable.find((entry) => entry.id === boardId)?.name ??
    "this board";
  const isActive = boardId === activeBoardId;
  const isLast = isActive && boards.length === 1;

  const confirm = async () => {
    setBusy(true);
    const result = await boardSession.deleteBoard(boardId);
    setBusy(false);
    if (result.ok) closeDialog();
    else setError(result.reason);
  };

  return (
    <Modal
      title={`Delete “${name}”?`}
      description={
        <>
          This permanently removes the board and its drawing from this device. It can't be undone.
          {isLast ? " A new empty board will be created." : isActive ? " You'll be moved to another board." : ""}
        </>
      }
      onClose={closeDialog}
    >
      {error && (
        <p role="alert" className="mb-3 text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={closeDialog} autoFocus>
          Cancel
        </Button>
        <Button type="button" variant="destructive" disabled={busy} onClick={() => void confirm()}>
          Delete board
        </Button>
      </div>
    </Modal>
  );
}

export function BoardDialogs() {
  const dialog = useBoardsStore((state) => state.dialog);
  if (!dialog) return null;
  if (dialog.kind === "delete") return <DeleteBoardDialog key={`delete-${dialog.boardId}`} boardId={dialog.boardId} />;
  if (dialog.kind === "rename") return <BoardNameDialog key={`rename-${dialog.boardId}`} mode="rename" boardId={dialog.boardId} />;
  return <BoardNameDialog key="create" mode="create" />;
}
