import { Tooltip } from "@/components/common/Tooltip";
import { cn } from "@/lib/utils";
import type { ToolDefinition, ToolId } from "../data/tools";

interface ToolButtonProps {
  tool: ToolDefinition;
  active?: boolean;
  onClick?: (toolId: ToolId) => void;
}

/** Single toolbar tool. The corner shortcut letter is hidden below `sm` (touch). */
export function ToolButton({ tool, active = false, onClick }: ToolButtonProps) {
  const Icon = tool.icon;

  return (
    <Tooltip label={tool.label} shortcut={tool.shortcut} side="bottom">
      <button
        type="button"
        aria-label={tool.label}
        aria-pressed={active}
        onClick={() => onClick?.(tool.id)}
        className={cn(
          "relative inline-flex size-(--tool-size) shrink-0 items-center justify-center rounded-tool text-foreground/80 transition-colors duration-150",
          "hover:bg-accent hover:text-foreground",
          "aria-pressed:bg-selected aria-pressed:text-selected-foreground aria-pressed:ring-1 aria-pressed:ring-selected-border aria-pressed:ring-inset",
        )}
      >
        <Icon aria-hidden="true" className="size-4.25" strokeWidth={1.75} />
        {tool.shortcut && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute right-0.75 bottom-px text-[0.5625rem] leading-none font-medium max-sm:hidden",
              active ? "text-selected-foreground/80" : "text-subtle-foreground",
            )}
          >
            {tool.shortcut}
          </span>
        )}
      </button>
    </Tooltip>
  );
}
