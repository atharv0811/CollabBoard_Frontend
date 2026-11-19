import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface InputProps extends ComponentProps<"input"> {
  icon?: LucideIcon;
  trailing?: ReactNode;
}

export function Input({ icon: Icon, trailing, className, ...props }: InputProps) {
  return (
    <div className="group/input relative flex items-center">
      {Icon && (
        <Icon
          aria-hidden="true"
          className="pointer-events-none absolute left-3 size-4 text-muted-foreground transition-colors group-focus-within/input:text-brand"
        />
      )}
      <input
        className={cn(
          "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-xs transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-subtle-foreground",
          "hover:border-border-strong focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:ring-destructive/30",
          Icon && "pl-9",
          trailing ? "pr-10" : null,
          className,
        )}
        {...props}
      />
      {trailing && <div className="absolute right-1.5 flex items-center">{trailing}</div>}
    </div>
  );
}
