// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defaultReachRuntimePolicy } from "./runtime-policy";
import { syntheticObservation } from "./synthetic";
import type { HandObservation } from "./observation";
import { poseRecordingLimits } from "./pose-recording";
import { indexImageAlgorithm, type IndexImageObservation } from "./index-image-tracker";
import type { RawHandInference, ReachFrameDiagnostics } from "./browser-runtime";
const fixture = vi.hoisted(() => ({
  policy: {} as Record<string, unknown>,
  observe: (observation: HandObservation) => {
    void observation;
  },
  raw: (_frame: RawHandInference) => {
    void _frame;
  },
  index: (_frame: IndexImageObservation) => {
    void _frame;
  },
  diagnostic: (_frame: ReachFrameDiagnostics) => {
    void _frame;
  },
  status: (_state: string) => {
    void _state;
  },
  constructors: vi.fn(),
  collecting: vi.fn(),
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
    setCalibrationCollecting = fixture.collecting;
    constructor(
      video: HTMLVideoElement,
      observe: typeof fixture.observe,
      private status: (state: string) => void,
      _media?: unknown,
      raw?: typeof fixture.raw,
      index?: typeof fixture.index,
      _metrics?: unknown,
      diagnostic?: typeof fixture.diagnostic,
    ) {
      fixture.constructors();
      fixture.observe = observe;
      fixture.raw = raw ?? (() => {});
      fixture.index = index ?? (() => {});
      fixture.diagnostic = diagnostic ?? (() => {});
      fixture.status = status;
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
  fixture.constructors.mockClear();
  fixture.collecting.mockClear();
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

it("records the same runtime's raw, canonical and rejected frames with shared readiness instead of skeleton-only success", async () => {
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  render(<ReachPoseRecorder />);
  expect(fixture.constructors).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Enable camera preview" }));
  act(() => fixture.observe(syntheticObservation({ x: 0.5, y: 0.5 }, 0, now)));
  fireEvent.click(screen.getByRole("button", { name: "Start guided video + trace recording" }));
  expect(fixture.collecting).toHaveBeenCalledWith(true);
  for (let sequence = 0; sequence < 9; sequence++) {
    const capture = 1010 + sequence * 50;
    const model = syntheticObservation({ x: 0.5, y: 0.5 }, sequence, capture);
    Object.assign(model, { cameraLeaseId: "PRIVATE_LEASE", mirrorTransform: "PREVIEW_X", providerGeneration: 1 });
    const index: IndexImageObservation = {
      observationVersion: 1,
      ...indexImageAlgorithm,
      providerGeneration: 1,
      cameraLeaseId: "PRIVATE_LEASE",
      cameraFrameVersion: model.cameraFrameVersion,
      frameWidth: 640,
      frameHeight: 480,
      mirrorTransform: "PREVIEW_X",
      orientation: 0,
      sequence,
      monotonicCaptureTime: capture,
      monotonicInferenceTime: capture + 20,
      trackId: "PRIVATE_INDEX",
      trackGeneration: 1,
      point: { x: 0.5, y: 0.5 },
      state: "TRACKING",
      modelAgreement: "AGREE",
      anchorSource: "MODEL_INDEX",
      coordinateSource: "FUSED",
      opticalEpoch: 1,
      modelSupport: "FULL_HAND",
      quality: { correlation: 0.95, separation: 0.1, texture: 20, forwardBackwardErrorPixels: 0 },
      uncertaintyRadiusPixels: 4,
      reason: "FULL_HAND_POINT_CONFIRMED",
    };
    now = capture + 15;
    act(() => {
      fixture.raw({
        result: { landmarks: [model.hands[0].landmarks.map(({ x, y, z }) => ({ x, y, z }))] },
        capture,
        inference: capture + 10,
        received: now,
        videoTime: capture / 1000,
        width: 640,
        height: 480,
        mirror: true,
      });
      fixture.observe(model);
      fixture.index(index);
      now = capture + 25;
      fixture.diagnostic({
        capture,
        completed: now,
        modelObservation: model,
        indexObservation: index,
        modelReason: "MODEL_ACCEPTED",
        indexReason: "INDEX_ACCEPTED",
      });
    });
  }
  expect(screen.getByRole("status", { name: "Canonical fingertip tracking" })).toHaveTextContent(
    "hand and image position ready",
  );
  now = 1500;
  act(() => {
    fixture.raw({
      result: { landmarks: [] },
      capture: now,
      inference: now,
      received: now,
      videoTime: 1.5,
      width: 640,
      height: 480,
      mirror: true,
    });
    fixture.status("STALE_OR_INVALID_OBSERVATION");
    fixture.diagnostic({
      capture: now,
      completed: now,
      modelObservation: null,
      indexObservation: null,
      modelReason: "OBSERVATION_PIXEL_ORIGIN_STALE",
      indexReason: "INDEX_RESULT_UNAVAILABLE",
    });
  });
  expect(screen.getByRole("status", { name: "Canonical fingertip tracking" })).toHaveTextContent(
    "waiting for fresh tracking",
  );
  fireEvent.click(screen.getByRole("button", { name: "Stop & review" }));
  const blob = fixture.blobs.find((entry) => entry.type === "application/json")!;
  const text = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
  const trace = JSON.parse(text);
  expect(trace.frames).toHaveLength(10);
  expect(trace.frames[8].canonicalIndexTrack).toMatchObject({
    index: { accepted: true, coordinateSource: "FUSED", indexRef: "index-1" },
    readiness: { trackingEligible: true },
    calibration: { evaluated: false, samplesCollected: 0 },
  });
  expect(trace.frames[9]).toMatchObject({
    rawHandCount: 0,
    canonicalIndexTrack: {
      index: { accepted: false, reason: "INDEX_RESULT_UNAVAILABLE" },
      readiness: { trackingEligible: false },
    },
  });
  expect(text).not.toContain("PRIVATE_LEASE");
  expect(text).not.toContain("PRIVATE_INDEX");
  expect(fixture.constructors).toHaveBeenCalledTimes(1);
});
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
