// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IndexImageTracker, type IndexImageObservation, type IndexModelAnchor } from "./index-image-tracker";
import { defaultReachRuntimePolicy } from "./runtime-policy";
import { SampleWindow } from "./sample-window";
import { IndexImageReadiness } from "./index-image-readiness";
import { ActiveHandSelector, type HandObservation } from "./observation";
import { syntheticObservation } from "./synthetic";
import * as calibrationModule from "./calibration";

// D0 ReactDOM + real optical/controller/evidence integration. No camera, neural
// recognition, physical accuracy, or owner-acceptance claim.
const fixture = vi.hoisted(() => ({
  runtimes: [] as {
    image: (o: IndexImageObservation) => void;
    observe: (o: HandObservation) => void;
    status: (value: string) => void;
    setCalibrationCollecting: (collecting: boolean) => void;
  }[],
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
      public observe: (o: HandObservation) => void,
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
    setCalibrationCollecting = vi.fn();
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
const conditionedSource = "synthetic-full-hand-same-camera-track-generation";
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
    authoritySource: conditionedSource,
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
function indexOnlyModel(x: number, source = conditionedSource): IndexModelAnchor {
  const full = conditionedModel(x);
  return {
    point: full.point,
    pointing: true,
    contrary: false,
    indexCue: { source, index: full.geometry!.index },
  };
}
function deliver(
  tracker: IndexImageTracker,
  options: {
    x?: number;
    y?: number;
    blank?: boolean;
    manual?: boolean;
    conditioned?: boolean;
    unrelated?: boolean;
    cue?: boolean;
    cueSource?: string;
    originAge?: number;
    currentHandIdentity?: boolean;
    anatomyUncertain?: boolean;
    currentIndexIdentity?: boolean;
  } = {},
) {
  let observation!: IndexImageObservation;
  act(() => {
    vi.advanceTimersByTime(50);
    const x = options.x ?? 60;
    const y = options.y ?? 60;
    const anchor = options.anatomyUncertain
      ? {
          point: null,
          pointing: false,
          contrary: false,
          authority: "AMBIGUOUS" as const,
          authoritySource: conditionedSource,
        }
      : options.cue
        ? indexOnlyModel(x, options.cueSource)
        : options.conditioned
          ? conditionedModel(x)
          : { point: normalized(x, y), pointing: true, contrary: false };
    observation = tracker.update(
      pixels(x, y, performance.now(), options.blank, options.unrelated),
      {
        ...anchor,
        ...(options.currentHandIdentity ? { identitySource: conditionedSource } : {}),
        ...(options.currentIndexIdentity
          ? {
              indexIdentityGeometry: {
                source: conditionedSource,
                index: conditionedModel(x).geometry!.index,
              },
            }
          : {}),
      },
      options.manual ? normalized(x) : null,
    );
    if (options.originAge !== undefined)
      observation.monotonicPixelOriginTime = observation.monotonicCaptureTime - options.originAge;
    fixture.runtimes[0].image(observation);
  });
  return observation;
}
function openAndSaveFirst(
  tracker: IndexImageTracker,
  manual = false,
  conditioned = false,
  currentHandIdentity = false,
) {
  render(<ReachLaboratory />);
  fireEvent.click(screen.getByRole("button", { name: "Enable live camera" }));
  let last = deliver(tracker, { manual, conditioned, currentHandIdentity });
  for (let i = 0; i < 7; ++i) last = deliver(tracker, { conditioned, currentHandIdentity });
  fireEvent.click(screen.getByRole("button", { name: "Set up relative movement" }));
  expect(screen.getByLabelText("Target 1 of 5")).toBeInTheDocument();
  for (let i = 0; i < 32; ++i) last = deliver(tracker, { conditioned, currentHandIdentity });
  expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
  return last;
}
function finishRelativeTraining(tracker: IndexImageTracker) {
  let current = { x: 60, y: 60 };
  for (const target of [
    { x: 40, y: 60 },
    { x: 80, y: 60 },
    { x: 60, y: 40 },
    { x: 60, y: 80 },
  ]) {
    const from = current;
    for (let i = 1; i <= 20; ++i)
      deliver(tracker, {
        x: Math.round(from.x + ((target.x - from.x) * i) / 20),
        y: Math.round(from.y + ((target.y - from.y) * i) / 20),
      });
    for (let i = 0; i < 28; ++i) deliver(tracker, target);
    current = target;
  }
  return current;
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
  it("keeps target 2 through sustained gesture uncertainty with current observed index identity, then naturally resumes", () => {
    const tracker = new IndexImageTracker(binding);
    const first = openAndSaveFirst(tracker, false, true, true);
    const sample = vi.spyOn(SampleWindow.prototype, "push");
    for (let i = 0; i < 42; i++) {
      const next = deliver(tracker, {
        blank: true,
        anatomyUncertain: true,
        currentHandIdentity: true,
        currentIndexIdentity: true,
      });
      expect(next.point).toBeNull();
      expect(next.trackId).toBe(first.trackId);
    }
    expect(sample).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
    expect(screen.getByText(/1 of 5 targets saved/)).toBeVisible();
    expect(screen.getByRole("status", { name: "Reach status" })).toHaveTextContent("Your hand is still tracked");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    let recovered;
    for (let i = 0; i < 12; i++)
      recovered = deliver(tracker, { blank: true, conditioned: true, currentHandIdentity: true, x: 50 });
    expect(recovered).toMatchObject({ state: "TRACKING", coordinateSource: "MODEL", trackId: first.trackId });
    expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(sample).toHaveBeenCalled();
  });

  it("keeps saved targets during palm-only continuity without granting later unverified model tips sample permission", () => {
    const tracker = new IndexImageTracker(binding);
    const first = openAndSaveFirst(tracker, false, true, true);
    const sample = vi.spyOn(SampleWindow.prototype, "push");
    for (let i = 0; i < 42; i++) {
      const next = deliver(tracker, { blank: true, anatomyUncertain: true, currentHandIdentity: true });
      expect(next).toMatchObject({ point: null, trackId: first.trackId });
    }
    for (let i = 0; i < 12; i++) {
      const next = deliver(tracker, { blank: true, conditioned: true, currentHandIdentity: true, x: 50 });
      expect(next).toMatchObject({ point: null, trackId: first.trackId });
    }
    expect(sample).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
    expect(screen.getByText(/1 of 5 targets saved/)).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("rejects old camera pixels before image readiness even when dispatch is current", () => {
    const tracker = new IndexImageTracker(binding);
    openAndSaveFirst(tracker);
    const readiness = vi.spyOn(IndexImageReadiness.prototype, "update");
    const samples = vi.spyOn(SampleWindow.prototype, "push");
    deliver(tracker, { originAge: 200 });
    expect(readiness).not.toHaveBeenCalled();
    expect(samples).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Reach status" })).toHaveTextContent("Waiting for fresh tracking");
  });

  it("rejects an old-pixel model observation before hand selection and absolute sampling", () => {
    render(<ReachLaboratory />);
    fireEvent.click(screen.getByRole("button", { name: "Enable live camera" }));
    fireEvent.click(screen.getByRole("radio", { name: "Absolute pointing" }));
    fireEvent.click(screen.getByRole("button", { name: "Begin nine-point calibration" }));
    const selection = vi.spyOn(ActiveHandSelector.prototype, "update");
    const samples = vi.spyOn(SampleWindow.prototype, "push");
    act(() => {
      vi.advanceTimersByTime(300);
      const o = syntheticObservation({ x: 0.5, y: 0.5 }, 1, performance.now());
      o.monotonicPixelOriginTime = performance.now() - 200;
      fixture.runtimes[0].observe(o);
    });
    expect(selection).not.toHaveBeenCalled();
    expect(samples).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Target 1 of 9")).toBeInTheDocument();
  });

  it("rechecks pixel age after readiness work crosses the150ms collection deadline", () => {
    const tracker = new IndexImageTracker(binding);
    openAndSaveFirst(tracker);
    const original = IndexImageReadiness.prototype.update;
    vi.spyOn(IndexImageReadiness.prototype, "update").mockImplementationOnce(function (this: IndexImageReadiness, o) {
      const result = original.call(this, o);
      vi.advanceTimersByTime(26);
      return result;
    });
    const samples = vi.spyOn(SampleWindow.prototype, "push");
    deliver(tracker, { originAge: 125 });
    expect(samples).not.toHaveBeenCalled();
    expect(screen.getByRole("status", { name: "Reach status" })).toHaveTextContent("Waiting for fresh tracking");
    expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
  });

  it("rechecks origin age immediately before inserting a target sample", () => {
    const tracker = new IndexImageTracker(binding);
    openAndSaveFirst(tracker);
    fireEvent.click(screen.getByRole("button", { name: "Pause calibration" }));
    fireEvent.click(screen.getByRole("button", { name: "Resume calibration" }));
    for (let i = 0; i < 13; ++i) deliver(tracker);
    const original: typeof calibrationModule.assertCurrentReachBinding = calibrationModule.assertCurrentReachBinding;
    const construction = vi
      .spyOn(calibrationModule, "assertCurrentReachBinding")
      .mockImplementationOnce((value, mode) => {
        original(value, mode);
        vi.advanceTimersByTime(26);
      });
    const samples = vi.spyOn(SampleWindow.prototype, "push");
    deliver(tracker, { originAge: 125 });
    expect(construction).toHaveBeenCalledOnce();
    expect(samples).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
  });

  it("expires visible readiness by pixel origin while its dispatch timestamp is still fresh", () => {
    const tracker = new IndexImageTracker(binding);
    openAndSaveFirst(tracker);
    const o = deliver(tracker, { originAge: 120 });
    act(() => vi.advanceTimersByTime(100));
    expect(performance.now() - o.monotonicCaptureTime).toBe(100);
    expect(screen.getByRole("status", { name: "Reach status" })).toHaveTextContent("Waiting for fresh tracking");
    expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
  });

  it.each([false, true])("names current MODEL support truthfully (registered index:%s)", (registered) => {
    const tracker = new IndexImageTracker(binding);
    openAndSaveFirst(tracker, false, true);
    if (registered) for (let i = 0; i < 6; ++i) deliver(tracker, { cue: true });
    for (let i = 0; i < 6; ++i)
      deliver(tracker, registered ? { cue: true, blank: true } : { conditioned: true, blank: true });
    const status = screen.getByRole("status", { name: "Reach status" });
    expect(status).toHaveTextContent(registered ? "Visible index position tracked" : "Hand model position tracked");
    expect(status).toHaveTextContent("Relative model control");
    expect(status).not.toHaveTextContent("Fingertip appearance tracked");
  });

  it("distinguishes FUSED position evidence from IMAGE fallback in the status", () => {
    const tracker = new IndexImageTracker(binding);
    openAndSaveFirst(tracker, false, true);
    const status = screen.getByRole("status", { name: "Reach status" });
    expect(status).toHaveTextContent("Hand and image position tracked");
    expect(status).toHaveTextContent("Relative fused control");
    for (let i = 0; i < 6; ++i) deliver(tracker);
    expect(status).toHaveTextContent("Fingertip appearance tracked");
    expect(status).toHaveTextContent("Relative image control");
  });

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

  it("keeps saved target1 through registered palm-absent index assistance and the return of the full hand", () => {
    const tracker = new IndexImageTracker(binding);
    const first = openAndSaveFirst(tracker, false, true);
    // Register the partial cue against current, independently accepted optical
    // evidence before changing appearance. It has no palm span/full authority.
    for (let i = 0; i < 6; ++i) deliver(tracker, { cue: true });
    const motion: IndexImageObservation[] = [];
    for (let i = 0; i < 30; ++i) motion.push(deliver(tracker, { x: 60 + i, cue: true, unrelated: true }));
    expect(motion.every((o) => o.state === "TRACKING" && o.trackId === first.trackId)).toBe(true);
    expect(motion.some((o) => o.coordinateSource === "MODEL" && o.modelSupport === "REGISTERED_INDEX")).toBe(true);
    expect(motion.at(-1)!.opticalEpoch).toBeGreaterThan(first.opticalEpoch!);
    for (let i = 0; i < 6; ++i)
      expect(deliver(tracker, { x: 90 + i, conditioned: true, unrelated: true })).toMatchObject({
        state: "TRACKING",
        trackId: first.trackId,
      });
    expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
    expect(screen.getByText(/1 of 5 targets saved/)).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps a cold palm-absent cue from starting model-only collection", () => {
    const tracker = new IndexImageTracker(binding);
    render(<ReachLaboratory />);
    fireEvent.click(screen.getByRole("button", { name: "Enable live camera" }));
    fireEvent.click(screen.getByRole("button", { name: "Set up relative movement" }));
    for (let i = 0; i < 30; ++i)
      expect(deliver(tracker, { cue: true, blank: true })).toMatchObject({ point: null, trackId: null });
    expect(screen.getByLabelText("Target 1 of 5")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(["manual image selection", "a different partial model source"])(
    "never borrows a registered-index cue for %s",
    (scenario) => {
      const tracker = new IndexImageTracker(binding);
      openAndSaveFirst(tracker, scenario === "manual image selection", scenario !== "manual image selection");
      for (let i = 0; i < 6; ++i) deliver(tracker, { cue: true });
      for (let i = 0; i < 30; ++i)
        expect(
          deliver(tracker, {
            cue: true,
            cueSource: scenario === "a different partial model source" ? "another-model-track-generation" : undefined,
            blank: true,
          }),
        ).toMatchObject({ point: null });
      expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
      expect(screen.getByText(/1 of 5 targets saved/)).toBeVisible();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it("suspends saved evidence after optical expiry without lending it to the new automatic anchor", () => {
    const tracker = new IndexImageTracker(binding);
    const first = openAndSaveFirst(tracker);
    // Current model results remain fresh, but blank pixels cannot renew optical identity.
    for (let i = 0; i < 28; ++i) deliver(tracker, { blank: true });
    expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
    let next = deliver(tracker);
    for (let i = 0; i < 7; ++i) next = deliver(tracker);
    expect(next.state).toBe("TRACKING");
    expect(next.trackId).not.toBe(first.trackId);
    expect(screen.getByRole("status", { name: "Reach status" })).toHaveTextContent(
      "Fingertip identity could not be verified. Completed targets are saved, but cannot be used with this track.",
    );
    expect(document.querySelector("[data-step=TRAINING]")).not.toBeNull();
    expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
    expect(screen.getByText(/1 of 5 targets saved/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Start fresh setup" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancel setup" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Resume calibration" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
  it("keeps replacement frames from sampling, fitting, exporting or enabling capture while saved evidence is held", () => {
    const tracker = new IndexImageTracker(binding);
    const sampling = vi.spyOn(SampleWindow.prototype, "push");
    openAndSaveFirst(tracker);
    const saved = sampling.mock.results.find((result) => result.type === "return" && result.value.samples)?.value
      .samples;
    expect(saved).toBeTruthy();
    const originalSaved = structuredClone(saved);
    const fit = vi.spyOn(calibrationModule, "fitRelativeCalibration");
    const validate = vi.spyOn(calibrationModule, "validateCalibration");
    const estimate = vi.spyOn(calibrationModule, "calibratedPoint");
    const download = vi.fn();
    vi.spyOn(URL, "createObjectURL").mockImplementation(download);
    fireEvent.click(screen.getByText("Session diagnostics & privacy", { exact: true }));
    fireEvent.click(screen.getByLabelText(/consent to downloading/));
    expect(screen.getByRole("button", { name: "Export aggregate metrics" })).toBeEnabled();
    for (let i = 0; i < 28; ++i) deliver(tracker, { blank: true });
    for (let i = 0; i < 8; ++i) deliver(tracker);
    expect(document.querySelector("[data-calibration-identity=SUSPENDED]")).not.toBeNull();
    sampling.mockClear();
    for (let i = 0; i < 40; ++i) deliver(tracker, { x: 50 });
    expect(sampling).not.toHaveBeenCalled();
    expect(fit).not.toHaveBeenCalled();
    expect(validate).not.toHaveBeenCalled();
    expect(estimate).not.toHaveBeenCalled();
    expect(saved).toEqual(originalSaved);
    expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
    expect(screen.getByText(/1 of 5 targets saved/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Export aggregate metrics" })).toBeDisabled();
    screen.getByRole("button", { name: "Export aggregate metrics" }).click();
    expect(download).not.toHaveBeenCalled();
    expect(fixture.runtimes[0].setCalibrationCollecting).toHaveBeenLastCalledWith(false);
    expect(document.querySelector("[data-calibration-capture=false]")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Check five new targets" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry this target" })).not.toBeInTheDocument();
  });

  it.each(["fresh", "cancel"])("requires explicit %s choice for held evidence", (choice) => {
    const tracker = new IndexImageTracker(binding);
    openAndSaveFirst(tracker);
    for (let i = 0; i < 28; ++i) deliver(tracker, { blank: true });
    for (let i = 0; i < 8; ++i) deliver(tracker);
    expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
    const sampling = vi.spyOn(SampleWindow.prototype, "push");
    fireEvent.click(screen.getByRole("button", { name: choice === "fresh" ? "Start fresh setup" : "Cancel setup" }));
    expect(sampling).not.toHaveBeenCalled();
    expect(document.querySelector("[data-calibration-identity=SUSPENDED]")).toBeNull();
    expect(screen.queryByLabelText("Target 2 of 5")).not.toBeInTheDocument();
    if (choice === "fresh") {
      expect(screen.getByLabelText("Target 1 of 5")).toBeInTheDocument();
      expect(screen.getByText(/0 of 5 targets saved/)).toBeVisible();
      for (let i = 0; i < 10; ++i) deliver(tracker);
      expect(sampling).not.toHaveBeenCalled();
      for (let i = 0; i < 10; ++i) deliver(tracker);
      expect(sampling).toHaveBeenCalled();
      expect(screen.queryByLabelText("Target 2 of 5")).not.toBeInTheDocument();
    } else {
      expect(document.querySelector("[data-step=PREPARE]")).not.toBeNull();
      expect(screen.getByRole("button", { name: "Set up relative movement" })).toBeVisible();
      expect(fixture.runtimes[0].setCalibrationCollecting).toHaveBeenLastCalledWith(false);
    }
  });

  it("resumes only the original producer logical identity while its independently supported continuity remains live", () => {
    const original = new IndexImageTracker(binding);
    const first = openAndSaveFirst(original);
    const other = new IndexImageTracker(binding);
    for (let i = 0; i < 8; ++i) deliver(other);
    expect(document.querySelector("[data-calibration-identity=SUSPENDED]")).not.toBeNull();
    const sampling = vi.spyOn(SampleWindow.prototype, "push");
    for (let i = 0; i < 8; ++i) {
      const returning = deliver(original);
      expect(returning.trackId).toBe(first.trackId);
      expect(returning.temporalTrack).toMatchObject({ state: "TRACKING", identity: "ESTABLISHED" });
    }
    expect(document.querySelector("[data-calibration-identity=SUSPENDED]")).toBeNull();
    expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
    expect(screen.getByText(/1 of 5 targets saved/)).toBeVisible();
    expect(sampling).not.toHaveBeenCalled();
    for (let i = 0; i < 15; ++i) deliver(original);
    expect(sampling).toHaveBeenCalled();
  });

  it.each([
    ["camera", { cameraLeaseId: "changed-camera" }],
    ["manual", { anchorSource: "MANUAL_HINT" as const }],
    ["provider generation", { providerGeneration: 2 }],
    ["algorithm", { algorithmDigest: "b".repeat(64) }],
    ["frame width", { frameWidth: 640 }],
    ["frame height", { frameHeight: 480 }],
    ["mirror", { mirrorTransform: "NONE" as const }],
  ])("still invalidates held evidence for an explicit %s change", (_change, changed) => {
    const tracker = new IndexImageTracker(binding);
    openAndSaveFirst(tracker);
    for (let i = 0; i < 28; ++i) deliver(tracker, { blank: true });
    for (let i = 0; i < 8; ++i) deliver(tracker);
    const samples = vi.spyOn(SampleWindow.prototype, "push");
    act(() => {
      vi.advanceTimersByTime(50);
      const next = tracker.update(pixels(60, 60, performance.now()), {
        point: normalized(),
        pointing: true,
        contrary: false,
      });
      fixture.runtimes[0].image({
        ...next,
        ...changed,
      });
    });
    expect(samples).not.toHaveBeenCalled();
    expect(document.querySelector("[data-calibration-identity=SUSPENDED]")).toBeNull();
    expect(document.querySelector("[data-step=PREPARE]")).not.toBeNull();
    expect(screen.queryByLabelText("Target 2 of 5")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Begin a fresh setup");
  });
  it("holds a fitted profile and completed check targets inert until a fresh setup is explicitly requested", () => {
    const tracker = new IndexImageTracker(binding);
    openAndSaveFirst(tracker);
    const current = finishRelativeTraining(tracker);
    expect(screen.getByRole("button", { name: "Check five new targets" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Check five new targets" }));
    for (let i = 0; i < 32; ++i) deliver(tracker, current);
    expect(screen.getByText(/1 of 5 targets saved/)).toBeVisible();
    const target = screen.getByLabelText("Target 2 of 5");
    const sampling = vi.spyOn(SampleWindow.prototype, "push");
    const fit = vi.spyOn(calibrationModule, "fitRelativeCalibration");
    const validate = vi.spyOn(calibrationModule, "validateCalibration");
    const estimate = vi.spyOn(calibrationModule, "calibratedPoint");
    for (let i = 0; i < 28; ++i) deliver(tracker, { ...current, blank: true });
    for (let i = 0; i < 8; ++i) deliver(tracker, current);
    expect(document.querySelector("[data-calibration-identity=SUSPENDED]")).not.toBeNull();
    sampling.mockClear();
    estimate.mockClear();
    for (let i = 0; i < 24; ++i) deliver(tracker, current);
    expect(screen.getByLabelText("Target 2 of 5")).toBe(target);
    expect(screen.getByText(/1 of 5 targets saved/)).toBeVisible();
    expect(sampling).not.toHaveBeenCalled();
    expect(fit).not.toHaveBeenCalled();
    expect(validate).not.toHaveBeenCalled();
    expect(estimate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Session diagnostics & privacy", { exact: true }));
    fireEvent.click(screen.getByLabelText(/consent to downloading/));
    expect(screen.getByRole("button", { name: "Export aggregate metrics" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Resume check" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open pointing playground" })).not.toBeInTheDocument();
    expect(screen.getByText(/Calibration:.*SUSPENDED/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Start fresh setup" }));
    expect(screen.getByLabelText("Target 1 of 5")).toBeInTheDocument();
    expect(screen.getByText(/0 of 5 targets saved/)).toBeVisible();
    expect(screen.getByText(/Calibration: none/)).toBeVisible();
  });

  it("never restores a held binding from a stale old callback or an expired original producer", () => {
    const original = new IndexImageTracker(binding);
    const first = openAndSaveFirst(original);
    const replacement = new IndexImageTracker(binding);
    for (let i = 0; i < 8; ++i) deliver(replacement);
    expect(document.querySelector("[data-calibration-identity=SUSPENDED]")).not.toBeNull();
    const samples = vi.spyOn(SampleWindow.prototype, "push");
    const readiness = vi.spyOn(IndexImageReadiness.prototype, "update");
    act(() => fixture.runtimes[0].image(first));
    expect(readiness).not.toHaveBeenCalled();
    for (let i = 0; i < 28; ++i) deliver(replacement);
    let returned;
    for (let i = 0; i < 8; ++i) returned = deliver(original);
    expect(returned!.trackId).not.toBe(first.trackId);
    expect(document.querySelector("[data-calibration-identity=SUSPENDED]")).not.toBeNull();
    expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
    expect(screen.getByText(/1 of 5 targets saved/)).toBeVisible();
    expect(samples).not.toHaveBeenCalled();
    expect(fixture.runtimes[0].setCalibrationCollecting).toHaveBeenLastCalledWith(false);
  });
  it("binds the image domain of the first collected sample after an empty setup source transition", () => {
    render(<ReachLaboratory />);
    fireEvent.click(screen.getByRole("button", { name: "Enable live camera" }));
    fireEvent.click(screen.getByRole("button", { name: "Set up relative movement" }));
    const opening = new IndexImageTracker(binding);
    for (let i = 0; i < 4; ++i) deliver(opening);
    const current = new IndexImageTracker({ ...binding, cameraLeaseId: "camera-before-first-sample" });
    const samples = vi.spyOn(SampleWindow.prototype, "push");
    for (let i = 0; i < 40; ++i) deliver(current);
    expect(samples.mock.contexts[0]).toMatchObject({ binding: { cameraLeaseId: "camera-before-first-sample" } });
    expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
    for (let i = 0; i < 28; ++i) deliver(current, { blank: true });
    for (let i = 0; i < 8; ++i) deliver(current);
    expect(document.querySelector("[data-calibration-identity=SUSPENDED]")).not.toBeNull();
    expect(screen.getByLabelText("Target 2 of 5")).toBeInTheDocument();
    expect(screen.getByText(/1 of 5 targets saved/)).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("keeps the fitted source domain when a check opens during a foreign track's acquisition", () => {
    const original = new IndexImageTracker(binding);
    openAndSaveFirst(original);
    finishRelativeTraining(original);
    expect(screen.getByRole("button", { name: "Check five new targets" })).toBeVisible();
    const replacement = new IndexImageTracker(binding);
    deliver(replacement);
    fireEvent.click(screen.getByRole("button", { name: "Check five new targets" }));
    const samples = vi.spyOn(SampleWindow.prototype, "push");
    const validate = vi.spyOn(calibrationModule, "validateCalibration");
    for (let i = 0; i < 10; ++i) deliver(replacement);
    expect(document.querySelector("[data-calibration-identity=SUSPENDED]")).not.toBeNull();
    expect(document.querySelector("[data-step=VALIDATION]")).not.toBeNull();
    expect(screen.getByLabelText("Target 1 of 5")).toBeInTheDocument();
    expect(screen.getByText(/0 of 5 targets saved/)).toBeVisible();
    expect(samples).not.toHaveBeenCalled();
    expect(validate).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fixture.runtimes[0].setCalibrationCollecting).toHaveBeenLastCalledWith(false);
    for (let i = 0; i < 20; ++i) deliver(replacement);
    expect(samples).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Start fresh setup" })).toBeVisible();
  });
});
