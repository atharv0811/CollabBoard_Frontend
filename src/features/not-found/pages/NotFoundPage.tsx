import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/common/Logo";
import { buttonVariants } from "@/components/ui/button";
import { paths } from "@/lib/paths";

export default function NotFoundPage() {
  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      <div aria-hidden="true" className="absolute inset-0 bg-dot-grid mask-fade-y" />

      <header className="relative px-4 py-6 sm:px-10">
        <Link to={paths.landing} aria-label="CollabBoard home" className="inline-flex rounded-md">
          <Logo />
        </Link>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 pb-24">
        <div className="max-w-md text-center">
          <p className="text-sm font-medium text-link">404</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            This page isn&apos;t on the board
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            The link may be broken, or the page may not exist yet.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to={paths.landing} className={buttonVariants({ size: "lg" })}>
              <ArrowLeft aria-hidden="true" />
              Back to home
            </Link>
            <Link to={paths.workspace} className={buttonVariants({ size: "lg", variant: "outline" })}>
              Open workspace
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
