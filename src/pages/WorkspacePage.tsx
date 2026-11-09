import { CanvasContextBar } from "@/features/workspace/components/CanvasContextBar";
import { CanvasSurface } from "@/features/workspace/components/CanvasSurface";
import { StatusBar } from "@/features/workspace/components/StatusBar";
import { WorkspaceHeader } from "@/features/workspace/components/WorkspaceHeader";
import { WorkspaceMenu } from "@/features/workspace/components/WorkspaceMenu";
import { WorkspaceToolbar } from "@/features/workspace/components/WorkspaceToolbar";
import { useWorkspaceShortcuts } from "@/features/workspace/hooks/useWorkspaceShortcuts";
import { useWorkspaceStore } from "@/features/workspace/store/workspaceStore";

export default function WorkspacePage() {
  const activeTool = useWorkspaceStore((state) => state.activeTool);
  const setActiveTool = useWorkspaceStore((state) => state.setActiveTool);
  useWorkspaceShortcuts();

  return (
    <div className="relative h-svh w-full overflow-hidden bg-canvas text-foreground">
      <CanvasSurface />

      {/* Top-left: menu button + board menu panel */}
      <WorkspaceMenu className="absolute top-(--workspace-gutter) left-(--workspace-gutter) z-(--z-panel)" />

      {/* Top-centre: toolbar + hint / selection actions (large screens) */}
      <div className="absolute top-(--workspace-gutter) left-1/2 z-(--z-overlay) hidden -translate-x-1/2 flex-col items-center gap-3 lg:flex">
        <WorkspaceToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
        />
        <CanvasContextBar />
      </div>

      {/* Top-right: header actions */}
      <WorkspaceHeader className="absolute top-(--workspace-gutter) right-(--workspace-gutter) z-(--z-panel)" />

      {/* Bottom: hint / selection actions + toolbar on small screens */}
      <div className="absolute inset-x-(--workspace-gutter) bottom-(--workspace-gutter) z-(--z-overlay) flex flex-col items-center gap-3 lg:hidden">
        <CanvasContextBar />
        <WorkspaceToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
        />
      </div>

      {/* Bottom: status + help on large screens */}
      <StatusBar className="absolute inset-x-(--workspace-gutter) bottom-(--workspace-gutter) z-(--z-overlay) hidden lg:grid" />
    </div>
  );
}
