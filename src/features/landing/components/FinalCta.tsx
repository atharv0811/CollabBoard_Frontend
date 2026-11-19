import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { paths } from "@/lib/paths";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="px-4 pb-20 sm:px-6 sm:pb-28">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[1.75rem] border border-border bg-card px-6 py-16 text-center shadow-card sm:py-20">
        <div aria-hidden="true" className="absolute inset-0 bg-dot-grid mask-fade-y opacity-70" />
        <div className="relative mx-auto max-w-2xl">
          <h2 id="cta-title" className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Your next big idea deserves a bigger canvas.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
            Open a board, invite your team and start sketching in under a minute.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to={paths.register} className={buttonVariants({ size: "xl" })}>
              Start drawing for free
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link to={paths.login} className={buttonVariants({ size: "xl", variant: "ghost" })}>
              I already have an account
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
