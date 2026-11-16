import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends Omit<ComponentProps<"input">, "type"> {
  label: string;
}

export function Checkbox({ label, id, className, ...props }: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none",
        className,
      )}
    >
      <input id={id} type="checkbox" className="size-4 cursor-pointer rounded border-input accent-brand" {...props} />
      {label}
    </label>
  );
}
