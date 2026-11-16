import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg";

interface LogoProps {
  size?: LogoSize;
  markOnly?: boolean;
  className?: string;
}

const markSize: Record<LogoSize, string> = {
  sm: "size-6",
  md: "size-7",
  lg: "size-9",
};

const textSize: Record<LogoSize, string> = {
  sm: "text-[0.9375rem]",
  md: "text-base",
  lg: "text-xl",
};

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect width="24" height="24" rx="6.5" className="fill-brand" />
      <path
        d="M6 15.5c1.6-4.2 3.4-6 5-3.4 1.5 2.4 3.1 2.2 4.6-1.8"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17.6" cy="7.4" r="1.7" className="fill-brand-soft" />
    </svg>
  );
}

export function Logo({ size = "md", markOnly = false, className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={cn("shrink-0", markSize[size])} />
      {markOnly ? (
        <span className="sr-only">CollabBoard</span>
      ) : (
        <span className={cn("font-semibold tracking-tight text-foreground", textSize[size])}>
          Collab<span className="text-brand dark:text-brand-soft">Board</span>
        </span>
      )}
    </span>
  );
}
