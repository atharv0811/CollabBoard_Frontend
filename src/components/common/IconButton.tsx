import type { ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const iconButtonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-tool text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50 aria-pressed:bg-selected aria-pressed:text-selected-foreground",
  {
    variants: {
      variant: {
        ghost: "",
        outline: "border border-border bg-card shadow-xs hover:border-border-strong",
        floating: "surface-floating rounded-[10px] text-foreground hover:bg-accent",
      },
      size: {
        sm: "size-8 [&_svg]:size-4",
        md: "size-9 [&_svg]:size-[1.125rem]",
        lg: "size-10 [&_svg]:size-5",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

interface IconButtonProps extends Omit<ComponentProps<"button">, "children">, VariantProps<typeof iconButtonVariants> {
  icon: LucideIcon;
  label: string;
}

export function IconButton({ icon: Icon, label, variant, size, className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    >
      <Icon aria-hidden="true" strokeWidth={1.75} />
    </button>
  );
}
