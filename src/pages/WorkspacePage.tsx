import { CanvasHint } from "@/features/workspace/components/CanvasHint";
import { CanvasSurface } from "@/features/workspace/components/CanvasSurface";
import { StatusBar } from "@/features/workspace/components/StatusBar";
import { WorkspaceHeader } from "@/features/workspace/components/WorkspaceHeader";
import { WorkspaceMenu } from "@/features/workspace/components/WorkspaceMenu";
import { WorkspaceToolbar } from "@/features/workspace/components/WorkspaceToolbar";

/**
 * Full-screen whiteboard workspace.
 *
 * Layout (all chrome floats over the canvas):
 *   ┌ menu + sidebar ─────── toolbar + hint ─────── header actions ┐
 *   │                                                              │
 *   │                        empty dot-grid canvas                 │
 *   │                                                              │
 *   └ status ─────────────────────────────────────────────── help ┘
 *
 * Below `lg` the toolbar moves to the bottom and the status row is hidden.
 * The board menu panel opens/closes from the top-left menu button.
 */
export default function WorkspacePage() {
  return (
    <div className="relative h-svh w-full overflow-hidden bg-canvas text-foreground">
      <CanvasSurface />

      {/* Top-left: menu button + board menu panel */}
      <WorkspaceMenu className="absolute top-(--workspace-gutter) left-(--workspace-gutter) z-(--z-panel)" />

      {/* Top-centre: toolbar + helper text (large screens) */}
      <div className="absolute top-(--workspace-gutter) left-1/2 z-(--z-overlay) hidden -translate-x-1/2 flex-col items-center gap-3 lg:flex">
        <WorkspaceToolbar />
        <CanvasHint />
      </div>

      {/* Top-right: header actions */}
      <WorkspaceHeader className="absolute top-(--workspace-gutter) right-(--workspace-gutter) z-(--z-panel)" />

      {/* Bottom: toolbar + hint on small screens */}
      <div className="absolute inset-x-(--workspace-gutter) bottom-(--workspace-gutter) z-(--z-overlay) flex flex-col items-center gap-3 lg:hidden">
        <CanvasHint />
        <WorkspaceToolbar />
      </div>

      {/* Bottom: status + help on large screens */}
      <StatusBar className="absolute inset-x-(--workspace-gutter) bottom-(--workspace-gutter) z-(--z-overlay) hidden lg:grid" />
    </div>
  );
}
