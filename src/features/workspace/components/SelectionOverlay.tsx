import type { CanvasElement } from "../canvas/elements";
import type { Bounds } from "../canvas/geometry";
import { elementBounds } from "../canvas/hitTest";
import {
  padBounds,
  SELECTION_PADDING,
  selectionFrame,
  visibleHandles,
} from "../canvas/selection";

interface SelectionOverlayProps {
  selected: readonly CanvasElement[];
  marquee: Bounds | null;
  /** Current zoom: overlay sizes are screen px, so they are divided by it. */
  zoom: number;
}

/** Drawn handle size in screen px. */
const HANDLE_SIZE = 9;

/** Overlay strokes keep a constant on-screen width at any zoom. */
const screenStroke = { vectorEffect: "non-scaling-stroke" } as const;

export function SelectionOverlay({ selected, marquee, zoom }: SelectionOverlayProps) {
  const frame = selectionFrame(selected, zoom);
  const px = (value: number) => value / zoom;
  const dash = (on: number, off: number) => `${px(on)} ${px(off)}`;
  const handle = px(HANDLE_SIZE);

  return (
    <g pointerEvents="none">
      {frame.kind !== "none" && (
        <g
          data-selection=""
          data-selected-ids={selected.map((element) => element.id).join(" ")}
        >
          {selected.length > 1 &&
            selected.map((element) => {
              const box = padBounds(
                elementBounds(element),
                px(SELECTION_PADDING / 2),
              );
              return (
                <rect
                  key={element.id}
                  {...box}
                  {...screenStroke}
                  className="fill-none stroke-brand/60"
                  strokeWidth={1}
                  strokeDasharray={dash(4, 3)}
                />
              );
            })}

          {frame.kind === "box" && (
            <>
              <rect
                data-selection-box=""
                {...frame.frame}
                {...screenStroke}
                rx={px(2)}
                className="fill-none stroke-brand"
                strokeWidth={1.25}
              />
              {visibleHandles(frame.frame, zoom).map(([id, position]) => (
                <rect
                  key={id}
                  data-handle={id}
                  {...screenStroke}
                  x={position.x - handle / 2}
                  y={position.y - handle / 2}
                  width={handle}
                  height={handle}
                  rx={px(2)}
                  className="fill-card stroke-brand"
                  strokeWidth={1.5}
                />
              ))}
            </>
          )}

          {frame.kind === "endpoints" && (
            <>
              <line
                x1={frame.element.start.x}
                y1={frame.element.start.y}
                x2={frame.element.end.x}
                y2={frame.element.end.y}
                className="stroke-brand/40"
                strokeWidth={frame.element.style.strokeWidth + px(6)}
                strokeLinecap="round"
              />
              {(["start", "end"] as const).map((endpoint) => (
                <circle
                  key={endpoint}
                  data-endpoint={endpoint}
                  {...screenStroke}
                  cx={frame.element[endpoint].x}
                  cy={frame.element[endpoint].y}
                  r={handle / 2 + px(1)}
                  className="fill-card stroke-brand"
                  strokeWidth={1.5}
                />
              ))}
            </>
          )}
        </g>
      )}

      {marquee && (
        <rect
          data-marquee=""
          {...marquee}
          {...screenStroke}
          className="fill-brand/8 stroke-brand"
          strokeWidth={1}
          strokeDasharray={dash(5, 4)}
        />
      )}
    </g>
  );
}
