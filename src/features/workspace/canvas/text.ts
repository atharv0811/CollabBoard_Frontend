import { DEFAULT_STYLE, type Point, type TextElement } from "./elements.ts";

export const TEXT_FONT_SIZE = 20;
export const TEXT_LINE_HEIGHT = 1.25;
export const TEXT_FONT_FAMILY = '"Geist Variable", ui-sans-serif, system-ui, sans-serif';

let context: CanvasRenderingContext2D | null | undefined;

function measureContext(): CanvasRenderingContext2D | null {
  if (context === undefined) {
    context = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  }
  return context;
}

export const textLines = (text: string) => text.split("\n");

/** Size of `text` in world units. Falls back to an estimate where there is no DOM (tests). */
export function measureText(text: string, fontSize: number): { width: number; height: number } {
  const lines = textLines(text);
  const ctx = measureContext();
  if (ctx) ctx.font = `${fontSize}px ${TEXT_FONT_FAMILY}`;

  let width = 0;
  for (const line of lines) {
    width = Math.max(width, ctx ? ctx.measureText(line).width : line.length * fontSize * 0.6);
  }
  return { width: Math.max(width, fontSize / 2), height: lines.length * fontSize * TEXT_LINE_HEIGHT };
}

export function createTextElement(id: string, at: Point, text: string, fontSize = TEXT_FONT_SIZE): TextElement {
  return { id, type: "text", style: DEFAULT_STYLE, x: at.x, y: at.y, text, fontSize, ...measureText(text, fontSize) };
}

/** Re-measures after the text changed, keeping position and font size. */
export function withText(element: TextElement, text: string): TextElement {
  return { ...element, text, ...measureText(text, element.fontSize) };
}
