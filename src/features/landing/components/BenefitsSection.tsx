import { CircleCheck } from "lucide-react";
import { SectionHeading } from "./SectionHeading";
import { SharePanelPreview } from "./SharePanelPreview";

const benefits = [
  {
    title: "Fewer status meetings",
    description: "Boards keep context in one place, so decisions don't need to wait for a call.",
  },
  {
    title: "Everyone in the same view",
    description: "Live cursors and instant updates mean no one is working from an old screenshot.",
  },
  {
    title: "A calm, focused interface",
    description: "Tools stay out of the way so the canvas — and your ideas — stay front and centre.",
  },
  {
    title: "Nothing to install",
    description: "Works in any modern browser for you and every guest you invite.",
  },
];

export function BenefitsSection() {
  return (
    <section id="about" aria-labelledby="about-title" className="scroll-mt-16 border-t border-border py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:gap-20">
        <div>
          <SectionHeading
            id="about-title"
            align="left"
            eyebrow="Why CollabBoard"
            title="Built for the way teams actually think"
            description="Good ideas rarely arrive fully formed. CollabBoard gives your team a shared space to work them out — loosely at first, then with clarity."
          />

          <ul className="mt-10 grid gap-6 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <li key={benefit.title} className="flex gap-3">
                <CircleCheck
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-brand dark:text-brand-soft"
                  strokeWidth={1.75}
                />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{benefit.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{benefit.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div aria-hidden="true" className="absolute -inset-6 rounded-[1.75rem] bg-dot-grid mask-fade-y sm:-inset-10" />
          <div className="relative mx-auto max-w-md">
            <SharePanelPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
