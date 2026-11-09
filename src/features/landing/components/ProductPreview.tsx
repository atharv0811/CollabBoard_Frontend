import { Ellipsis, Menu, Share2 } from "lucide-react";
import { AvatarStack } from "@/components/common/Avatar";
import { CollaboratorCursor } from "@/components/common/CollaboratorCursor";
import { BoardSketch } from "@/components/illustrations/BoardSketch";
import { cn } from "@/lib/utils";
import { sampleCollaborators } from "@/features/workspace/data/collaborators";
import {
  PREVIEW_ACTIVE_TOOL,
  toolGroups,
} from "@/features/workspace/data/tools";

const previewTools = toolGroups.flat();

function MiniToolbar() {
  return (
    <div className="surface-floating flex items-center gap-0.5 rounded-[10px] p-0.5 sm:p-1">
      {previewTools.map((tool, index) => {
        const Icon = tool.icon;
        const active = tool.id === PREVIEW_ACTIVE_TOOL;
        return (
          <span
            key={tool.id}
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-md text-foreground/75 sm:size-7",
              active && "bg-selected text-selected-foreground",
              index > 6 && "hidden sm:inline-flex",
            )}
          >
            <Icon className="size-3.5" strokeWidth={1.75} />
          </span>
        );
      })}
      <span className="mx-0.5 h-4 w-px bg-border" />
      <span className="inline-flex size-6 items-center justify-center text-foreground/75 sm:size-7">
        <Ellipsis className="size-3.5" />
      </span>
    </div>
  );
}

/**
 * Static, scaled-down mockup of the workspace for the landing hero.
 * Mirrors the real workspace chrome (menu, toolbar, header) using the same
 * tool data and tokens. Entirely decorative and non-interactive.
 */
export function ProductPreview({ className }: { className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-5xl", className)}>
      <div className="rounded-[1.25rem] border border-border bg-card p-1.5 shadow-popover">
        {/* Window bar */}
        <div aria-hidden="true" className="flex items-center gap-3 px-3 py-2">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-border-strong" />
            <span className="size-2.5 rounded-full bg-border-strong" />
            <span className="size-2.5 rounded-full bg-border-strong" />
          </div>
          <span className="mx-auto truncate rounded-md bg-secondary px-3 py-1 text-[0.6875rem] text-muted-foreground">
            collabboard.app/b/product-roadmap
          </span>
          <span className="w-10" />
        </div>

        {/* Canvas */}
        <div
          role="img"
          aria-label="Preview of the CollabBoard workspace: a flowchart being edited by two collaborators"
          className="relative aspect-4/3 overflow-hidden rounded-xl border border-border bg-dot-grid sm:aspect-[16/9]"
        >
          <div
            aria-hidden="true"
            className="absolute inset-x-2 top-2 flex items-start justify-between gap-2 sm:inset-x-3 sm:top-3"
          >
            <span className="surface-floating inline-flex size-7 items-center justify-center rounded-[10px] text-foreground sm:size-9">
              <Menu className="size-4" strokeWidth={1.75} />
            </span>
            <MiniToolbar />
            <span className="hidden items-center gap-2 sm:flex">
              <AvatarStack people={sampleCollaborators} size="xs" />
              <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground shadow-xs">
                <Share2 className="size-3.5" />
                Share
              </span>
            </span>
            <span className="w-7 sm:hidden" />
          </div>

          <div
            aria-hidden="true"
            className="absolute inset-x-[4%] top-[20%] bottom-[6%] flex items-center"
          >
            <BoardSketch idPrefix="hero-sketch" className="max-h-full" />
          </div>

          <CollaboratorCursor
            name="Priya"
            tone="amber"
            className="top-[34%] left-[62%]"
          />
          <CollaboratorCursor
            name="Marco"
            tone="sky"
            className="top-[84%] left-[58%]"
          />
        </div>
      </div>
    </div>
  );
}
