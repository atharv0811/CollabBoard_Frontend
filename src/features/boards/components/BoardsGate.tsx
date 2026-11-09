import type { ReactNode } from "react";
import { LoaderCircle, TriangleAlert, X } from "lucide-react";
import { Logo } from "@/components/common/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { boardSession } from "../boardSession";
import { useBoardsStore } from "../boardsStore";

export function BoardsGate({ children }: { children: ReactNode }) {
  const phase = useBoardsStore((state) => state.phase);
  const startupError = useBoardsStore((state) => state.startupError);

  if (phase === "ready") return <>{children}</>;

  return (
    <div className="flex h-svh w-full items-center justify-center bg-dot-grid px-4 text-foreground">
      <div
        data-boards-phase={phase}
        className="surface-floating flex w-full max-w-sm flex-col items-center gap-4 p-6 text-center shadow-popover"
      >
        <Logo />
        {phase === "failed" ? (
          <>
            <TriangleAlert aria-hidden="true" className="size-6 text-destructive" />
            <div role="alert">
              <h1 className="text-base font-semibold">Couldn't open your saved boards</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Your boards haven't been changed. {startupError}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2">
              <Button onClick={() => void boardSession.retryStart()}>Try again</Button>
              <Button variant="ghost" onClick={() => boardSession.startTemporary()}>
                Continue without saving
              </Button>
            </div>
          </>
        ) : (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Opening your boards…
          </p>
        )}
      </div>
    </div>
  );
}

export function BoardNotice({ className }: { className?: string }) {
  const notice = useBoardsStore((state) => state.notice);
  const dismissNotice = useBoardsStore((state) => state.dismissNotice);
  if (!notice) return null;

  return (
    <div
      role="alert"
      data-board-notice=""
      className={cn(
        "surface-floating pointer-events-auto flex max-w-[calc(100vw-2rem)] items-start gap-2 py-2 pr-1.5 pl-3 text-xs text-foreground shadow-popover",
        className,
      )}
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-destructive" />
      <span className="flex-1 leading-relaxed">{notice}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismissNotice}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}
