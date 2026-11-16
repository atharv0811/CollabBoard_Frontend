import { cn } from "@/lib/utils";

interface BoardSketchProps {
  idPrefix?: string;
  className?: string;
}

const shape = "fill-card stroke-foreground/65";
const label = "fill-foreground text-[13px] font-medium";
const connector = "stroke-foreground/55";

export function BoardSketch({ idPrefix = "sketch", className }: BoardSketchProps) {
  const arrowId = `${idPrefix}-arrow`;
  const marker = `url(#${arrowId})`;

  return (
    <svg
      viewBox="0 0 720 340"
      fill="none"
      aria-hidden="true"
      className={cn("h-auto w-full", className)}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        <marker
          id={arrowId}
          viewBox="0 0 10 10"
          refX="8.5"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M1 1 9 5 1 9" className="stroke-foreground/55" strokeWidth="1.6" fill="none" />
        </marker>
      </defs>

      {/* Sticky note */}
      <g transform="rotate(-3 120 110)">
        <rect
          x="40"
          y="46"
          width="164"
          height="124"
          rx="6"
          className="fill-note stroke-note-border"
          strokeWidth="1.25"
        />
        <text x="58" y="78" className="fill-foreground text-[13px] font-semibold">
          Kickoff notes
        </text>
        <text x="58" y="104" className="fill-foreground/75 text-[12px]">
          • Map the user journey
        </text>
        <text x="58" y="126" className="fill-foreground/75 text-[12px]">
          • Agree on v1 scope
        </text>
        <text x="58" y="148" className="fill-foreground/75 text-[12px]">
          • Owners by Friday
        </text>
      </g>

      {/* Research */}
      <rect x="262" y="66" width="148" height="62" rx="12" className={shape} strokeWidth="1.6" />
      <text x="336" y="102" textAnchor="middle" className={label}>
        Research
      </text>

      {/* Decision */}
      <path d="M556 42 612 97 556 152 500 97Z" className="fill-selected stroke-brand" strokeWidth="1.8" />
      <text x="556" y="102" textAnchor="middle" className="fill-selected-foreground text-[13px] font-semibold">
        Ready?
      </text>

      {/* Prototype */}
      <rect x="262" y="220" width="148" height="62" rx="12" className={shape} strokeWidth="1.6" />
      <text x="336" y="256" textAnchor="middle" className={label}>
        Prototype
      </text>

      {/* Ship */}
      <ellipse cx="556" cy="251" rx="80" ry="34" className={shape} strokeWidth="1.6" />
      <text x="556" y="256" textAnchor="middle" className={label}>
        Ship v1
      </text>

      {/* Connectors */}
      <path d="M414 97H494" className={connector} strokeWidth="1.6" markerEnd={marker} />
      <path d="M336 132V214" className={connector} strokeWidth="1.6" markerEnd={marker} />
      <path d="M414 251H470" className={connector} strokeWidth="1.6" markerEnd={marker} />
      <path d="M556 156V211" className={connector} strokeWidth="1.6" markerEnd={marker} />
      <text x="566" y="190" className="fill-muted-foreground text-[11px]">
        yes
      </text>

      {/* Freehand annotation */}
      <path d="M70 262c14-12 26 10 40-2s26 10 40-2 26 10 40-2" className="stroke-brand" strokeWidth="2.2" />
      <text x="70" y="244" className="fill-muted-foreground text-[12px] italic">
        needs a second look
      </text>
      <path d="M196 252c22-4 40-6 58-4" className="stroke-brand/70" strokeWidth="1.6" strokeDasharray="3 5" />
    </svg>
  );
}
