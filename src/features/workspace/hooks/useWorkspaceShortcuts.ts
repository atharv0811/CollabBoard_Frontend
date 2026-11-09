import { useEffect } from "react";
import { useWorkspaceStore } from "../store/workspaceStore";

/** True when the key event comes from somewhere the user is typing. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.closest("input, textarea, select, [contenteditable]") !== null;
}

/**
 * Workspace keyboard shortcuts:
 *   Delete / Backspace → delete the selection
 *   Escape             → clear the selection
 * Ignored while typing in a field, and only prevent the browser default
 * when they actually do something.
 */
export function useWorkspaceShortcuts() {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || isEditableTarget(event.target)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const store = useWorkspaceStore.getState();
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
