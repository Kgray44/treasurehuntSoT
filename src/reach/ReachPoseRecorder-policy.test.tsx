// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defaultReachRuntimePolicy } from "./runtime-policy";
import { syntheticObservation } from "./synthetic";
import type { HandObservation } from "./observation";
import { poseRecordingLimits } from "./pose-recording";
const fixture = vi.hoisted(() => ({
  policy: {} as Record<string, unknown>,
  observe: (observation: HandObservation) => {
    void observation;
  },
  starts: vi.fn(),
  stops: vi.fn(),
  draws: vi.fn(),
  capture: vi.fn(),
  blobs: [] as Blob[],
  mediaOptions: null as MediaRecorderOptions | null,
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
  fixture.draws.mockClear();
  fixture.capture.mockClear();
  fixture.blobs = [];
  fixture.mediaOptions = null;
  fixture.policy = { status: "READY", revision: 1, policy: { ...defaultReachRuntimePolicy } };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    fillRect() {},
    save() {},
    restore() {},
    translate() {},
    scale() {},
    drawImage: fixture.draws,
    fillText() {},
    measureText: () => ({ width: 10 }),
  } as unknown as CanvasRenderingContext2D);
  Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", {
    configurable: true,
    value: (rate: number) => {
      fixture.capture(rate);
      return { getTracks: () => [{ stop: vi.fn() }] };
    },
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
      constructor(_stream: MediaStream, options: MediaRecorderOptions) {
        fixture.mediaOptions = options;
      }
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
    value: vi.fn((blob: Blob) => {
      fixture.blobs.push(blob);
      return `blob:local-fixture-${++urls}`;
    }),
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
it.each([true, false])(
  "records the actual canvas sources and trace metadata with clean camera %s",
  async (cleanCamera) => {
    const view = render(<ReachPoseRecorder />);
    const checkbox = screen.getByRole("checkbox", { name: "Save camera image without hand overlay" });
    expect(checkbox).toBeChecked();
    if (!cleanCamera) fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "Enable camera preview" }));
    act(() => fixture.observe(syntheticObservation({ x: 0.5, y: 0.5 }, 1, performance.now(), 1)));
    const camera = view.container.querySelector("video")!;
    const overlay = view.container.querySelector("canvas")!;
    if (cleanCamera) overlay.remove(); // Clean capture must not depend on a rendered overlay canvas.
    fireEvent.click(screen.getByRole("button", { name: "Start guided video + trace recording" }));
    expect(checkbox).toBeDisabled();
    expect(fixture.draws.mock.calls.map((call) => call[0])).toEqual(cleanCamera ? [camera] : [camera, overlay]);
    expect(fixture.capture).toHaveBeenCalledWith(20);
    expect(fixture.mediaOptions).toEqual({ mimeType: "video/webm;codecs=vp9", videoBitsPerSecond: 2_500_000 });
    fireEvent.click(screen.getByRole("button", { name: "Stop & review" }));
    const traceBlob = fixture.blobs.find((blob) => blob.type === "application/json")!;
    expect(traceBlob).toBeDefined();
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsText(traceBlob);
    });
    const trace = JSON.parse(text);
    expect(trace.video).toMatchObject({
      kind: cleanCamera ? "CAMERA_IMAGE_AND_PROMPT" : "CAMERA_PLUS_EXISTING_RENDERED_TRACE_AND_PROMPT",
      containsHandOverlay: !cleanCamera,
      cameraImageEncoding: "MIRRORED_REENCODED_DIAGNOSTIC_NOT_RAW_SENSOR",
      requestedFps: 20,
      audio: false,
      compositeWidth: 640,
      compositeHeight: 592,
      imageRegion: { x: 0, y: 0, width: 640, height: 480 },
      annotationStripHeight: 112,
      previewMirrorX: true,
    });
    expect(trace.limits).toEqual(poseRecordingLimits);
    expect(trace.limits.videoBytes).toBe(64 * 1024 * 1024);
    expect(
      screen.getByText(new RegExp(cleanCamera ? "camera image without hand overlay" : "camera and hand overlay")),
    ).toBeVisible();
  },
);
