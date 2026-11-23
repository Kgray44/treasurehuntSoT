import { describe, expect, it, vi } from "vitest";
import { loadPageFlipWithOwnedFrames } from "./pageflip-render-lifecycle";

function frameQueue() {
  let next = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    next += 1;
    frames.set(next, callback);
    return next;
  });
  const cancelAnimationFrame = vi.fn((id: number) => frames.delete(id));
  const runNext = (time: number) => {
    const first = frames.entries().next().value;
    if (!first) throw new Error("No scheduled frame");
    const [id, callback] = first;
    frames.delete(id);
    callback(time);
  };
  return { frames, requestAnimationFrame, cancelAnimationFrame, runNext };
}

describe("PageFlip render lifecycle", () => {
  it("keeps one owned frame pending and cancels it when the book is released", () => {
    const queue = frameQueue();
    const engine = {
      update: vi.fn(),
      render: vi.fn(),
      start: vi.fn(),
    };
    const book = {
      render: undefined as typeof engine | undefined,
      loadFromHTML: vi.fn(function (this: { render?: typeof engine }) {
        this.render = engine;
        this.render.start();
      }),
    };
    const pages = [document.createElement("div")];
    const stop = loadPageFlipWithOwnedFrames(book, pages, queue);

    expect(book.loadFromHTML).toHaveBeenCalledExactlyOnceWith(pages);
    expect(book.render).toBe(engine);
    expect(engine.update).toHaveBeenCalledOnce();
    expect(engine.start).not.toHaveBeenCalled();
    expect(queue.frames.size).toBe(1);

    queue.runNext(16);
    queue.runNext(32);
    expect(engine.render.mock.calls).toEqual([[16], [32]]);
    expect(queue.frames.size).toBe(1);
    stop();
    stop();
    expect(queue.frames.size).toBe(0);
    expect(queue.cancelAnimationFrame).toHaveBeenCalledOnce();
  });

  it("releases a scheduled frame if native initialization throws", () => {
    const queue = frameQueue();
    const engine = { update: vi.fn(), render: vi.fn(), start: vi.fn() };
    const book = {
      loadFromHTML() {
        Object.assign(this, { render: engine });
        engine.start();
        throw new Error("PageFlip mount failed");
      },
    };

    expect(() => loadPageFlipWithOwnedFrames(book, [], queue)).toThrow("PageFlip mount failed");
    expect(queue.frames.size).toBe(0);
    expect(queue.cancelAnimationFrame).toHaveBeenCalledOnce();
  });

  it("leaves an unrecognized renderer in control", () => {
    const queue = frameQueue();
    const start = vi.fn();
    const book = {
      loadFromHTML() {
        Object.assign(this, { render: { start } });
        start();
      },
    };

    const stop = loadPageFlipWithOwnedFrames(book, [], queue);
    stop();

    expect(start).toHaveBeenCalledOnce();
    expect(queue.requestAnimationFrame).not.toHaveBeenCalled();
    expect(queue.cancelAnimationFrame).not.toHaveBeenCalled();
  });
});
