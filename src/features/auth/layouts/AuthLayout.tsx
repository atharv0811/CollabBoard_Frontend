import { Link, Outlet, useMatches } from "react-router-dom";
import { CollaboratorCursor } from "@/components/common/CollaboratorCursor";
import { Logo } from "@/components/common/Logo";
import { BoardSketch } from "@/components/illustrations/BoardSketch";
import { paths } from "@/lib/paths";

export interface AuthPanelContent {
  title: string;
  description: string;
}

/** Route `handle` shape read by {@link AuthLayout} to fill the side panel. */
export interface AuthRouteHandle {
  authPanel: AuthPanelContent;
}

function useAuthPanel(): AuthPanelContent | undefined {
  const matches = useMatches();
  for (let i = matches.length - 1; i >= 0; i--) {
    const handle = matches[i].handle as Partial<AuthRouteHandle> | undefined;
    if (handle?.authPanel) return handle.authPanel;
  }
  return undefined;
}

export function AuthLayout() {
  const panel = useAuthPanel();

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <header>
          <Link to={paths.landing} aria-label="CollabBoard home" className="inline-flex rounded-md">
            <Logo />
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-100">
            <Outlet />
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>© 2026 CollabBoard</span>
          <span className="flex gap-4">
            <Link to={paths.privacy} className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link to={paths.terms} className="transition-colors hover:text-foreground">
              Terms
            </Link>
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
            <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground">{panel?.title}</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{panel?.description}</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
