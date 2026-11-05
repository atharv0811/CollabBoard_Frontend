import { CircleQuestionMark, Users, Wifi } from "lucide-react";
import { Divider } from "@/components/common/Divider";
import { IconButton } from "@/components/common/IconButton";
import { Tooltip } from "@/components/common/Tooltip";
import { cn } from "@/lib/utils";

interface StatusBarProps {
  className?: string;
}

/**
 * Bottom status row: connection + collaboration placeholders centred
 * (keeping the left column free for the sidebar), help on the right.
 * Text values are static placeholders for you to bind to real state.
 */
export function StatusBar({ className }: StatusBarProps) {
  return (
    <div className={cn("pointer-events-none grid grid-cols-[1fr_auto_1fr] items-end gap-3", className)}>
      <span aria-hidden="true" />
      <div
        role="status"
        className="surface-floating pointer-events-auto flex h-9 items-center gap-2.5 px-3 text-xs text-muted-foreground"
      >
        <span className="flex items-center gap-1.5">
          <span className="relative flex size-2">
            <span className="absolute inset-0 rounded-full bg-success/40" />
            <span className="relative m-auto size-1.5 rounded-full bg-success" />
          </span>
          <Wifi aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
          <span>Connected</span>
        </span>
        <Divider orientation="vertical" className="h-4" />
        <span className="flex items-center gap-1.5">
          <Users aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
          <span>3 collaborators</span>
        </span>
      </div>

      <Tooltip label="Help" shortcut="?" side="top" className="pointer-events-auto justify-self-end">
        <IconButton icon={CircleQuestionMark} label="Help" variant="floating" size="md" />
      </Tooltip>
    </div>
  );
}
