import { cn } from "@/lib/utils";

export type AvatarTone = "amber" | "rose" | "sky" | "lime" | "teal";
type AvatarSize = "xs" | "sm" | "md" | "lg";

interface AvatarProps {
  name: string;
  tone?: AvatarTone;
  size?: AvatarSize;
  ringed?: boolean;
  online?: boolean;
  className?: string;
}

const toneClass: Record<AvatarTone, string> = {
  amber: "bg-tone-amber",
  rose: "bg-tone-rose",
  sky: "bg-tone-sky",
  lime: "bg-tone-lime",
  teal: "bg-tone-teal",
};

const sizeClass: Record<AvatarSize, string> = {
  xs: "size-5 text-[0.5625rem]",
  sm: "size-7 text-[0.6875rem]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
};

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Avatar({ name, tone = "teal", size = "md", ringed, online, className }: AvatarProps) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        role="img"
        aria-label={name}
        className={cn(
          "inline-flex items-center justify-center rounded-full font-semibold text-tone-ink select-none",
          toneClass[tone],
          sizeClass[size],
          ringed && "ring-2 ring-card",
        )}
      >
        {initialsOf(name)}
      </span>
      {online && (
        <span
          aria-hidden="true"
          className="absolute -right-px -bottom-px size-2.5 rounded-full bg-success ring-2 ring-card"
        />
      )}
    </span>
  );
}

export interface AvatarStackPerson {
  name: string;
  tone: AvatarTone;
}

interface AvatarStackProps {
  people: AvatarStackPerson[];
  extra?: number;
  size?: AvatarSize;
  className?: string;
}

export function AvatarStack({ people, extra, size = "sm", className }: AvatarStackProps) {
  return (
    <div className={cn("flex items-center -space-x-1.5", className)}>
      {people.map((person) => (
        <Avatar key={person.name} name={person.name} tone={person.tone} size={size} ringed />
      ))}
      {extra ? (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-secondary font-medium text-muted-foreground ring-2 ring-card",
            sizeClass[size],
          )}
        >
          +{extra}
        </span>
      ) : null}
    </div>
  );
}
