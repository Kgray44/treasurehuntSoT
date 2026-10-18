// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultReachRuntimePolicy } from "./runtime-policy";
import type { ReachInferenceMetrics } from "./browser-runtime";
import { indexImageAlgorithm, type IndexImageObservation } from "./index-image-tracker";
import { SampleWindow } from "./sample-window";
type FixtureRuntime = {
  start: ReturnType<typeof vi.fn>;
  setTrackingLimits: ReturnType<typeof vi.fn>;
  seedIndex: ReturnType<typeof vi.fn>;
  clearIndexSelection: ReturnType<typeof vi.fn>;
  image: (observation: unknown) => void;
  metrics: (packet: ReachInferenceMetrics) => void;
  status: (status: string) => void;
};
const fixture = vi.hoisted(() => ({
  policy: {} as Record<string, unknown>,
  runtimes: [] as FixtureRuntime[],
}));
vi.mock("./runtime-policy-client", () => ({ useReachRuntimePolicy: () => fixture.policy }));
vi.mock("./ReachStage", () => ({ ReachStage: () => <div>Local hand stage</div> }));
vi.mock("./browser-runtime", () => ({
  ReachBrowserRuntime: class {
    start = vi.fn(async () => this.status("READY"));
    stop = vi.fn(() => this.status("DISABLED"));
    setTrackingLimits = vi.fn();
    setCalibrationCollecting = vi.fn();
    setIndexTrackingEnabled = vi.fn();
    seedIndex = vi.fn(() => true);
    clearIndexSelection = vi.fn(() => true);
    resources = () => ({ workers: 1, tracks: 1, timers: 0 });
    trackingPacing = () => ({ maximumHz: 15, targetHz: 15, calibrationCollecting: false, focused: true });
    captureDiagnostics = () => null;
    constructor(
      _video: unknown,
      public observe: (observation: unknown) => void,
      public status: (status: string) => void,
      _media: unknown,
      _raw: unknown,
      public image: (observation: unknown) => void,
      public metrics: (packet: ReachInferenceMetrics) => void,
    ) {
      fixture.runtimes.push(this);
    }
  },
}));
import { ReachLaboratory } from "./ReachLaboratory";
beforeEach(() => {
  fixture.runtimes = [];
  fixture.policy = { status: "READY", revision: 1, policy: { ...defaultReachRuntimePolicy }, refresh: vi.fn() };
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
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("mandatory Reach policy in the actual Laboratory", () => {
  it("keeps setup operable during startup, explains rejection and never queues an automatic start", () => {
    const samples = vi.spyOn(SampleWindow.prototype, "push");
    render(<ReachLaboratory />);
    const runtime = fixture.runtimes[0];
    runtime.start.mockImplementationOnce(async () => runtime.status("MODEL_STARTING"));
    fireEvent.click(screen.getByRole("button", { name: "Enable live camera" }));
    const setup = screen.getByRole("button", { name: "Set up relative movement" });
    expect(setup).toBeEnabled();
    act(() => setup.click());
    expect(document.querySelector("[data-step=PREPARE]")).not.toBeNull();
    expect(
      screen.getByText("Wait for the camera and hand model to finish starting, then request setup again."),
    ).toBeVisible();
    act(() => runtime.status("READY"));
    expect(document.querySelector("[data-step=PREPARE]")).not.toBeNull();
    act(() => setup.click());
    expect(document.querySelector("[data-step=TRAINING]")).not.toBeNull();
    expect(samples).not.toHaveBeenCalled();
  });
  it("keeps a persistent explanation when camera-control restoration really invalidates a setup", () => {
    render(<ReachLaboratory />);
    fireEvent.click(screen.getByRole("button", { name: "Enable live camera" }));
    fireEvent.click(screen.getByRole("button", { name: "Set up relative movement" }));
    act(() => fixture.runtimes[0].status("CAPTURE_CONTROL_RESTORE_FAILED"));
    expect(document.querySelector("[data-step=PREPARE]")).not.toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Camera controls could not be restored");
  });
  it("keeps manual selection explicit through a failed match and offers an intentional return to automatic selection", () => {
    render(<ReachLaboratory />);
    fireEvent.click(screen.getByRole("button", { name: "Enable live camera" }));
    const runtime = fixture.runtimes[0];
    const at = performance.now();
    const waiting: IndexImageObservation = {
      observationVersion: 1,
      ...indexImageAlgorithm,
      providerGeneration: 1,
      cameraLeaseId: "local-test-camera",
      cameraFrameVersion: 1,
      frameWidth: 320,
      frameHeight: 240,
      mirrorTransform: "PREVIEW_X",
      orientation: 0,
      sequence: 0,
      monotonicCaptureTime: at,
      monotonicInferenceTime: at,
      trackId: null,
      trackGeneration: 0,
      point: null,
      state: "UNSEEDED",
      modelAgreement: "UNAVAILABLE",
      anchorSource: null,
      quality: { correlation: null, separation: null, texture: null, forwardBackwardErrorPixels: null },
      uncertaintyRadiusPixels: null,
      reason: "SHOW_INDEX_OR_SELECT_TIP",
    };
    act(() => runtime.image(waiting));
    fireEvent.click(screen.getByRole("button", { name: "Set up relative movement" }));
    expect(document.querySelector("[data-step=TRAINING]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Track visible fingertip" }));
    fireEvent.keyDown(screen.getByRole("button", { name: /Mark visible fingertip in camera/ }), { key: "Enter" });
    expect(runtime.seedIndex).toHaveBeenCalledWith({ x: 0.5, y: 0.5 });
    expect(document.querySelector("[data-step=PREPARE]")).not.toBeNull();
    expect(screen.getByText("You selected a fingertip. Begin a fresh setup after tracking settles.")).toBeVisible();
    act(() => runtime.image({ ...waiting, sequence: 1, reason: "MANUAL_SELECTION_REQUIRED" }));
    expect(screen.getByRole("button", { name: "Use automatic fingertip selection" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Use automatic fingertip selection" }));
    expect(runtime.clearIndexSelection).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Use automatic fingertip selection" })).toBeNull();
    expect(
      screen.getByText("Automatic fingertip selection restored. Begin a fresh setup after tracking settles."),
    ).toBeVisible();
    expect(runtime.start).toHaveBeenCalledOnce();
  });
  it("applies new capture/model caps without restarting the active camera", async () => {
    const view = render(<ReachLaboratory />);
    fireEvent.click(screen.getByRole("button", { name: "Enable live camera" }));
    const runtime = fixture.runtimes[0];
    expect(runtime.start).toHaveBeenCalledTimes(1);
    fixture.policy = {
      ...fixture.policy,
      revision: 2,
      policy: { ...defaultReachRuntimePolicy, normalMaximumHz: 10, modelMaximumHz: 20 },
    };
    view.rerender(<ReachLaboratory />);
    expect(runtime.setTrackingLimits).toHaveBeenLastCalledWith({
      normalMaximumHz: 10,
      calibrationMaximumHz: 60,
      unfocusedMaximumHz: 8,
      modelMaximumHz: 20,
    });
    expect(runtime.start).toHaveBeenCalledTimes(1);
    expect(fixture.runtimes).toHaveLength(1);
  });
  it("stops an active setup on disable and never restarts the camera on re-enable", () => {
    const view = render(<ReachLaboratory />);
    fireEvent.click(screen.getByRole("button", { name: "Enable live camera" }));
    fireEvent.click(screen.getByRole("button", { name: "Set up relative movement" }));
    expect(document.querySelector("[data-step=TRAINING]")).not.toBeNull();
    const runtime = fixture.runtimes[0];
    fixture.policy = {
      ...fixture.policy,
      status: "DISABLED",
      revision: 2,
      policy: { ...defaultReachRuntimePolicy, featureEnabled: false },
    };
    view.rerender(<ReachLaboratory />);
    expect(document.querySelector("[data-step=PREPARE]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Enable live camera" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Explore guided demo" })).toBeDisabled();
    fixture.policy = { ...fixture.policy, status: "READY", revision: 3, policy: { ...defaultReachRuntimePolicy } };
    view.rerender(<ReachLaboratory />);
    expect(screen.getByRole("button", { name: "Enable live camera" })).toBeEnabled();
    expect(runtime.start).toHaveBeenCalledTimes(1);
  });
  it("automatically uploads scalar live diagnostics on stop without any telemetry toggle", async () => {
    render(<ReachLaboratory />);
    expect(screen.queryByRole("checkbox", { name: /sharing|telemetry/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Enable live camera" }));
    act(() =>
      fixture.runtimes[0].metrics({
        disposition: "ACCEPTED",
        packetAgeMs: 20,
        modelResultMs: 18,
        preprocessingMs: 2,
        frameIntervalMs: 100,
        handCount: 0,
      }),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Stop session" }));
      await Promise.resolve();
    });
    const request = vi.mocked(fetch).mock.calls[0];
    expect(request[0]).toBe("/api/reach/telemetry");
    const payload = JSON.parse(request[1]!.body as string);
    expect(payload.report.model).toMatchObject({ packets: 1, accepted: 1, noHand: 1 });
    expect(payload).not.toHaveProperty("consented");
    expect(payload.report).not.toHaveProperty("landmarks");
    expect(payload.report).not.toHaveProperty("accountId");
  });
});
