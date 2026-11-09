/*
 * Document history — pure, generic, no React / Zustand.
 *
 * Snapshot-based: each entry is a previous document value. The workspace
 * document (`elements`) is updated immutably with structural sharing, so a
 * snapshot is just the previous array reference: unchanged elements are the
 * same objects in every snapshot. No deep cloning happens, ever.
 */

export interface History<T> {
  /** Older document states, oldest first. The last entry is what undo restores. */
  past: T[];
  /** States undone, nearest first. The first entry is what redo restores. */
  future: T[];
}

/**
 * 100 entries. With structural sharing an entry costs roughly one pointer
 * per element plus only the elements that edit changed — a few KB even on a
 * busy board — while 100 steps is far deeper than anyone undoes in practice.
 */
export const HISTORY_LIMIT = 100;

export const emptyHistory = <T>(): History<T> => ({ past: [], future: [] });

/** Records `previous` as an undo step after a real edit. Any redo future is discarded. */
export function recordEdit<T>(history: History<T>, previous: T, limit = HISTORY_LIMIT): History<T> {
  const past = [...history.past, previous];
  return { past: past.length > limit ? past.slice(past.length - limit) : past, future: [] };
}

/** Steps back. Returns null when there is nothing to undo. */
export function undoStep<T>(history: History<T>, current: T): { history: History<T>; value: T } | null {
  const value = history.past[history.past.length - 1];
  if (value === undefined) return null;
  return { value, history: { past: history.past.slice(0, -1), future: [current, ...history.future] } };
}

/** Steps forward again. Returns null when there is nothing to redo. */
export function redoStep<T>(history: History<T>, current: T): { history: History<T>; value: T } | null {
  const [value, ...future] = history.future;
  if (value === undefined) return null;
  return { value, history: { past: [...history.past, current], future } };
}

export interface ShortcutKey {
  key: string;
  /** Physical key, e.g. "KeyZ" — makes shortcuts work on non-Latin keyboard layouts */
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * Undo / redo keymap:
 *   Ctrl/⌘ + Z          → undo
 *   Ctrl/⌘ + Shift + Z  → redo
 *   Ctrl/⌘ + Y          → redo
 * Alt combinations are left to the OS / browser.
 */
export function historyShortcut(event: ShortcutKey): "undo" | "redo" | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (key === "z" || event.code === "KeyZ") return event.shiftKey ? "redo" : "undo";
  if ((key === "y" || event.code === "KeyY") && !event.shiftKey) return "redo";
  return null;
}

/** Structural equality for plain JSON-like data (used to detect no-op edits). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  return aKeys.every((key) => Object.prototype.hasOwnProperty.call(bRecord, key) && deepEqual(aRecord[key], bRecord[key]));
}
