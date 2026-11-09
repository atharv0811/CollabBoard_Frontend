import {
  CircleQuestionMark,
  Clock,
  FileDown,
  FilePlus,
  FileUp,
  FolderOpen,
  Keyboard,
  LayoutGrid,
  Save,
  Settings2,
  Users,
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
  { id: "new", label: "New board", icon: FilePlus, shortcut: "Ctrl+Alt+N" },
  { id: "open", label: "Open", icon: FolderOpen, shortcut: "Ctrl+O" },
  { id: "save", label: "Save", icon: Save, shortcut: "Ctrl+S" },
  { id: "export", label: "Export", icon: FileDown, shortcut: "Ctrl+Shift+E" },
  { id: "import", label: "Import", icon: FileUp },
  { id: "settings", label: "Board settings", icon: Settings2 },
  { id: "shortcuts", label: "Keyboard shortcuts", icon: Keyboard, shortcut: "?" },
  { id: "help", label: "Help", icon: CircleQuestionMark },
];

export const workspaceLinks: MenuItem[] = [
  { id: "my-boards", label: "My boards", icon: LayoutGrid, count: 12 },
  { id: "shared", label: "Shared with me", icon: Users, count: 4 },
  { id: "recent", label: "Recent boards", icon: Clock },
];

export const PREVIEW_ACTIVE_MENU_ITEM = "my-boards";
