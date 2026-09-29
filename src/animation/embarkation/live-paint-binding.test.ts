import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DOMPaintResources } from "./dom-paint";
vi.mock("./dom-paint", () => ({ freezeDOMPaint: vi.fn(() => ({})) }));
import { LivePaintBinding } from "./live-paint-binding";

describe("canonical content invalidation independent of film frames", () => {
  let node: HTMLElement, child: HTMLElement, binding: LivePaintBinding, resize: () => void;
  let width = 380;
  const decode = vi.fn(async () => ({ dispose: vi.fn() }));
  beforeEach(() => {
    width = 380;
    decode.mockClear();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    node = document.createElement("div");
    node.innerHTML = "<p>Current canonical title</p><section>Independent readiness</section>";
    child = node.querySelector("section")!;
    document.body.append(node);
    binding = new LivePaintBinding(node, { decode } as unknown as DOMPaintResources, {
      rect: () => ({ width, height: 280 }),
      independent: () => new Set([child]),
      overrides: () => new Map([[node, { transform: "none", opacity: "1", filter: "none", visibility: "visible" }]]),
      pixelRatio: () => 1.25,
    });
  });
  afterEach(() => {
    binding.dispose();
    node.remove();
    vi.unstubAllGlobals();
  });
  it("ignores owned animation styles but refreshes actual appearance and content", async () => {
    await binding.paint.flush();
    node.style.transform = "translate3d(20px, 10px, 30px)";
    node.style.opacity = "0";
    await Promise.resolve();
    await binding.paint.flush();
    expect(decode).toHaveBeenCalledTimes(1);
    node.querySelector("p")!.textContent = "Updated canonical title";
    await Promise.resolve();
    await binding.paint.flush();
    expect(decode).toHaveBeenCalledTimes(2);
    node.style.backgroundColor = "teal";
    await Promise.resolve();
    await binding.paint.flush();
    expect(decode).toHaveBeenCalledTimes(3);
  });
  it("does not bake an independent child's update into the parent surface", async () => {
    await binding.paint.flush();
    child.textContent = "Live readiness changed";
    await Promise.resolve();
    await binding.paint.flush();
    expect(decode).toHaveBeenCalledTimes(1);
    expect(child.textContent).toBe("Live readiness changed");
  });
  it("invalidates changed dimensions once and ignores unchanged resize notifications", async () => {
    await binding.paint.flush();
    resize();
    await binding.paint.flush();
    expect(decode).toHaveBeenCalledTimes(1);
    width = 440;
    binding.layoutChanged();
    await binding.paint.flush();
    resize();
    await binding.paint.flush();
    expect(decode).toHaveBeenCalledTimes(2);
    expect(binding.paint.ready).toBe(true);
  });
});
