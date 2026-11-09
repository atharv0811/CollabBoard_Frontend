import {
  CircleQuestionMark,
  FileDown,
  FilePlus,
  FileUp,
  FolderOpen,
  Keyboard,
  Save,
  Settings2,
  type LucideIcon,
} from "lucide-react";

export interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  count?: number;
}

export const mainActions: MenuItem[] = [
  { id: "new", label: "New board", icon: FilePlus },
  { id: "open", label: "Open", icon: FolderOpen, shortcut: "Ctrl+O" },
  { id: "save", label: "Save", icon: Save, shortcut: "Ctrl+S" },
  { id: "export", label: "Export", icon: FileDown, shortcut: "Ctrl+Shift+E" },
  { id: "import", label: "Import", icon: FileUp },
  { id: "settings", label: "Board settings", icon: Settings2 },
  { id: "shortcuts", label: "Keyboard shortcuts", icon: Keyboard, shortcut: "?" },
  { id: "help", label: "Help", icon: CircleQuestionMark },
];
