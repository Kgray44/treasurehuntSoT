// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultReachRuntimePolicy } from "./runtime-policy";
import type { ReachInferenceMetrics } from "./browser-runtime";
type FixtureRuntime = {
  start: ReturnType<typeof vi.fn>;
  setTrackingLimits: ReturnType<typeof vi.fn>;
  metrics: (packet: ReachInferenceMetrics) => void;
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
    resources = () => ({ workers: 1, tracks: 1, timers: 0 });
    trackingPacing = () => ({ maximumHz: 15, targetHz: 15, calibrationCollecting: false, focused: true });
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
