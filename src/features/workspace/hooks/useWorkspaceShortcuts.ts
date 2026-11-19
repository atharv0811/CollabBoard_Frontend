import { useEffect } from "react";
import { toolGroups } from "../data/tools";
import { historyShortcut } from "../store/history";
import { useWorkspaceStore } from "../store/workspaceStore";

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.closest("input, textarea, select, [contenteditable]") !== null;
}

export function useWorkspaceShortcuts() {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || isEditableTarget(event.target)) return;
      if (event.target instanceof Element && event.target.closest("dialog")) return;
      const store = useWorkspaceStore.getState();

      const historyAction = historyShortcut(event);
      if (historyAction) {
        event.preventDefault();
        if (historyAction === "undo") store.undo();
        else store.redo();
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) return;

      // event.code ("KeyR") is the physical key, so shortcuts also work with non-English keyboard layouts.
      const letter = event.code.startsWith("Key") ? event.code.slice(3) : event.key.toUpperCase();
      const tool = toolGroups.flat().find((t) => t.shortcut === letter);
      if (tool && !event.shiftKey) {
        event.preventDefault();
        store.setActiveTool(tool.id);
        return;
      }

      if (store.selectedIds.length === 0) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        store.deleteSelected();
      } else if (event.key === "Escape") {
        store.clearSelection();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
