// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defaultReachRuntimePolicy } from "./runtime-policy";
import { syntheticObservation } from "./synthetic";
import type { HandObservation } from "./observation";
const fixture = vi.hoisted(() => ({
  policy: {} as Record<string, unknown>,
  observe: (observation: HandObservation) => {
    void observation;
  },
  starts: vi.fn(),
  stops: vi.fn(),
}));
vi.mock("./runtime-policy-client", () => ({ useReachRuntimePolicy: () => fixture.policy }));
vi.mock("./ReachStage", () => ({ ReachStage: () => <canvas /> }));
vi.mock("./browser-runtime", () => ({
  ReachBrowserRuntime: class {
    setTrackingLimits = vi.fn();
    setCalibrationCollecting = vi.fn();
    constructor(
      video: HTMLVideoElement,
      observe: typeof fixture.observe,
      private status: (state: string) => void,
    ) {
      fixture.observe = observe;
      Object.defineProperties(video, {
        readyState: { value: 4 },
        videoWidth: { value: 640 },
        videoHeight: { value: 480 },
        srcObject: { value: {}, writable: true },
      });
    }
    start = async () => {
      fixture.starts();
      this.status("READY");
    };
    stop = () => {
      fixture.stops();
      this.status("DISABLED");
    };
  },
}));
import { ReachPoseRecorder } from "./ReachPoseRecorder";
beforeEach(() => {
  fixture.starts.mockClear();
  fixture.stops.mockClear();
  fixture.policy = { status: "READY", revision: 1, policy: { ...defaultReachRuntimePolicy } };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    fillRect() {},
    save() {},
    restore() {},
    translate() {},
    scale() {},
    drawImage() {},
    fillText() {},
    measureText: () => ({ width: 10 }),
  } as unknown as CanvasRenderingContext2D);
  Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", {
    configurable: true,
    value: () => ({ getTracks: () => [{ stop: vi.fn() }] }),
  });
  vi.stubGlobal(
    "MediaRecorder",
    class {
      static isTypeSupported() {
        return true;
      }
      state = "inactive";
      mimeType = "video/webm";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["synthetic diagnostic video"]) });
        this.onstop?.();
      }
    },
  );
  let urls = 0;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => `blob:local-fixture-${++urls}`),
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it.each(["DISABLED", "UNAVAILABLE"])(
  "preserves an unfinished local video and trace when policy becomes %s",
  async (status) => {
    const view = render(<ReachPoseRecorder />);
    fireEvent.click(screen.getByRole("button", { name: "Enable camera preview" }));
    act(() => fixture.observe(syntheticObservation({ x: 0.5, y: 0.5 }, 1, performance.now(), 1)));
    fireEvent.click(screen.getByRole("button", { name: "Start guided video + trace recording" }));
    expect(screen.getByRole("button", { name: "Stop & review" })).toBeVisible();
    fixture.policy = {
      status,
      revision: 2,
      policy: status === "DISABLED" ? { ...defaultReachRuntimePolicy, featureEnabled: false } : null,
    };
    view.rerender(<ReachPoseRecorder />);
    expect(screen.getByRole("heading", { name: "Review your local recording" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Download diagnostic video" })).toHaveAttribute(
      "href",
      "blob:local-fixture-1",
    );
    expect(screen.getByRole("link", { name: "Download landmark trace" })).toHaveAttribute(
      "href",
      "blob:local-fixture-2",
    );
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    fixture.policy = { status: "READY", revision: 3, policy: { ...defaultReachRuntimePolicy } };
    view.rerender(<ReachPoseRecorder />);
    expect(fixture.starts).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Download diagnostic video" })).toBeVisible();
  },
);
