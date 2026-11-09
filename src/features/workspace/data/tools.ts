import {
  ArrowRight,
  Circle,
  Diamond,
  Eraser,
  Hand,
  Image,
  Minus,
  MousePointer2,
  Pencil,
  Square,
  Type,
  type LucideIcon,
} from "lucide-react";

export type ToolId =
  | "selection"
  | "hand"
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "arrow"
  | "line"
  | "freehand"
  | "text"
  | "image"
  | "eraser";

export interface ToolDefinition {
  id: ToolId;
  label: string;
  icon: LucideIcon;
  /** Shortcut hint shown in the corner of the button and in its tooltip */
  shortcut?: string;
}

/**
 * Toolbar groups, rendered left → right with a divider between groups.
 * Drawing tools are handled by canvas/elements.ts (isDrawingTool).
 */
export const toolGroups: ToolDefinition[][] = [
  [
    { id: "selection", label: "Select", icon: MousePointer2, shortcut: "V" },
    { id: "hand", label: "Hand (pan)", icon: Hand, shortcut: "H" },
  ],
  [
    { id: "rectangle", label: "Rectangle", icon: Square, shortcut: "R" },
    { id: "diamond", label: "Diamond", icon: Diamond, shortcut: "D" },
    { id: "ellipse", label: "Ellipse", icon: Circle, shortcut: "O" },
    { id: "arrow", label: "Arrow", icon: ArrowRight, shortcut: "A" },
    { id: "line", label: "Line", icon: Minus, shortcut: "L" },
    { id: "freehand", label: "Draw", icon: Pencil, shortcut: "P" },
    { id: "text", label: "Text", icon: Type, shortcut: "T" },
    { id: "image", label: "Insert image", icon: Image, shortcut: "I" },
    { id: "eraser", label: "Eraser", icon: Eraser, shortcut: "E" },
  ],
];

/** The tool shown in its selected visual state in the static preview */
export const PREVIEW_ACTIVE_TOOL: ToolId = "selection";
