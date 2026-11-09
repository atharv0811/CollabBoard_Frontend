export interface History<T> {
  past: T[];
  future: T[];
}

export const HISTORY_LIMIT = 100;

export const emptyHistory = <T>(): History<T> => ({ past: [], future: [] });

export function recordEdit<T>(history: History<T>, previous: T, limit = HISTORY_LIMIT): History<T> {
  const past = [...history.past, previous];
  return { past: past.length > limit ? past.slice(past.length - limit) : past, future: [] };
}

export function undoStep<T>(history: History<T>, current: T): { history: History<T>; value: T } | null {
  const value = history.past[history.past.length - 1];
  if (value === undefined) return null;
  return { value, history: { past: history.past.slice(0, -1), future: [current, ...history.future] } };
}

export function redoStep<T>(history: History<T>, current: T): { history: History<T>; value: T } | null {
  const [value, ...future] = history.future;
  if (value === undefined) return null;
  return { value, history: { past: [...history.past, current], future } };
}

export interface ShortcutKey {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export function historyShortcut(event: ShortcutKey): "undo" | "redo" | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (key === "z" || event.code === "KeyZ") return event.shiftKey ? "redo" : "undo";
  if ((key === "y" || event.code === "KeyY") && !event.shiftKey) return "redo";
  return null;
}

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
