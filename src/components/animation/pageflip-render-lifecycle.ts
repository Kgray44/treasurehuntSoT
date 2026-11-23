type FrameOwner = Pick<Window, "requestAnimationFrame" | "cancelAnimationFrame">;

type PageFlipLoader = {
  loadFromHTML(pages: HTMLElement[]): void;
};

type PageFlipRenderer = {
  start(): void;
  update(): void;
  render(now: number): void;
};

function isPageFlipRenderer(value: unknown): value is PageFlipRenderer {
  if (!value || typeof value !== "object") return false;
  const renderer = value as Partial<PageFlipRenderer>;
  return (
    typeof renderer.start === "function" &&
    typeof renderer.update === "function" &&
    typeof renderer.render === "function"
  );
}

/**
 * StPageFlip 2.0.7 starts a self-scheduling callback in loadFromHTML and
 * never stops it in destroy. Replace only that instance's startup while
 * loading, then drive the same render method with an owned callback.
 */
export function loadPageFlipWithOwnedFrames(book: PageFlipLoader, pages: HTMLElement[], owner: FrameOwner) {
  const originalRenderer = Object.getOwnPropertyDescriptor(book, "render");
  let renderer: unknown = originalRenderer?.value;
  let assigned = false;
  let restoreStart: (() => void) | undefined;
  let stopFrames: (() => void) | undefined;

  const canReplaceRenderer =
    !originalRenderer || (originalRenderer.configurable && Object.hasOwn(originalRenderer, "value"));
  const hooked =
    canReplaceRenderer &&
    Reflect.defineProperty(book, "render", {
      configurable: true,
      get: () => renderer,
      set(value: unknown) {
        renderer = value;
        assigned = true;
        if (restoreStart || !isPageFlipRenderer(value)) return;

        const originalStart = Object.getOwnPropertyDescriptor(value, "start");
        let active = true;
        let frame: number | null = null;
        const draw: FrameRequestCallback = (now) => {
          frame = null;
          if (!active) return;
          value.render(now);
          if (active) frame = owner.requestAnimationFrame(draw);
        };
        if (
          !Reflect.defineProperty(value, "start", {
            configurable: true,
            value() {
              value.update();
              frame = owner.requestAnimationFrame(draw);
            },
          })
        ) {
          return;
        }
        restoreStart = () => {
          if (originalStart) Reflect.defineProperty(value, "start", originalStart);
          else Reflect.deleteProperty(value, "start");
        };
        stopFrames = () => {
          active = false;
          if (frame !== null) owner.cancelAnimationFrame(frame);
          frame = null;
        };
      },
    });

  try {
    book.loadFromHTML(pages);
  } catch (error) {
    stopFrames?.();
    throw error;
  } finally {
    restoreStart?.();
    if (hooked) {
      if (originalRenderer || assigned) {
        Reflect.defineProperty(book, "render", {
          configurable: originalRenderer?.configurable ?? true,
          enumerable: originalRenderer?.enumerable ?? true,
          writable: originalRenderer?.writable ?? true,
          value: renderer,
        });
      } else {
        Reflect.deleteProperty(book, "render");
      }
    }
  }

  return () => stopFrames?.();
}
