import { cn } from "@/lib/utils";
import type { AvatarTone } from "./Avatar";

interface CollaboratorCursorProps {
  name: string;
  tone: AvatarTone;
  className?: string;
}

const toneFill: Record<AvatarTone, string> = {
  amber: "fill-tone-amber",
  rose: "fill-tone-rose",
  sky: "fill-tone-sky",
  lime: "fill-tone-lime",
  teal: "fill-tone-teal",
};

const toneBg: Record<AvatarTone, string> = {
  amber: "bg-tone-amber",
  rose: "bg-tone-rose",
  sky: "bg-tone-sky",
  lime: "bg-tone-lime",
  teal: "bg-tone-teal",
};

export function CollaboratorCursor({ name, tone, className }: CollaboratorCursorProps) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute flex items-start", className)}>
      <svg viewBox="0 0 16 16" className="size-4 drop-shadow-sm">
        <path
          d="M2 1.5 14 7l-5.3 1.4L6.6 14 2 1.5Z"
          className={cn(toneFill[tone], "stroke-tone-ink/70")}
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className={cn(
          "mt-3 -ml-0.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold text-tone-ink shadow-xs",
          toneBg[tone],
        )}
      >
        {name}
      </span>
    </div>
  );
}
