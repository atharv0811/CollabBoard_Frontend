import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva("rounded-panel border border-border bg-card text-card-foreground", {
  variants: {
    elevation: {
      flat: "",
      raised: "shadow-card",
      floating: "shadow-floating",
      popover: "shadow-popover",
    },
    padding: {
      none: "",
      md: "p-5",
      lg: "p-6 sm:p-8",
    },
  },
  defaultVariants: { elevation: "raised", padding: "md" },
});

type CardProps = ComponentProps<"div"> & VariantProps<typeof cardVariants>;

export function Card({ className, elevation, padding, ...props }: CardProps) {
  return <div className={cn(cardVariants({ elevation, padding }), className)} {...props} />;
}
