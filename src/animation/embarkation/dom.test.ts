import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SceneHostHandle } from "../hosts/scene-host-types";
import { MusterLanding } from "./dom";

describe("canonical landing geometry and live ownership", () => {
  let main: HTMLElement, landing: MusterLanding;
  const widths = new Map<string, number>();
  const rectangle = function (this: HTMLElement) {
    let contamination = 0;
    for (let p = this.parentElement; p; p = p.parentElement)
      if (p.style.transform && p.style.transform !== "none") contamination += 900;
    return new DOMRect(
      (this.className === "muster-parchment" ? 600 : 620) + contamination,
      120,
      widths.get(this.className) ?? 200,
      160,
    );
  };
  beforeEach(() => {
    widths.clear();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("innerWidth", 1536);
    vi.stubGlobal("innerHeight", 1024);
    main = document.createElement("main");
    main.innerHTML =
      '<article class="muster-parchment"><figure class="muster-cover"></figure><section class="muster-readiness"></section></article><div class="muster-crew-card">Crew</div>';
    document.body.append(main);
    for (const n of main.querySelectorAll<HTMLElement>("*")) {
      n.getBoundingClientRect = rectangle;
      n.getAnimations = () => [];
      n.style.transformOrigin = "0px 0px";
    }
    const host = {
      registerTarget: () => ({ release: vi.fn() }),
      claimRuntimeSurface: ({ element }: { element: Element }) => ({
        status: "granted",
        withProperties: (_p: unknown, fn: (el: Element) => void) => fn(element),
        release: vi.fn(),
      }),
    };
    landing = new MusterLanding(main, host as unknown as SceneHostHandle);
  });
  afterEach(() => {
    landing?.release();
    main?.remove();
    vi.unstubAllGlobals();
  });
  it("removes all cinematic ancestor transforms for a canonical measurement, then restores the frame", () => {
    landing.frame(32.8);
    const parchment = main.querySelector<HTMLElement>(".muster-parchment")!;
    const before = parchment.style.transform;
    expect(before).toContain("matrix3d(");
    landing.measure();
    const cover = landing.rectangles().find((t) => t.name === "muster-cover")!;
    expect(cover.rect.x).toBe(620);
    expect(cover.parent).toBe("muster-parchment");
    expect(parchment.style.transform).toBe(before);
  });
  it("remeasures resized descendants without restarting existing arrival times or replacing nodes", () => {
    const cover = main.querySelector(".muster-cover"),
      before = landing.rectangles();
    landing.frame(33.1);
    widths.set("muster-cover", 310);
    landing.measure();
    const after = landing.rectangles();
    expect(main.querySelector(".muster-cover")).toBe(cover);
    expect(after.find((t) => t.name === "muster-cover")?.rect.width).toBe(310);
    expect(after.map((t) => [t.start, t.catch, t.end])).toEqual(before.map((t) => [t.start, t.catch, t.end]));
  });
  it("registers a new live crew node once while preserving existing sequence ownership", async () => {
    const before = landing.rectangles();
    const node = document.createElement("div");
    node.className = "muster-crew-card";
    node.textContent = "New crew";
    node.getBoundingClientRect = rectangle;
    node.getAnimations = () => [];
    node.style.transformOrigin = "0px 0px";
    main.append(node);
    await Promise.resolve();
    landing.measure();
    const after = landing.rectangles();
    expect(after).toHaveLength(before.length + 1);
    expect(after.slice(0, before.length).map((t) => [t.start, t.catch, t.end])).toEqual(
      before.map((t) => [t.start, t.catch, t.end]),
    );
    landing.release();
    expect(node.style.transform).toBe("");
  });
});
