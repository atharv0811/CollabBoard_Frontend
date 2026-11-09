import { useLayoutEffect, useRef, useState, type RefObject } from "react";

export interface CanvasViewportSize {
  width: number;
  height: number;
}

export interface CanvasViewport<T extends Element> extends CanvasViewportSize {
  ref: RefObject<T | null>;
  isReady: boolean;
}

const EMPTY_SIZE: CanvasViewportSize = { width: 0, height: 0 };

function readSize(element: Element): CanvasViewportSize {
  const { width, height } = element.getBoundingClientRect();
  return { width, height };
}

export function useCanvasViewport<T extends Element = HTMLElement>(): CanvasViewport<T> {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<CanvasViewportSize>(EMPTY_SIZE);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = (next: CanvasViewportSize) => {
      setSize((previous) =>
        previous.width === next.width && previous.height === next.height ? previous : next,
      );
    };

    update(readSize(element));

    const observer = new ResizeObserver(() => update(readSize(element)));
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return {
    ref,
    width: size.width,
    height: size.height,
    isReady: size.width > 0 && size.height > 0,
  };
}
