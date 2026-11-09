import { useEffect } from "react";
import { useWorkspaceStore } from "../workspace/store/workspaceStore";
import { useBoardsStore } from "./boardsStore";
import { createIndexedDbBoardRepository } from "./indexedDbRepository";
import { BoardSession } from "./session";

export const boardSession = new BoardSession({
  repository: createIndexedDbBoardRepository(),
  workspace: useWorkspaceStore,
  boards: useBoardsStore,
});

export function useBoardPersistence() {
  useEffect(() => {
    void boardSession.start();

    const flush = () => void boardSession.flushNow();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
}
