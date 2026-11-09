import type { ReactNode } from "react";
import { AvatarStack } from "@/components/common/Avatar";
import { Kbd } from "@/components/common/Kbd";
import { sampleCollaborators } from "@/features/workspace/data/collaborators";
import { toolGroups } from "@/features/workspace/data/tools";
import { SectionHeading } from "./SectionHeading";

interface Step {
  title: string;
  description: string;
  visual: ReactNode;
}

const sketchTools = toolGroups[1]?.slice(0, 5) ?? [];

const steps: Step[] = [
  {
    title: "Create a board",
    description:
      "Start from a blank canvas in one click. No setup and no templates to wade through.",
    visual: (
      <span className="flex items-center gap-1">
        <Kbd>Ctrl</Kbd>
        <Kbd>Alt</Kbd>
        <Kbd>N</Kbd>
      </span>
    ),
  },
  {
    title: "Invite your team",
    description:
      "Share a link or add people by email. They join instantly, right in the browser.",
    visual: <AvatarStack people={sampleCollaborators} extra={4} size="sm" />,
  },
  {
    title: "Sketch and decide",
    description:
      "Draw, annotate and rearrange together until the idea is clear to everyone.",
    visual: (
      <span className="flex items-center gap-1">
        {sketchTools.map(({ id, icon: Icon }) => (
          <span
            key={id}
            className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-card text-foreground/75"
          >
            <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
          </span>
        ))}
      </span>
    ),
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-title"
      className="scroll-mt-16 border-t border-border bg-canvas py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="how-title"
          eyebrow="How it works"
          title="From blank page to shared plan in three steps"
        />

        <ol className="relative mt-14 grid gap-5 md:grid-cols-3">
          <span
            aria-hidden="true"
            className="absolute top-9.5 right-[16%] left-[16%] hidden border-t border-dashed border-border-strong md:block"
          />
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="relative flex flex-col rounded-panel border border-border bg-card p-6 shadow-card"
            >
              <span className="inline-flex size-8 items-center justify-center rounded-full border border-selected-border bg-selected text-sm font-semibold text-selected-foreground">
                {index + 1}
              </span>
              <h3 className="mt-5 text-base font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
              <div
                aria-hidden="true"
                className="mt-6 flex h-10 items-center border-t border-border pt-4"
              >
                {step.visual}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
