// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IndexImageTracker, type IndexImageObservation, type IndexModelAnchor } from "./index-image-tracker";
import { defaultReachRuntimePolicy } from "./runtime-policy";

// D0 ReactDOM + real optical/controller/evidence integration. No camera, neural
// recognition, physical accuracy, or owner-acceptance claim.
const fixture = vi.hoisted(() => ({
  runtimes: [] as { image: (o: IndexImageObservation) => void; status: (value: string) => void }[],
}));
vi.mock("./runtime-policy-client", () => ({
  useReachRuntimePolicy: () => ({ status: "READY", revision: 0, policy: defaultReachRuntimePolicy, refresh() {} }),
}));
vi.mock("./ReachStage", () => ({ ReachStage: () => null }));
vi.mock("motion/react", async () => {
  const React = await import("react");
  return {
    motion: {
      div: React.forwardRef<HTMLDivElement, ComponentProps<"div"> & { animate?: unknown; initial?: unknown }>(
        function StaticDiv({ animate: _animate, initial: _initial, ...props }, ref) {
          void _animate;
          void _initial;
          return React.createElement("div", { ...props, ref });
        },
      ),
    },
  };
});
vi.mock("./browser-runtime", () => ({
  ReachBrowserRuntime: class {
    constructor(
      _video: unknown,
      _observe: unknown,
      public status: (value: string) => void,
      _media: unknown,
      _raw: unknown,
      public image: (o: IndexImageObservation) => void,
    ) {
      fixture.runtimes.push(this);
    }
    start = async () => this.status("READY");
    stop = () => this.status("DISABLED");
    resources = () => ({ workers: 1, tracks: 1, timers: 0 });
    setTrackingLimits() {}
    setCalibrationCollecting() {}
    setIndexTrackingEnabled() {}
    trackingPacing = () => null;
    captureDiagnostics = () => null;
  },
}));
import { ReachLaboratory } from "./ReachLaboratory";

