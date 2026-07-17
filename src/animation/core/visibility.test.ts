import { afterEach, describe, expect, it, vi } from "vitest";
import { observeDocumentVisibility, observeElementVisibility } from "./visibility";

describe("animation visibility policy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  it("reports document visibility changes and removes its listener", () => {
    const onChange = vi.fn();
    const stop = observeDocumentVisibility(onChange);
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(onChange).toHaveBeenCalledWith(false);
    stop();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("uses IntersectionObserver when supported and disconnects on cleanup", () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    let callback!: (entries: Array<{ isIntersecting: boolean }>) => void;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(next: typeof callback) {
          callback = next;
        }
        observe = observe;
        disconnect = disconnect;
      },
    );
    const element = document.createElement("div");
    const onChange = vi.fn();
    const stop = observeElementVisibility(element, onChange);
    callback([{ isIntersecting: false }]);
    expect(observe).toHaveBeenCalledWith(element);
    expect(onChange).toHaveBeenCalledWith(false);
    stop();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
