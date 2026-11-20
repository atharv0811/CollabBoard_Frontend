import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";
import { useWorkspaceStore, type WorkspaceState } from "@/features/workspace/store/workspaceStore";
import { updateBoardDocument } from "../api/boardsApis";
import type { BoardDocument } from "../lib/model";
import { useSaveStatusStore } from "../store/saveStatusStore";
import type { BoardResponse } from "../types/boardTypes";
import { boardQueryKey } from "./queries/useBoardQuery";

const WAIT_AFTER_LAST_CHANGE_BEFORE_SAVING_MS = 800;

interface UnsavedBoardChanges {
  boardId: string;
  document: BoardDocument;
}

const hasSwitchedToAnotherBoard = (current: WorkspaceState, previous: WorkspaceState) =>
  current.boardId !== previous.boardId;

const hasDrawingOrViewportChanged = (current: WorkspaceState, previous: WorkspaceState) =>
  current.elements !== previous.elements || current.viewport !== previous.viewport;

const updateCachedBoardDocument = (queryClient: QueryClient, boardId: string, document: BoardDocument) => {
  queryClient.setQueryData<BoardResponse>(boardQueryKey(boardId), (board) => board && { ...board, document });
};

export function useBoardAutosave() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const { setStatus: setSaveStatus } = useSaveStatusStore.getState();
    let scheduledSaveTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let unsavedChanges: UnsavedBoardChanges | null = null;
    let isSaveRequestInProgress = false;

    const cancelScheduledSave = () => {
      clearTimeout(scheduledSaveTimeoutId);
      scheduledSaveTimeoutId = undefined;
    };

    const scheduleSaveAfterChangesStop = () => {
      cancelScheduledSave();
      scheduledSaveTimeoutId = setTimeout(() => void saveUnsavedChangesNow(), WAIT_AFTER_LAST_CHANGE_BEFORE_SAVING_MS);
    };

    const saveUnsavedChangesNow = async () => {
      cancelScheduledSave();
      if (isSaveRequestInProgress || !unsavedChanges) return;

      const { boardId, document } = unsavedChanges;
      unsavedChanges = null;
      isSaveRequestInProgress = true;
      setSaveStatus("saving");

      try {
        await updateBoardDocument({ boardId, document });
        updateCachedBoardDocument(queryClient, boardId, document);
        if (!unsavedChanges) setSaveStatus("saved");
      } catch (error) {
        if (!unsavedChanges) setSaveStatus("error");
        toast.error(getApiErrorMessage(error, "Couldn't save your changes."), { id: "save-board-error" });
      } finally {
        isSaveRequestInProgress = false;
        if (unsavedChanges) scheduleSaveAfterChangesStop();
      }
    };

    const handleCanvasChange = (current: WorkspaceState, previous: WorkspaceState) => {
      if (hasSwitchedToAnotherBoard(current, previous)) {
        if (unsavedChanges) void saveUnsavedChangesNow();
        return;
      }
      if (!current.boardId || !hasDrawingOrViewportChanged(current, previous)) return;

      unsavedChanges = {
        boardId: current.boardId,
        document: { elements: current.elements, viewport: current.viewport },
      };
      setSaveStatus("pending");
      if (!isSaveRequestInProgress) scheduleSaveAfterChangesStop();
    };

    const warnAboutUnsavedChangesBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (unsavedChanges || isSaveRequestInProgress) event.preventDefault();
    };

    const stopWatchingCanvasChanges = useWorkspaceStore.subscribe(handleCanvasChange);
    window.addEventListener("beforeunload", warnAboutUnsavedChangesBeforeLeaving);

    return () => {
      window.removeEventListener("beforeunload", warnAboutUnsavedChangesBeforeLeaving);
      stopWatchingCanvasChanges();
      if (unsavedChanges) void saveUnsavedChangesNow();
    };
  }, [queryClient]);
}