const binding = {
  providerGeneration: 1,
  cameraLeaseId: "synthetic-continuity-camera",
  cameraFrameVersion: 1,
  frameWidth: 320,
  frameHeight: 240,
  mirrorTransform: "PREVIEW_X" as const,
};
const normalized = (x = 60, y = 60) => ({ x: x / 159, y: y / 119 });
function pixels(x: number, y: number, capture: number, blank = false, unrelated = false) {
  const data = new Uint8Array(160 * 120).fill(30);
  if (!blank)
    for (let dy = -10; dy <= 10; ++dy)
      for (let dx = -10; dx <= 10; ++dx)
        data[(y + dy) * 160 + x + dx] =
          45 + ((dx * 73 + dy * 127 + dx * dy * 19 + (unrelated ? 19 * 41 : 0) + 100000) % 135);
  return { data, width: 160, height: 120, capture, received: capture + 1 };
}
function conditionedModel(x: number): IndexModelAnchor {
  const point = normalized(x);
  return {
    point,
    pointing: true,
    contrary: false,
    authority: "POINT",
    authoritySource: "synthetic-full-hand-same-camera-track-generation",
    geometry: {
      index: [
        { x: point.x, y: point.y + 0.18, z: 0 },
        { x: point.x, y: point.y + 0.12, z: -0.02 },
        { x: point.x, y: point.y + 0.06, z: -0.04 },
        { x: point.x, y: point.y, z: -0.06 },
      ],
      palmSpan: 0.15,
    },
  };
}
function deliver(
  tracker: IndexImageTracker,
  options: { x?: number; blank?: boolean; manual?: boolean; conditioned?: boolean; unrelated?: boolean } = {},
) {
  let observation!: IndexImageObservation;
  act(() => {
    vi.advanceTimersByTime(50);
    const x = options.x ?? 60;
    observation = tracker.update(
      pixels(x, 60, performance.now(), options.blank, options.unrelated),
      options.conditioned ? conditionedModel(x) : { point: normalized(x), pointing: true, contrary: false },
      options.manual ? normalized(x) : null,
    );
    fixture.runtimes[0].image(observation);
  });
  return observation;
}
function openAndSaveFirst(tracker: IndexImageTracker, manual = false, conditioned = false) {
  render(<ReachLaboratory />);
  fireEvent.click(screen.getByRole("button", { name: "Enable live camera" }));
  let last = deliver(tracker, { manual, conditioned });
  for (let i = 0; i < 7; ++i) last = deliver(tracker, { conditioned });
  fireEvent.click(screen.getByRole("button", { name: "Set up relative movement" }));
  expect(screen.getByLabelText("Target 1 of 5")).toBeInTheDocument();
  for (let i = 0; i < 32; ++i) last = deliver(tracker, { conditioned });
  expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
  return last;
}
beforeEach(() => {
  fixture.runtimes = [];
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "Date", "performance"] });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true })),
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(500);
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("relative calibration optical source across target 1 → 2", () => {
  it("keeps the completed first target across its 700ms transition and same-reference motion", () => {
    const tracker = new IndexImageTracker(binding);
    const first = openAndSaveFirst(tracker);
    let next = first;
    for (let i = 0; i < 14; ++i) next = deliver(tracker, { x: 60 - Math.min(i, 6) });
    expect(next).toMatchObject({ state: "TRACKING", trackId: first.trackId, trackGeneration: first.trackGeneration });
    expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps target2 and the established finger through conditioned full-hand assistance and a new optical epoch", () => {
    const tracker = new IndexImageTracker(binding);
    const first = openAndSaveFirst(tracker, false, true);
    const motion: IndexImageObservation[] = [];
    // D0 fresh full-hand geometry remains coherent while a different image
    // appearance prevents the old reference from matching. No fit, controller
    // identity or completed sample is replaced by this producer transition.
    for (let i = 0; i < 30; ++i) motion.push(deliver(tracker, { x: 60 + i, conditioned: true, unrelated: true }));
    expect(motion.every((o) => o.state === "TRACKING" && o.trackId === first.trackId)).toBe(true);
    expect(motion.some((o) => o.coordinateSource === "MODEL")).toBe(true);
    expect(motion.at(-1)!.coordinateSource).toBe("FUSED");
    expect(motion.at(-1)!.opticalEpoch).toBeGreaterThan(first.opticalEpoch!);
    expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
    expect(screen.getByText(/1 of 5 targets saved/)).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explains the reset only after optical expiry and a genuinely new automatic anchor", () => {
    const tracker = new IndexImageTracker(binding);
    const first = openAndSaveFirst(tracker);
    // Current model results remain fresh, but blank pixels cannot renew optical identity.
    for (let i = 0; i < 28; ++i) deliver(tracker, { blank: true });
    expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
    let next = deliver(tracker);
    for (let i = 0; i < 7; ++i) next = deliver(tracker);
    expect(next.state).toBe("TRACKING");
    expect(next.trackId).not.toBe(first.trackId);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Fingertip identity could not be preserved through the tracking loss or new selection. Begin a fresh setup; saved samples cannot transfer to an unverified finger.",
    );
    expect(document.querySelector("[data-step=PREPARE]")).not.toBeNull();
    expect(screen.queryByLabelText("Target 2 of 5")).not.toBeInTheDocument();
  });

  it("keeps saved targets paused after manual identity expiry without borrowing a model tip", () => {
    const tracker = new IndexImageTracker(binding);
    openAndSaveFirst(tracker, true);
    for (let i = 0; i < 28; ++i) deliver(tracker, { blank: true });
    let next = deliver(tracker);
    for (let i = 0; i < 7; ++i) next = deliver(tracker);
    expect(next).toMatchObject({ point: null, trackId: null, reason: "MANUAL_SELECTION_REQUIRED" });
    expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(["new manual selection", "new camera lease"])("never transfers saved samples to a %s", (change) => {
    const tracker = new IndexImageTracker(binding);
    const first = openAndSaveFirst(tracker);
    for (let i = 0; i < 8; ++i) {
      act(() => {
        vi.advanceTimersByTime(50);
        const next = tracker.update(
          pixels(60, 60, performance.now()),
          { point: normalized(), pointing: true, contrary: false },
          change === "new manual selection" && i === 0 ? normalized() : null,
        );
        expect(next.state).toBe("TRACKING");
        if (change === "new manual selection") expect(next.trackId).not.toBe(first.trackId);
        fixture.runtimes[0].image(
          change === "new camera lease" ? { ...next, cameraLeaseId: "new-synthetic-camera-lease" } : next,
        );
      });
    }
    expect(screen.getByRole("alert")).toHaveTextContent(
      change === "new camera lease"
        ? "The camera or its image geometry changed. Begin a fresh setup for this camera."
        : "Fingertip identity could not be preserved through the tracking loss or new selection.",
    );
    expect(document.querySelector("[data-step=PREPARE]")).not.toBeNull();
    expect(screen.queryByLabelText("Target 2 of 5")).not.toBeInTheDocument();
  });
});
