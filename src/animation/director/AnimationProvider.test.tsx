import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionConfigContext } from "motion/react";
import { useContext } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMotionMode } from "../motion/useMotionMode";
import { AnimationDirector } from "./AnimationDirector";
import { AnimationProvider } from "./AnimationProvider";

function createMediaController(initialMatches = false) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const addEventListener = vi.fn((type: string, listener: (event: MediaQueryListEvent) => void) => {
    if (type === "change") listeners.add(listener);
  });
  const removeEventListener = vi.fn((type: string, listener: (event: MediaQueryListEvent) => void) => {
    if (type === "change") listeners.delete(listener);
  });
  const query = {
    get matches() {
      return matches;
    },
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener,
    removeEventListener,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  } as unknown as MediaQueryList;
  return {
    query,
    addEventListener,
    removeEventListener,
    setMatches(next: boolean) {
      matches = next;
      const event = { matches: next, media: query.media } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

function PolicyProbe({ name }: { name: string }) {
  const motion = useMotionMode();
  const motionConfig = useContext(MotionConfigContext);
  return (
    <section
      data-testid={`probe-${name}`}
      data-level={motion.mode}
      data-product={motion.productMode}
      data-system-reduced={String(motion.systemReduced)}
      data-source-product={motion.policy.source.productSetting}
      data-source-browser={String(motion.policy.source.browserPrefersReduced)}
      data-motion-config={motionConfig.reducedMotion}
    >
      <button onClick={() => motion.setMode("gentle")}>Set gentle {name}</button>
      <button onClick={() => motion.setMode("reduced")}>Set reduced {name}</button>
      <button onClick={motion.cycle}>Cycle {name}</button>
    </section>
  );
}

describe("AnimationProvider resolved motion authority", () => {
  let media = createMediaController();
  let matchMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    media = createMediaController();
    matchMedia = vi.fn(() => media.query);
    Object.defineProperty(window, "matchMedia", { configurable: true, value: matchMedia });
    localStorage.clear();
    document.documentElement.removeAttribute("data-motion-level");
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.removeAttribute("data-motion-level");
    vi.restoreAllMocks();
  });

  it("rejects invalid persisted settings and owns one browser preference subscription", async () => {
    localStorage.setItem("forever-motion", "untrusted-value");
    const rendered = render(
      <AnimationProvider>
        <PolicyProbe name="only" />
      </AnimationProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("probe-only")).toHaveAttribute("data-level", "full"));
    expect(screen.getByTestId("probe-only")).toHaveAttribute("data-motion-config", "never");
    expect(localStorage.getItem("forever-motion")).toBeNull();
    expect(matchMedia).toHaveBeenCalledOnce();
    expect(media.addEventListener).toHaveBeenCalledOnce();
    expect(document.documentElement).toHaveAttribute("data-motion-level", "full");

    rendered.unmount();
    expect(media.removeEventListener).toHaveBeenCalledOnce();
    expect(document.documentElement).not.toHaveAttribute("data-motion-level");
  });

  it("shares product state across same-tab consumers and propagates media changes", async () => {
    localStorage.setItem("forever-motion", "gentle");
    render(
      <AnimationProvider>
        <PolicyProbe name="first" />
        <PolicyProbe name="second" />
      </AnimationProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("probe-first")).toHaveAttribute("data-level", "gentle"));
    expect(screen.getByTestId("probe-second")).toHaveAttribute("data-product", "gentle");
    expect(screen.getByTestId("probe-first")).toHaveAttribute("data-motion-config", "never");

    act(() => media.setMatches(true));
    await waitFor(() => expect(screen.getByTestId("probe-first")).toHaveAttribute("data-level", "reduced"));
    expect(screen.getByTestId("probe-second")).toHaveAttribute("data-product", "gentle");
    expect(screen.getByTestId("probe-second")).toHaveAttribute("data-system-reduced", "true");
    expect(screen.getByTestId("probe-second")).toHaveAttribute("data-motion-config", "always");
    expect(document.documentElement).toHaveAttribute("data-motion-level", "reduced");

    act(() => media.setMatches(false));
    await waitFor(() => expect(screen.getByTestId("probe-first")).toHaveAttribute("data-level", "gentle"));
    fireEvent.click(screen.getByRole("button", { name: "Set reduced first" }));
    expect(screen.getByTestId("probe-first")).toHaveAttribute("data-product", "reduced");
    expect(screen.getByTestId("probe-second")).toHaveAttribute("data-product", "reduced");
    expect(localStorage.getItem("forever-motion")).toBe("reduced");
  });

  it("propagates the full policy without recreating or replaying when both sources resolve reduced", async () => {
    localStorage.setItem("forever-motion", "reduced");
    const setMotionPolicy = vi.spyOn(AnimationDirector.prototype, "setMotionPolicy");
    const setMode = vi.spyOn(AnimationDirector.prototype, "setMode");
    const play = vi.spyOn(AnimationDirector.prototype, "play");
    render(
      <AnimationProvider>
        <PolicyProbe name="only" />
      </AnimationProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("probe-only")).toHaveAttribute("data-level", "reduced"));
    await waitFor(() =>
      expect(setMotionPolicy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          level: "reduced",
          source: { productSetting: "reduced", browserPrefersReduced: false },
          allowSpatialTravel: false,
          preserveSemanticStaging: true,
        }),
      ),
    );

    act(() => media.setMatches(true));
    await waitFor(() => expect(screen.getByTestId("probe-only")).toHaveAttribute("data-source-browser", "true"));
    expect(screen.getByTestId("probe-only")).toHaveAttribute("data-source-product", "reduced");
    await waitFor(() =>
      expect(setMotionPolicy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          level: "reduced",
          source: { productSetting: "reduced", browserPrefersReduced: true },
        }),
      ),
    );

    const levels = setMotionPolicy.mock.calls.map(([nextPolicy]) => nextPolicy.level);
    const levelTransitions = levels.filter((level, index) => index > 0 && level !== levels[index - 1]);
    expect(levelTransitions).toEqual(["reduced"]);
    expect(new Set(setMotionPolicy.mock.instances).size).toBe(1);
    expect(setMode).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it("does not remove a root motion attribute owned by a later provider", () => {
    const first = render(
      <AnimationProvider>
        <PolicyProbe name="first" />
      </AnimationProvider>,
    );
    const second = render(
      <AnimationProvider>
        <PolicyProbe name="second" />
      </AnimationProvider>,
    );

    first.unmount();
    expect(document.documentElement).toHaveAttribute("data-motion-level", "full");
    second.unmount();
    expect(document.documentElement).not.toHaveAttribute("data-motion-level");
  });
});
