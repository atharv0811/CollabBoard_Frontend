import { CircleQuestionMark, Users } from "lucide-react";
import { SaveStatusIndicator } from "@/features/boards/components/SaveStatusIndicator";
import { Divider } from "@/components/common/Divider";
import { IconButton } from "@/components/common/IconButton";
import { Tooltip } from "@/components/common/Tooltip";
import { cn } from "@/lib/utils";
import { HistoryControls } from "./HistoryControls";
import { ViewportControls } from "./ViewportControls";

interface StatusBarProps {
  className?: string;
}

export function StatusBar({ className }: StatusBarProps) {
  return (
    <div
      className={cn(
        "pointer-events-none grid grid-cols-[1fr_auto_1fr] items-end gap-3",
        className,
      )}
    >
      <div className="flex items-center gap-2 justify-self-start">
        <ViewportControls />
        <HistoryControls />
      </div>
      <div className="surface-floating pointer-events-auto flex h-9 items-center gap-2.5 px-3 text-xs text-muted-foreground">
        <SaveStatusIndicator />
        <Divider orientation="vertical" className="h-4" />
        <span className="flex items-center gap-1.5">
          <Users aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
          <span>3 collaborators</span>
        </span>
      </div>

      <Tooltip
        label="Help"
        shortcut="?"
        side="top"
        className="pointer-events-auto justify-self-end"
      >
        <IconButton
          icon={CircleQuestionMark}
          label="Help"
          variant="floating"
          size="md"
        />
      </Tooltip>
    </div>
  );
}
