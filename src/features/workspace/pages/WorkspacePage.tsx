import { BoardDialogs } from "@/features/boards/components/BoardDialogs";
import { SaveStatusIndicator } from "@/features/boards/components/SaveStatusIndicator";
import { useBoardAutosave } from "@/features/boards/hooks/useBoardAutosave";
import { useBoardRoute } from "@/features/boards/hooks/useBoardRoute";
import { useBoardsSync } from "@/features/boards/hooks/useBoardsSync";
import { CanvasContextBar } from "@/features/workspace/components/CanvasContextBar";
import { CanvasSurface } from "@/features/workspace/components/CanvasSurface";
import { HistoryControls } from "@/features/workspace/components/HistoryControls";
import { StatusBar } from "@/features/workspace/components/StatusBar";
import { ViewportControls } from "@/features/workspace/components/ViewportControls";
import { WorkspaceHeader } from "@/features/workspace/components/WorkspaceHeader";
import { WorkspaceMenu } from "@/features/workspace/components/WorkspaceMenu";
import { WorkspaceToolbar } from "@/features/workspace/components/WorkspaceToolbar";
import { useWorkspaceShortcuts } from "@/features/workspace/hooks/useWorkspaceShortcuts";
import { useWorkspaceStore } from "@/features/workspace/store/workspaceStore";

export default function WorkspacePage() {
  const activeTool = useWorkspaceStore((state) => state.activeTool);
  const setActiveTool = useWorkspaceStore((state) => state.setActiveTool);
  useWorkspaceShortcuts();
  useBoardsSync();
  useBoardRoute();
  useBoardAutosave();

  return (
    <div className="relative h-svh w-full overflow-hidden bg-canvas text-foreground">
      <CanvasSurface />

      <WorkspaceMenu className="absolute top-(--workspace-gutter) left-(--workspace-gutter) z-(--z-panel)" />

      <SaveStatusIndicator
        floating
        className="absolute top-(--workspace-gutter) left-[calc(var(--workspace-gutter)+3.25rem)] z-(--z-overlay) lg:hidden"
      />

      <div className="absolute top-(--workspace-gutter) left-1/2 z-(--z-overlay) hidden -translate-x-1/2 flex-col items-center gap-3 lg:flex">
        <WorkspaceToolbar activeTool={activeTool} onToolChange={setActiveTool} />
        <CanvasContextBar />
      </div>

      <WorkspaceHeader className="absolute top-(--workspace-gutter) right-(--workspace-gutter) z-(--z-panel)" />

      <div className="pointer-events-none absolute inset-x-(--workspace-gutter) bottom-(--workspace-gutter) z-(--z-overlay) flex flex-col items-center gap-3 lg:hidden">
        <div className="flex w-full items-center justify-between gap-2">
          <HistoryControls />
          <ViewportControls />
        </div>
        <CanvasContextBar className="pointer-events-auto" />
        <WorkspaceToolbar activeTool={activeTool} onToolChange={setActiveTool} className="pointer-events-auto" />
      </div>

      <StatusBar className="absolute inset-x-(--workspace-gutter) bottom-(--workspace-gutter) z-(--z-overlay) hidden lg:grid" />

      <BoardDialogs />
    </div>
  );
}
