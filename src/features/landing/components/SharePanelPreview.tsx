import { Copy, Globe, Link2 } from "lucide-react";
import { Avatar, type AvatarTone } from "@/components/common/Avatar";
import { Badge } from "@/components/common/Badge";
import { CollaboratorCursor } from "@/components/common/CollaboratorCursor";

interface Member {
  name: string;
  email: string;
  tone: AvatarTone;
  role: string;
}

const members: Member[] = [
  { name: "Alex Morgan", email: "alex@collabboard.app", tone: "teal", role: "Owner" },
  { name: "Priya Shah", email: "priya@studio.co", tone: "amber", role: "Can edit" },
  { name: "Marco Ruiz", email: "marco@studio.co", tone: "sky", role: "Can view" },
];

/**
 * Decorative mock of a share dialog for the benefits section.
 * Built from non-interactive elements on purpose.
 */
export function SharePanelPreview() {
  return (
    <div
      role="img"
      aria-label="Example share dialog showing a board link and three people with different access levels"
      className="relative"
    >
      <div aria-hidden="true" className="rounded-panel border border-border bg-popover p-5 shadow-popover sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Share “Product roadmap”</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Invite people or copy a link</p>
          </div>
          <Badge variant="success">
            <span className="size-1.5 rounded-full bg-success" />
            Live
          </Badge>
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-lg border border-input bg-card py-1.5 pr-1.5 pl-3">
          <Link2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-sm text-foreground/80">collabboard.app/b/product-roadmap</span>
          <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-secondary px-2.5 text-xs font-medium text-foreground">
            <Copy className="size-3.5" />
            Copy
          </span>
        </div>

        <p className="mt-6 text-[0.6875rem] font-semibold tracking-wide text-subtle-foreground uppercase">
          People with access
        </p>
        <ul className="mt-2 flex flex-col">
          {members.map((member) => (
            <li key={member.email} className="flex items-center gap-3 py-2">
              <Avatar name={member.name} tone={member.tone} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{member.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{member.email}</span>
              </span>
              <Badge variant={member.role === "Owner" ? "brand" : "outline"}>{member.role}</Badge>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2.5 text-xs text-muted-foreground">
          <Globe className="size-3.5 shrink-0" />
          Anyone with the link can view
        </div>
      </div>

      <CollaboratorCursor name="Priya" tone="amber" className="-top-4 right-10 hidden sm:flex" />
    </div>
  );
}
