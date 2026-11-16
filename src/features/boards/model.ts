import type { CanvasElement } from "../workspace/canvas/elements.ts";
import { DEFAULT_VIEWPORT, type Viewport } from "../workspace/canvas/viewport.ts";

export const DEFAULT_BOARD_NAME = "Untitled board";
export const MAX_BOARD_NAME_LENGTH = 80;

export interface BoardMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface BoardDocument {
  elements: CanvasElement[];
  viewport: Viewport;
}

export interface Board extends BoardMeta, BoardDocument {}

export const emptyDocument = (): BoardDocument => ({
  elements: [],
  viewport: DEFAULT_VIEWPORT,
});

export type NameCheck = { ok: true; name: string } | { ok: false; reason: string };

const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ");

export function checkBoardName(raw: string, existing: readonly BoardMeta[], exceptId?: string): NameCheck {
  const name = normalizeName(raw);
  if (!name) return { ok: false, reason: "Enter a board name." };
  if (name.length > MAX_BOARD_NAME_LENGTH) {
    return {
      ok: false,
      reason: `Use ${MAX_BOARD_NAME_LENGTH} characters or fewer.`,
    };
  }
  const taken = existing.some(
    (board) => board.id !== exceptId && board.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
  );
  if (taken) return { ok: false, reason: "A board with this name already exists." };
  return { ok: true, name };
}

export function nextDefaultName(existing: readonly BoardMeta[], base = DEFAULT_BOARD_NAME): string {
  const taken = new Set(existing.map((board) => board.name.toLocaleLowerCase()));
  if (!taken.has(base.toLocaleLowerCase())) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate.toLocaleLowerCase())) return candidate;
  }
}
