import type { CanvasElement } from "../canvas/elements";
import type { Bounds } from "../canvas/geometry";
import { elementBounds } from "../canvas/hitTest";
import { padBounds, SELECTION_PADDING, selectionFrame, visibleHandles } from "../canvas/selection";

interface SelectionOverlayProps {
  /** Selected elements as currently displayed (including live move / resize previews) */
  selected: readonly CanvasElement[];
  marquee: Bounds | null;
}

/** Drawn handle size in world units. Hit areas are larger (see handleHitRadius). */
const HANDLE_SIZE = 9;

/**
 * Selection UI drawn on top of the elements. Purely visual: it never becomes
 * element data, ignores pointer events (all hit testing is geometric), and
 * uses theme tokens so it works in light and dark mode.
 */
export function SelectionOverlay({ selected, marquee }: SelectionOverlayProps) {
  const frame = selectionFrame(selected);

  return (
    <g pointerEvents="none">
      {frame.kind !== "none" && (
        <g data-selection="" data-selected-ids={selected.map((element) => element.id).join(" ")}>
          {/* With several elements, outline each one inside the shared box */}
          {selected.length > 1 &&
            selected.map((element) => {
              const box = padBounds(elementBounds(element), SELECTION_PADDING / 2);
              return (
                <rect
                  key={element.id}
                  {...box}
                  className="fill-none stroke-brand/60"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
              );
            })}

          {frame.kind === "box" && (
            <>
              <rect data-selection-box="" {...frame.frame} rx={2} className="fill-none stroke-brand" strokeWidth={1.25} />
              {visibleHandles(frame.frame).map(([id, position]) => (
                <rect
                  key={id}
                  data-handle={id}
                  x={position.x - HANDLE_SIZE / 2}
                  y={position.y - HANDLE_SIZE / 2}
                  width={HANDLE_SIZE}
                  height={HANDLE_SIZE}
                  rx={2}
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
                strokeWidth={frame.element.style.strokeWidth + 6}
                strokeLinecap="round"
              />
              {(["start", "end"] as const).map((endpoint) => (
                <circle
                  key={endpoint}
                  data-endpoint={endpoint}
                  cx={frame.element[endpoint].x}
                  cy={frame.element[endpoint].y}
                  r={HANDLE_SIZE / 2 + 1}
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
          className="fill-brand/8 stroke-brand"
          strokeWidth={1}
          strokeDasharray="5 4"
        />
      )}
    </g>
  );
}
