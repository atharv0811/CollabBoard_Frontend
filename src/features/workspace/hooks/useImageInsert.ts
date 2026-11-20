import { useCallback, useEffect, useRef, type ChangeEvent } from "react";
import { toast } from "sonner";
import { createId } from "@/lib/createId";
import { DEFAULT_STYLE, type ImageElement, type Point } from "../canvas/elements";
import { canvasCenter, canvasToWorld } from "../canvas/viewport";
import { useWorkspaceStore } from "../store/workspaceStore";

/** Largest side of a newly placed image, in screen pixels. */
const MAX_PLACED_SIZE = 480;
/** Images larger than this (in pixels) are downscaled before being stored on the board. */
const MAX_STORED_SIZE = 2048;
const FALLBACK_SIZE = 300;

interface LoadedImage {
  src: string;
  width: number;
  height: number;
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

function decode(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode the image."));
    image.src = src;
  });
}

async function loadImage(file: File): Promise<LoadedImage> {
  if (!file.type.startsWith("image/")) throw new Error("Not an image.");
  const src = await readAsDataUrl(file);
  const image = await decode(src);
  const width = image.naturalWidth || FALLBACK_SIZE;
  const height = image.naturalHeight || FALLBACK_SIZE;

  const scale = MAX_STORED_SIZE / Math.max(width, height);
  if (scale >= 1 || file.type === "image/svg+xml" || file.type === "image/gif") return { src, width, height };

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) return { src, width, height };
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const type = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
  return { src: canvas.toDataURL(type, 0.9), width, height };
}

/**
 * Drives the "Insert image" tool: opens the file picker when the tool is chosen (or the canvas is
 * clicked with it) and places the chosen image on the board.
 */
export function useImageInsert() {
  const inputRef = useRef<HTMLInputElement>(null);
  const placeAtRef = useRef<Point | null>(null);

  const open = useCallback((point?: Point) => {
    placeAtRef.current = point ?? null;
    inputRef.current?.click();
  }, []);

  useEffect(
    () =>
      useWorkspaceStore.subscribe((state, previous) => {
        if (state.activeTool === "image" && previous.activeTool !== "image") open();
      }),
    [open],
  );

  // React has no onCancel for file inputs, so listen for the native event.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const onCancel = () => {
      const store = useWorkspaceStore.getState();
      if (store.activeTool === "image") store.setActiveTool("selection");
    };
    input.addEventListener("cancel", onCancel);
    return () => input.removeEventListener("cancel", onCancel);
  }, []);

  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    let loaded: LoadedImage;
    try {
      loaded = await loadImage(file);
    } catch {
      toast.error("That file couldn't be opened as an image.");
      return;
    }

    const store = useWorkspaceStore.getState();
    const { viewport, canvasSize } = store;
    const maxWorld = Math.min(MAX_PLACED_SIZE, canvasSize.width * 0.8 || Infinity, canvasSize.height * 0.8 || Infinity);
    const fit = Math.min(1, maxWorld / viewport.zoom / Math.max(loaded.width, loaded.height));
    const width = loaded.width * fit;
    const height = loaded.height * fit;
    const center = placeAtRef.current ?? canvasToWorld(viewport, canvasCenter(canvasSize));
    placeAtRef.current = null;

    const element: ImageElement = {
      id: createId(),
      type: "image",
      style: DEFAULT_STYLE,
      x: center.x - width / 2,
      y: center.y - height / 2,
      width,
      height,
      src: loaded.src,
    };
    store.finishDrawing(element);
    store.setSelection([element.id]);
  };

  return { open, inputProps: { ref: inputRef, type: "file", accept: "image/*", hidden: true, onChange } as const };
}
