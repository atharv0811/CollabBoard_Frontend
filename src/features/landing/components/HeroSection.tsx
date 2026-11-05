import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Badge } from "@/components/common/Badge";
import { buttonVariants } from "@/components/ui/button";
import { paths } from "@/lib/paths";
import { ProductPreview } from "./ProductPreview";

const reassurances = ["Free for personal boards", "No credit card required", "Runs in your browser"];

export function HeroSection() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 bg-dot-grid mask-fade-y" />

      <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="brand" size="md" className="mb-6">
            <Sparkles aria-hidden="true" />
            Real-time whiteboarding for teams
          </Badge>

          <h1
            id="hero-title"
            className="text-4xl leading-[1.06] font-semibold tracking-tight text-balance text-foreground sm:text-5xl lg:text-6xl"
          >
            Think it through,{" "}
            <span className="relative inline-block whitespace-nowrap">
              together
              <svg
                aria-hidden="true"
                viewBox="0 0 220 14"
                preserveAspectRatio="none"
                className="absolute -bottom-1.5 left-0 h-2.5 w-full sm:-bottom-2"
              >
                <path
                  d="M3 9c40-6 92-8 140-5 26 1.6 50 3.4 74 1"
                  className="stroke-brand-soft"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </span>{" "}
            on one canvas.
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            CollabBoard is a calm, hand-drawn style whiteboard where your team sketches, plans and decides — in the
            same space, at the same time.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href={paths.workspace} className={buttonVariants({ size: "xl" })}>
              Start drawing
              <ArrowRight aria-hidden="true" />
            </a>
            <a href="#preview" className={buttonVariants({ size: "xl", variant: "outline" })}>
              Explore workspace
            </a>
          </div>

          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {reassurances.map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check aria-hidden="true" className="size-3.5 text-brand dark:text-brand-soft" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div id="preview" className="mt-14 scroll-mt-24 sm:mt-20">
          <ProductPreview />
        </div>
      </div>
    </section>
  );
}
