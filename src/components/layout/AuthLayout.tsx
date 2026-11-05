import type { ReactNode } from "react";
import { CollaboratorCursor } from "@/components/common/CollaboratorCursor";
import { Logo } from "@/components/common/Logo";
import { BoardSketch } from "@/components/illustrations/BoardSketch";
import { paths } from "@/lib/paths";

interface AuthLayoutProps {
  children: ReactNode;
  panelTitle: string;
  panelDescription: string;
}

/**
 * Split layout for login / register: form column on the left, a quiet
 * product panel on the right (lg+). Collapses to a single column on mobile.
 */
export function AuthLayout({ children, panelTitle, panelDescription }: AuthLayoutProps) {
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <header>
          <a href={paths.landing} aria-label="CollabBoard home" className="inline-flex rounded-md">
            <Logo />
          </a>
        </header>

        <main className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[25rem]">{children}</div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>© 2026 CollabBoard</span>
          <span className="flex gap-4">
            <a href={paths.privacy} className="transition-colors hover:text-foreground">
              Privacy
            </a>
            <a href={paths.terms} className="transition-colors hover:text-foreground">
              Terms
            </a>
          </span>
        </footer>
      </div>

      <aside
        aria-label="About CollabBoard"
        className="relative hidden overflow-hidden border-l border-border bg-dot-grid lg:flex lg:flex-col lg:justify-center lg:px-12 xl:px-20"
      >
        <div className="relative mx-auto w-full max-w-xl">
          <div className="relative rounded-panel border border-border bg-card/70 p-6 shadow-floating backdrop-blur-sm">
            <BoardSketch idPrefix="auth-sketch" />
            <CollaboratorCursor name="Lena" tone="rose" className="top-[18%] left-[52%]" />
            <CollaboratorCursor name="Marco" tone="sky" className="bottom-[14%] left-[16%]" />
          </div>

          <div className="mt-10">
            <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground">{panelTitle}</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{panelDescription}</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
