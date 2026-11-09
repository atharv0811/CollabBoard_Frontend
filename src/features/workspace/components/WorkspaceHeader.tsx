import { Share2, UserPlus } from "lucide-react";
import { Avatar, AvatarStack } from "@/components/common/Avatar";
import { Divider } from "@/components/common/Divider";
import { Tooltip } from "@/components/common/Tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sampleCollaborators, sampleUser } from "../data/collaborators";

interface WorkspaceHeaderProps {
  className?: string;
}

export function WorkspaceHeader({ className }: WorkspaceHeaderProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="surface-floating hidden h-11 items-center gap-2 px-2 xl:flex">
        <AvatarStack people={sampleCollaborators} extra={2} size="sm" />
        <Divider orientation="vertical" />
        <Tooltip label="Invite collaborators" side="bottom">
          <Button variant="ghost" size="sm" aria-label="Invite collaborators">
            <UserPlus aria-hidden="true" />
            Invite
          </Button>
        </Tooltip>
      </div>

      <Tooltip label="Invite collaborators" side="bottom" className="xl:hidden">
        <Button
          variant="outline"
          size="icon"
          aria-label="Invite collaborators"
          className="size-11 rounded-panel shadow-floating"
        >
          <UserPlus aria-hidden="true" />
        </Button>
      </Tooltip>

      <Button
        size="lg"
        className="h-11 rounded-panel px-3.5 shadow-floating sm:px-4"
      >
        <Share2 aria-hidden="true" />
        <span className="hidden sm:inline">Share</span>
        <span className="sr-only sm:hidden">Share board</span>
      </Button>

      <button
        type="button"
        aria-label={`Account: ${sampleUser.name}`}
        className="surface-floating inline-flex size-11 items-center justify-center transition-colors duration-150 hover:bg-accent"
      >
        <Avatar
          name={sampleUser.name}
          tone={sampleUser.tone}
          size="sm"
          online
        />
      </button>
    </div>
  );
}
