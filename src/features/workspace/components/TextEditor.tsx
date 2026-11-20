import { useEffect, useRef } from "react";
import { measureText, TEXT_FONT_FAMILY, TEXT_LINE_HEIGHT } from "../canvas/text";
import { worldToCanvas } from "../canvas/viewport";
import type { TextEdit } from "../hooks/useCanvasInteraction";
import { useWorkspaceStore } from "../store/workspaceStore";

interface TextEditorProps {
  edit: TextEdit;
  onChange: (text: string) => void;
  onCommit: () => void;
}

/** A textarea laid exactly over the canvas text it edits, following pan and zoom. */
export function TextEditor({ edit, onChange, onCommit }: TextEditorProps) {
  const viewport = useWorkspaceStore((state) => state.viewport);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;
    const focus = () => {
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    };
    focus();
    // Pointer handling can still move focus after mount; take it back on the next frame.
    const frame = requestAnimationFrame(focus);
    return () => cancelAnimationFrame(frame);
  }, [edit.id]);

  const { zoom } = viewport;
  const position = worldToCanvas(viewport, { x: edit.x, y: edit.y });
  const size = measureText(edit.text || " ", edit.fontSize);

  return (
    <textarea
      ref={ref}
      data-text-editor=""
      aria-label="Text"
      value={edit.text}
      rows={1}
      wrap="off"
      spellCheck={false}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
      onKeyDown={(event) => {
        if (event.key === "Escape" || (event.key === "Enter" && (event.ctrlKey || event.metaKey))) {
          event.preventDefault();
          onCommit();
        }
      }}
      className="absolute m-0 resize-none overflow-hidden border-0 bg-transparent p-0 text-foreground outline-none"
      style={{
        left: position.x,
        top: position.y,
        width: (size.width + edit.fontSize) * zoom,
        height: size.height * zoom,
        fontSize: edit.fontSize * zoom,
        lineHeight: TEXT_LINE_HEIGHT,
        fontFamily: TEXT_FONT_FAMILY,
        whiteSpace: "pre",
      }}
    />
  );
}
