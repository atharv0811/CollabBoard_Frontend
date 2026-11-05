import { Fragment } from "react";
import { Ellipsis } from "lucide-react";
import { Divider } from "@/components/common/Divider";
import { IconButton } from "@/components/common/IconButton";
import { Tooltip } from "@/components/common/Tooltip";
import { cn } from "@/lib/utils";
import { PREVIEW_ACTIVE_TOOL, toolGroups } from "../data/tools";
import { ToolButton } from "./ToolButton";

interface WorkspaceToolbarProps {
  className?: string;
}

/**
 * Floating tool palette. WorkspacePage places it top-centre on large
 * screens and at the bottom of the viewport on smaller ones. Below `sm`
 * it scrolls horizontally; above that it stays overflow-visible so the
 * CSS tooltips are not clipped.
 */
export function WorkspaceToolbar({ className }: WorkspaceToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Drawing tools"
      className={cn(
        "surface-floating flex max-w-full items-center gap-0.5 overflow-x-auto p-1 scrollbar-none sm:overflow-visible",
        className,
      )}
    >
      {toolGroups.map((group, index) => (
        <Fragment key={group[0]?.id ?? index}>
          {index > 0 && <Divider orientation="vertical" />}
          {group.map((tool) => (
            <ToolButton key={tool.id} tool={tool} active={tool.id === PREVIEW_ACTIVE_TOOL} />
          ))}
        </Fragment>
      ))}

      <Divider orientation="vertical" />
      <Tooltip label="More tools" side="bottom">
        <IconButton icon={Ellipsis} label="More tools" size="md" />
      </Tooltip>
    </div>
  );
}
