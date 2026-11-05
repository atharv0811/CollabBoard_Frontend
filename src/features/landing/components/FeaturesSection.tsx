import { Infinity as InfinityIcon, Link2, PenTool, Users, type LucideIcon } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: InfinityIcon,
    title: "Infinite canvas",
    description: "Pan in any direction and zoom from overview to detail. The board grows as your thinking does.",
  },
  {
    icon: Users,
    title: "Real-time collaboration",
    description: "See teammates' cursors and edits as they happen — no refreshing, no version juggling.",
  },
  {
    icon: PenTool,
    title: "Simple drawing tools",
    description: "Shapes, arrows, freehand and text, each one keystroke away. Anyone can learn it in a minute.",
  },
  {
    icon: Link2,
    title: "Easy sharing",
    description: "Send a link to bring anyone in, and choose whether they can view, comment or edit.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-16 border-t border-border py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="features-title"
          eyebrow="Features"
          title="Everything you need to get ideas out of your head"
          description="A focused set of tools that stay out of your way, so the conversation — not the software — leads."
        />

        <ul className="mt-14 grid gap-px overflow-hidden rounded-panel border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, description }) => (
            <li key={title} className="group bg-card p-6 transition-colors duration-150 hover:bg-accent/60 sm:p-7">
              <span className="inline-flex size-10 items-center justify-center rounded-lg border border-selected-border bg-selected text-selected-foreground">
                <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
              </span>
              <h3 className="mt-5 text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
