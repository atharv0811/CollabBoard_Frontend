import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { CircleCheck, Info, Loader2, OctagonX, TriangleAlert } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

const Toaster = (props: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheck className="size-4 text-success" />,
        info: <Info className="size-4 text-link" />,
        warning: <TriangleAlert className="size-4 text-tone-amber" />,
        error: <OctagonX className="size-4 text-destructive" />,
        loading: <Loader2 className="size-4 animate-spin text-muted-foreground" />,
      }}
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--panel-radius)",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "font-sans text-[0.8125rem] font-medium shadow-floating! gap-2.5!",
          description: "text-muted-foreground! font-normal",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
