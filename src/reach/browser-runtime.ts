import { BrowserCameraBroker, type CameraLease } from "@/sextant/camera";
import { BrowserExposureAssistance } from "@/sextant/browser-exposure";
import { browserVisualCapabilities } from "@/sextant/browser-visual-capabilities";
import { sampleImageSignal, type ImageLumaPlane } from "@/watchglass/image-signal";
import {
  BrowserHandAdapter,
  handModel,
  handProviderVersion,
  handStartupPolicy,
  type HandInferenceBackend,
  type HandInferencePolicy,
} from "@/watchglass/hand-provider";
import { ObservationGate, type HandObservation } from "./observation";
import {
  IndexImageTracker,
  indexImageAlgorithm,
  indexImageAlgorithmDescriptor,
  type IndexImagePreparedToken,
  type IndexImageObservation,
} from "./index-image-tracker";
import { IndexImageObservationGate } from "./index-image-observation";
import {
  ReachTrackingPacer,
  defaultReachTrackingLimits,
  parseReachTrackingLimits,
  reachTrackingPacingPolicy,
  type ReachTrackingLimits,
} from "./tracking-pacer";
import { selectIndexModelAnchor } from "./hand-detection-authority";
import {
  ReachCaptureHealth,
  defaultReachCaptureHealthPolicy,
  captureProcessingPressure,
  type CaptureImageSignal,
} from "./capture-health";
import { reachImmutableSafety } from "./runtime-policy";
import {
  ReachCaptureAssistance,
  type CaptureAssistanceAction,
  type CaptureAssistanceCandidate,
} from "./capture-assistance";
export type { IndexImageObservation } from "./index-image-tracker";
/** Passive, opt-in input for the local development recorder. No identity or lease data. */
export type RawHandInference = {
  result: unknown;
  capture: number;
  inference: number;
  received: number;
  videoTime: number;
  width: number;
  height: number;
  mirror: boolean;
  inferenceBackend?: HandInferenceBackend;
  inferencePolicy?: HandInferencePolicy;
};
/** Scalar diagnostics only. This callback never receives an image, identity or landmarks. */
export type ReachInferenceMetrics = {
  disposition: "ACCEPTED" | "LATE" | "INVALID";
  packetAgeMs: number;
  modelResultMs: number;
  preprocessingMs: number;
  frameIntervalMs: number | null;
  handCount: number | null;
};
type IndexHint = { point: { x: number; y: number }; requestedAt: number; attemptedCapture: number | null };
export class ReachBrowserRuntime {
  readonly camera: BrowserCameraBroker;
  private generation = 0;
  private worker: Worker | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private startup: ReturnType<typeof setTimeout> | undefined;
  private inFlight = false;
  private detach = () => {};
  private active = false;
  private pacer: ReachTrackingPacer | null = null;
  private calibrationCollecting = false;
  private trackingLimits: ReachTrackingLimits = { ...defaultReachTrackingLimits };
  private imageTracker: IndexImageTracker | null = null;
  private imageCanvas: OffscreenCanvas | null = null;
  private imageContext: OffscreenCanvasRenderingContext2D | null = null;
  private preparedImage: { token: IndexImagePreparedToken; tracker: IndexImageTracker; hint: IndexHint | null } | null =
    null;
  private pendingImageCapture: number | null = null;
  private videoFrameCallback: number | undefined;
  private indexEnabled = false;
  private pendingIndexHint: IndexHint | null = null;
  private manualIndexSelection = false;
  private readonly captureHealth = new ReachCaptureHealth();
  private captureHealthEpoch = 0;
  private lastUsableCapture = -Infinity;
  private pendingSignalPlane: (ImageLumaPlane & { capture: number }) | null = null;
  private diagnosticCapability: ReturnType<typeof browserVisualCapabilities> | null = null;
  private diagnosticTrack: MediaStreamTrack | null = null;
  private diagnosticLease: { id: string; generation: number } | null = null;
  private captureAssistance: ReachCaptureAssistance | null = null;
  private assistanceTimer: ReturnType<typeof setTimeout> | undefined;
  private assistanceTick = () => {};
  private stopCaptureAssistance = () => {};
  private cancelCaptureAssistance = () => {};
  private assistanceTransitioning = false;
  private assistanceFailure: string | null = null;
  private assistanceCostMs = 0;
  private diagnosticMode = 0;
  private diagnosticNotBefore = -Infinity;
  private diagnosticSourceBinding: string | null = null;
  private perception: {
    backend: HandInferenceBackend;
    policy: HandInferencePolicy;
    fallbackReason: string | null;
    startupMs: number;
  } | null = null;
  constructor(
    private video: HTMLVideoElement,
    private observe: (o: HandObservation) => void,
    private status: (state: string) => void,
    media: Pick<MediaDevices, "getUserMedia"> | null = navigator.mediaDevices ?? null,
    private rawInference?: (frame: RawHandInference) => void,
    private indexObserve?: (observation: IndexImageObservation) => void,
    private inferenceMetrics?: (packet: ReachInferenceMetrics) => void,
  ) {
    this.indexEnabled = !!indexObserve;
    this.camera = new BrowserCameraBroker(media, (state) => {
      this.status(state);
      if (state === "SUSPENDED") this.stop("SUSPENDED");
    });
  }
  /** Explicit image hint, in unmirrored camera-normalized coordinates. */
  seedIndex(point: { x: number; y: number }) {
    if (
      !this.active ||
      !this.indexObserve ||
      !this.indexEnabled ||
      ![point.x, point.y].every(Number.isFinite) ||
      point.x < 0 ||
      point.x > 1 ||
      point.y < 0 ||
      point.y > 1
    )
      return false;
    // Use the next actual capture, never a new hint on an older in-flight image.
    this.cancelCaptureAssistance();
    if (this.preparedImage) this.preparedImage.tracker.discard(this.preparedImage.token);
    this.preparedImage = null;
    this.manualIndexSelection = true;
    this.pendingSignalPlane = null;
    this.captureHealth.reset();
    ++this.captureHealthEpoch;
    this.imageTracker?.requestManualSelection();
    this.pendingIndexHint = { point: { ...point }, requestedAt: performance.now(), attemptedCapture: null };
    return true;
  }
  indexSelectionMode(): "AUTOMATIC" | "MANUAL" {
    return this.manualIndexSelection ? "MANUAL" : "AUTOMATIC";
  }
  /** Explicit return to model seeding, never a reinterpretation of the mirror control. */
  clearIndexSelection() {
    if (!this.active || !this.indexEnabled) return false;
    this.cancelCaptureAssistance();
    if (this.preparedImage) this.preparedImage.tracker.discard(this.preparedImage.token);
    this.preparedImage = null;
    this.pendingIndexHint = null;
    this.manualIndexSelection = false;
    this.pendingSignalPlane = null;
    this.captureHealth.reset();
    ++this.captureHealthEpoch;
    this.imageTracker?.reset();
    return true;
  }
  trackingPacing() {
    return this.pacer?.diagnostics ?? null;
  }
  /** Local metadata only. Queries the authorized track once at acquisition, never from this getter. */
  captureDiagnostics() {
    const cached = this.diagnosticCapability;
    const leaseValid = this.diagnosticLeaseCurrent();
    const valid = leaseValid && cached?.currentAuthorizedLease;
    if (!leaseValid) this.captureHealth.reset();
    return {
      perception: leaseValid && this.perception ? { ...this.perception } : null,
      capabilities:
        valid && cached
          ? {
              ...cached,
              descriptor: { ...cached.descriptor, controls: { ...cached.descriptor.controls } },
              negotiated: { ...cached.negotiated, format: { ...cached.negotiated.format } },
            }
          : null,
      health: this.captureHealth.diagnose(performance.now()),
      assistance:
        (leaseValid || this.assistanceFailure) && this.captureAssistance
          ? {
              ...this.captureAssistance.snapshot(),
              reason: this.assistanceFailure ?? this.captureAssistance.snapshot().reason,
              transitioning: this.assistanceTransitioning,
              profile: "COLOR_RADIOMETRIC_COMPATIBILITY_NOT_PHYSICAL_QUALIFICATION" as const,
            }
          : null,
    };
  }
  private diagnosticLeaseCurrent() {
    const current = this.camera.snapshot();
    return (
      this.active &&
      current.availability === "READY" &&
      current.permission === "GRANTED" &&
      current.leaseId === this.diagnosticLease?.id &&
      current.generation === this.diagnosticLease?.generation &&
      this.diagnosticTrack?.readyState === "live"
    );
  }
  private captureHealthContext(sourceBinding: string) {
    return JSON.stringify([
      sourceBinding,
      this.indexEnabled ? indexImageAlgorithm.algorithmDigest : "MODEL",
      this.manualIndexSelection ? "MANUAL" : "AUTOMATIC",
      this.captureHealthEpoch,
      this.diagnosticMode,
    ]);
  }
  private installCaptureAssistance(lease: CameraLease, generation: number, backend: () => HandInferenceBackend | null) {
    const planner = new ReachCaptureAssistance(),
      exposure = new BrowserExposureAssistance(
        this.camera,
        lease,
        () => this.active && generation === this.generation && document.visibilityState === "visible",
      );
    this.captureAssistance = planner;
    this.assistanceFailure = null;
    this.assistanceTransitioning = false;
    type Attempt = {
      id: number;
      binding: string;
      controller: AbortController;
      started: number;
      applied: number | null;
      resource: { restore(): Promise<void> } | null;
      promise: Promise<{ restore(): Promise<void> }> | null;
    };
    let active: Attempt | null = null,
      watchdog: ReturnType<typeof setTimeout> | undefined,
      transition = 0;
    const current = () =>
      this.active &&
      generation === this.generation &&
      this.captureAssistance === planner &&
      this.diagnosticLeaseCurrent();
    const timed = (work: () => void) => {
      const at = performance.now();
      try {
        work();
      } finally {
        if (current()) this.assistanceCostMs += Math.max(0, performance.now() - at);
      }
    };
    const clearWatchdog = () => {
      if (watchdog !== undefined) {
        clearTimeout(watchdog);
        if (this.assistanceTimer === watchdog) this.assistanceTimer = undefined;
        watchdog = undefined;
      }
    };
    const newMode = () => {
      this.captureHealth.reset();
      ++this.diagnosticMode;
      this.diagnosticNotBefore = performance.now();
    };
    const candidates = (): CaptureAssistanceCandidate[] =>
      active !== null || (!this.assistanceTransitioning && exposure.available())
        ? [
            {
              id: "current-color-exposure",
              kind: "EXPOSURE",
              access: current() ? "AVAILABLE" : "UNKNOWN",
              authorized: current(),
              qualifiedProfile:
                backend() !== null && this.diagnosticSourceBinding
                  ? JSON.stringify([
                      "COLOR_RADIOMETRIC_COMPATIBILITY",
                      this.diagnosticSourceBinding,
                      handModel.modelDigest,
                      "CPU_WASM",
                    ])
                  : null,
              preservesPrimaryGeometry: true,
              work: "NEUTRAL",
              addresses: ["LIGHTING_OR_CONTRAST", "LOW_SUBJECT_SIGNAL"],
            },
          ]
        : [];
    const arm = () => {
      clearWatchdog();
      if (!current()) return;
      const deadline = planner.snapshot().deadlineMs,
        now = performance.now();
      if (deadline === null) return;
      watchdog = setTimeout(
        () => {
          const fired = watchdog;
          watchdog = undefined;
          if (this.assistanceTimer === fired) this.assistanceTimer = undefined;
          if (generation === this.generation && this.captureAssistance === planner) {
            if (current()) this.assistanceTick();
            else this.stopCaptureAssistance();
          }
        },
        Math.max(0, deadline - now),
      );
      this.assistanceTimer = watchdog;
    };
    const restoreAttempt = (attempt: Attempt) => {
      const token = ++transition;
      attempt.controller.abort();
      this.assistanceTransitioning = true;
      this.diagnosticNotBefore = Infinity;
      const restore = attempt.resource
        ? attempt.resource.restore()
        : attempt.promise?.then(
            (resource) => resource.restore(),
            (error) => {
              if (String(error).includes("RESTORE_")) throw error;
            },
          );
      void Promise.resolve(restore).then(
        () => {
          if (!current() || token !== transition) return;
          timed(() => {
            this.assistanceTransitioning = false;
            newMode();
          });
        },
        () => {
          if (!current() || token !== transition) return;
          this.assistanceTransitioning = false;
          this.assistanceFailure = "EXPOSURE_RESTORE_FAILED";
          // Do not claim a new baseline if the driver's restoration was not confirmed.
          this.stop("CAPTURE_CONTROL_RESTORE_FAILED");
        },
      );
    };
    const execute = (actions: CaptureAssistanceAction[]) => {
      for (const action of actions) {
        if (action.type === "RELEASE") {
          if (active?.id === action.requestId && active.binding === action.context) {
            const previous = active;
            active = null;
            clearWatchdog();
            restoreAttempt(previous);
          }
          continue;
        }
        if (!current() || active || action.candidate.kind !== "EXPOSURE" || this.assistanceTransitioning) continue;
        const attempt: Attempt = {
          id: action.requestId,
          binding: action.context,
          controller: new AbortController(),
          started: performance.now(),
          applied: null,
          resource: null,
          promise: null,
        };
        active = attempt;
        this.assistanceFailure = null;
        this.assistanceTransitioning = true;
        this.diagnosticNotBefore = Infinity;
        this.captureHealth.reset();
        attempt.promise = exposure.start(attempt.controller.signal);
        void attempt.promise.then(
          (resource) => {
            if (!current() || active !== attempt || attempt.controller.signal.aborted) {
              void resource.restore().catch(() => {});
              return;
            }
            timed(() => {
              attempt.resource = resource;
              attempt.applied = performance.now();
              this.assistanceTransitioning = false;
              newMode();
              execute(
                planner.acknowledge(
                  attempt.id,
                  attempt.binding,
                  this.captureHealthContext(attempt.binding),
                  true,
                  performance.now(),
                ),
              );
              arm();
            });
          },
          () => {
            if (!current() || active !== attempt) return;
            timed(() => {
              this.assistanceFailure = "EXPOSURE_CONTROL_FAILED";
              execute(planner.acknowledge(attempt.id, attempt.binding, "", false, performance.now()));
              arm();
            });
          },
        );
      }
    };
    this.assistanceTick = () => {
      if (!current()) return;
      timed(() => {
        const binding = this.diagnosticSourceBinding ?? "";
        execute(
          planner.update(
            {
              binding,
              enabled: this.active,
              foreground: document.visibilityState === "visible",
              authorized: current(),
            },
            this.captureHealth.diagnose(performance.now()),
            candidates(),
            performance.now(),
          ),
        );
        arm();
      });
    };
    this.cancelCaptureAssistance = () => {
      if (!current()) return;
      timed(() => {
        execute(
          planner.update(
            { binding: this.diagnosticSourceBinding ?? "", enabled: false, foreground: true, authorized: true },
            this.captureHealth.diagnose(performance.now()),
            [],
            performance.now(),
          ),
        );
        clearWatchdog();
      });
    };
    this.stopCaptureAssistance = () => {
      clearWatchdog();
      const previous = active;
      active = null;
      ++transition;
      previous?.controller.abort();
      try {
        planner.update(
          { binding: this.diagnosticSourceBinding ?? "", enabled: false, foreground: false, authorized: false },
          this.captureHealth.diagnose(performance.now()),
          [],
          performance.now(),
        );
      } catch {
        /* Cleanup remains independent of diagnostic clock errors. */
      }
      void previous?.resource?.restore().catch(() => {});
      void exposure.release().catch(() => {});
      this.assistanceTransitioning = false;
    };
  }
  private measureCaptureSignal(
    plane: ImageLumaPlane,
    point: { x: number; y: number } | null,
  ): CaptureImageSignal | null {
    const radius = indexImageAlgorithmDescriptor.policy.radius;
    const x = point ? Math.max(0, Math.floor(point.x * (plane.width - 1)) - radius) : 0;
    const y = point ? Math.max(0, Math.floor(point.y * (plane.height - 1)) - radius) : 0;
    const measurement = sampleImageSignal(
      plane,
      point
        ? {
            kind: "ROI",
            x,
            y,
            width: Math.min(plane.width - x, radius * 2 + 1),
            height: Math.min(plane.height - y, radius * 2 + 1),
          }
        : { kind: "WHOLE_FRAME" },
    );
    if (measurement.status !== "MEASURED" || measurement.meanAbsoluteLaplacian === null) return null;
    const unit = (n: number) => Math.max(0, Math.min(1, n));
    return {
      scope: point ? "SUBJECT_REGION" : "WHOLE_FRAME",
      meanLuminance: unit(measurement.meanLuma / 255),
      luminanceDeviation: unit(measurement.contrastStandardDeviation / 127.5),
      detail: unit(measurement.meanAbsoluteLaplacian / 1020),
    };
  }
  /** Lab phase only: active TRAINING/VALIDATION collection, excluding pauses. */
  setCalibrationCollecting(collecting: boolean) {
    this.calibrationCollecting = collecting;
    this.pacer?.setCalibrationCollecting(collecting);
  }
  setTrackingLimits(limits: ReachTrackingLimits) {
    const checked = parseReachTrackingLimits(limits);
    this.pacer?.setTrackingLimits(checked);
    this.trackingLimits = checked;
  }
  setIndexTrackingEnabled(enabled: boolean) {
    const next = !!this.indexObserve && enabled;
    if (this.indexEnabled !== next) {
      this.cancelCaptureAssistance();
      this.captureHealth.reset();
      ++this.captureHealthEpoch;
    }
    this.indexEnabled = next;
    if (!this.indexEnabled) {
      this.pendingSignalPlane = null;
      this.imageTracker?.reset();
      this.imageTracker = null;
      this.imageCanvas = null;
      this.imageContext = null;
      this.preparedImage = null;
      this.pendingImageCapture = null;
      this.pendingIndexHint = null;
      this.manualIndexSelection = false;
    }
  }
  async start(consent: boolean, mirror: boolean, deviceId?: string) {
    this.stop();
    if (
      !window.isSecureContext ||
      typeof Worker === "undefined" ||
      typeof createImageBitmap === "undefined" ||
      typeof OffscreenCanvas === "undefined" ||
      (typeof this.video.requestVideoFrameCallback !== "function" &&
        typeof this.video.getVideoPlaybackQuality !== "function")
    ) {
      this.status("UNSUPPORTED");
      return;
    }
    this.active = true;
    const pacer = new ReachTrackingPacer();
    this.pacer = pacer;
    pacer.setTrackingLimits(this.trackingLimits);
    pacer.setFocused(document.hasFocus());
    pacer.setCalibrationCollecting(this.calibrationCollecting);
    const generation = ++this.generation;
    const fail = (reason: string) => {
      if (generation === this.generation) this.stop(reason);
    };
    const hidden = () => {
      if (document.visibilityState !== "visible") fail("SUSPENDED");
    };
    const freeze = () => fail("SUSPENDED");
    const focus = () => pacer.setFocused(true);
    const blur = () => pacer.setFocused(false);
    document.addEventListener("visibilitychange", hidden);
    document.addEventListener("freeze", freeze);
    window.addEventListener("pagehide", freeze);
    window.addEventListener("focus", focus);
    window.addEventListener("blur", blur);
    this.detach = () => {
      document.removeEventListener("visibilitychange", hidden);
      document.removeEventListener("freeze", freeze);
      window.removeEventListener("pagehide", freeze);
      window.removeEventListener("focus", focus);
      window.removeEventListener("blur", blur);
    };
    try {
      this.startup = setTimeout(() => fail("CAMERA_REQUEST_TIMEOUT"), 30000);
      const lease = await this.camera.acquire(consent, document.visibilityState === "visible", deviceId);
      if (!this.active || generation !== this.generation || document.visibilityState !== "visible") {
        lease.release();
        fail("SUSPENDED");
        return;
      }
      clearTimeout(this.startup);
      this.startup = undefined;
      this.video.srcObject = lease.stream;
      this.startup = setTimeout(() => fail("CAMERA_FRAME_TIMEOUT"), 5000);
      await this.video.play();
      if (!this.active || generation !== this.generation || document.visibilityState !== "visible") {
        fail("SUSPENDED");
        return;
      }
      clearTimeout(this.startup);
      this.startup = undefined;
      const binding = {
        providerGeneration: generation,
        cameraLeaseId: lease.id,
        cameraFrameVersion: lease.generation,
        mirrorTransform: mirror ? ("PREVIEW_X" as const) : ("NONE" as const),
      };
      this.diagnosticLease = { id: lease.id, generation: lease.generation };
      this.diagnosticTrack = lease.stream.getVideoTracks()[0] ?? null;
      try {
        this.diagnosticCapability = browserVisualCapabilities(this.camera.snapshot(), this.diagnosticTrack, {
          providerId: "sextant.browser-video",
          providerVersion: "1",
          ephemeralSourceId: lease.id,
          ephemeralGroupId: null,
          leaseId: lease.id,
          leaseGeneration: lease.generation,
        });
      } catch {
        this.diagnosticCapability = null;
      }
      let adapter: BrowserHandAdapter | null = null;
      let backend: HandInferenceBackend | null = null;
      let legacyBackend = false;
      let inferencePolicy: HandInferencePolicy = "ORIGINAL_CPU";
      let legacyPolicy = false;
      this.installCaptureAssistance(lease, generation, () => backend);
      const gate = new ObservationGate({ ...binding, orientation: 0 });
      const imageGate = this.indexObserve ? new IndexImageObservationGate({ ...binding, orientation: 0 }) : null;
      let worker = new Worker("/reach/recovery-worker.js");
      this.worker = worker;
      this.status("MODEL_STARTING");
      const modelStartup = performance.now();
      const modelDeadline = modelStartup + handStartupPolicy.totalMs;
      let originalStartup = false;
      let startupFallbackReason: string | null = null;
      let lastVideoTime = -1;
      let lastVideoFrame = 0;
      let presentedFrame = 0;
      let presentedMediaTime = -1;
      let presentedOriginTime: number | null = null;
      let pendingFrameOrigin: { capture: number; origin: number } | null = null;
      // Keep pixel age separate from the serialized dispatch clock used by the
      // worker and pacer. A camera frame can originate during the prior inference.
      const originFresh = (origin: number | null, now: number) =>
        origin !== null &&
        Number.isFinite(origin) &&
        origin >= 0 &&
        origin <= now + 5 &&
        now - origin <= reachImmutableSafety.maximumObservationAgeMs;
      let workerReady = false;
      let wakeFreshFrame = () => {};
      const usesPresentedCallbacks = typeof this.video.requestVideoFrameCallback === "function";
      if (usesPresentedCallbacks) {
        const presented = (_at: number, metadata: VideoFrameCallbackMetadata) => {
          if (!this.active || generation !== this.generation) return;
          if (
            Number.isInteger(metadata.presentedFrames) &&
            metadata.presentedFrames > 0 &&
            Number.isFinite(metadata.mediaTime)
          ) {
            presentedFrame = metadata.presentedFrames;
            presentedMediaTime = metadata.mediaTime;
            const origin = metadata.captureTime === undefined ? metadata.presentationTime : metadata.captureTime;
            presentedOriginTime =
              Number.isFinite(metadata.presentationTime) &&
              metadata.presentationTime >= 0 &&
              metadata.presentationTime <= performance.now() + 5 &&
              Number.isFinite(origin) &&
              origin >= 0 &&
              origin <= metadata.presentationTime + 5
                ? origin
                : null;
            wakeFreshFrame();
          }
          this.videoFrameCallback = this.video.requestVideoFrameCallback(presented);
        };
        this.videoFrameCallback = this.video.requestVideoFrameCallback(presented);
      }
      const frameIdentity = () => {
        if (usesPresentedCallbacks) return { frame: presentedFrame, mediaTime: presentedMediaTime };
        const quality = this.video.getVideoPlaybackQuality();
        // This fallback proves presentation progress, not sensor throughput:
        // total also includes predecode drops, so it cannot replace the difference.
        const frame = quality.totalVideoFrames - quality.droppedVideoFrames;
        return { frame: Number.isInteger(frame) && frame >= 0 ? frame : 0, mediaTime: this.video.currentTime };
      };
      let width = 0,
        height = 0;
      let lastCapture = -Infinity;
      let lastMetricCapture: number | null = null;
      let imageCaptureCost = 0;
      let imageSequence = 0;
      let captureDue: number | null = null;
      const schedule = () => {
        clearTimeout(this.timer);
        const now = performance.now(),
          delay = pacer.nextDelay(now, lastCapture),
          expected = now + delay;
        captureDue = expected;
        // One in-flight inference supplies backpressure. The measured main-
        // thread/total latency budget adapts the ceiling without a fixed idle.
        this.timer = setTimeout(() => {
          captureDue = null;
          pacer.recordTimerLateness(expected, performance.now());
          void pump();
        }, delay);
      };
      const pump = async () => {
        if (!this.active || generation !== this.generation || !workerReady || this.inFlight) return;
        this.timer = undefined;
        // A pending fast timer cannot bypass a newly lowered phase/focus cap.
        if (pacer.nextDelay(performance.now(), lastCapture) > 0) {
          schedule();
          return;
        }
        const identity = frameIdentity();
        if (identity.frame < lastVideoFrame) {
          fail("FRAME_IDENTITY_RESTARTED");
          return;
        }
        if (!this.inFlight && this.video.readyState >= 2 && identity.frame > lastVideoFrame) {
          if (usesPresentedCallbacks && !originFresh(presentedOriginTime, performance.now())) {
            // Consume this old presentation and wait for a genuinely newer one;
            // taking another bitmap must not relabel old pixels as fresh input.
            lastVideoFrame = identity.frame;
            this.status("STALE_OR_INVALID_OBSERVATION");
            return;
          }
          if (width && (this.video.videoWidth !== width || this.video.videoHeight !== height)) {
            this.stop("FRAME_CHANGED_RECALIBRATE");
            return;
          }
          width = this.video.videoWidth;
          height = this.video.videoHeight;
          this.inFlight = true;
          lastVideoFrame = identity.frame;
          lastVideoTime = identity.mediaTime;
          const capture = performance.now();
          lastCapture = capture;
          pendingFrameOrigin =
            usesPresentedCallbacks && presentedOriginTime !== null ? { capture, origin: presentedOriginTime } : null;
          try {
            const bitmap = await createImageBitmap(this.video);
            if (!this.active || generation !== this.generation) {
              bitmap.close();
              return;
            }
            if (pendingFrameOrigin && !originFresh(pendingFrameOrigin.origin, performance.now())) {
              bitmap.close();
              this.inFlight = false;
              pendingFrameOrigin = null;
              this.status("STALE_OR_INVALID_OBSERVATION");
              schedule();
              return;
            }
            const imageStarted = performance.now();
            imageCaptureCost = 0;
            let imageSize: { width: number; height: number } | null = null;
            if (this.indexObserve && this.indexEnabled) {
              this.pendingImageCapture = capture;
              try {
                const maximum = indexImageAlgorithmDescriptor.policy.maximumAnalysisDimension;
                const ratio = Math.min(1, maximum / width, maximum / height);
                const imageWidth = Math.round(width * ratio),
                  imageHeight = Math.round(height * ratio);
                if (!this.imageCanvas) {
                  this.imageCanvas = new OffscreenCanvas(imageWidth, imageHeight);
                  this.imageContext = this.imageCanvas.getContext("2d", { willReadFrequently: true });
                  this.imageTracker = new IndexImageTracker({ ...binding, frameWidth: width, frameHeight: height });
                  if (this.manualIndexSelection) this.imageTracker.requestManualSelection();
                }
                if (this.imageContext) {
                  // This exact bitmap goes to the model below. Its clean pixels
                  // and model capture clock stay paired until RESULT arrives.
                  this.imageContext.drawImage(bitmap, 0, 0, imageWidth, imageHeight);
                  imageSize = { width: imageWidth, height: imageHeight };
                }
              } catch {
                // Optional image evidence cannot interrupt the hand pipeline.
                this.preparedImage = null;
              }
            }
            worker.postMessage({ type: "FRAME", bitmap, capture, generation }, [bitmap]);
            this.timer = setTimeout(() => fail("INFERENCE_TIMEOUT"), 3000);
            if (imageSize && this.imageContext && this.imageTracker) {
              try {
                // The canvas already owns the exact transferred bitmap pixels.
                // Readback and NCC can overlap worker inference; only the paired
                // RESULT may commit identity, authority or an actionable point.
                const rgba = this.imageContext.getImageData(0, 0, imageSize.width, imageSize.height).data;
                const gray = new Uint8Array(imageSize.width * imageSize.height);
                for (let i = 0; i < gray.length; ++i)
                  gray[i] = (rgba[i * 4] * 77 + rgba[i * 4 + 1] * 150 + rgba[i * 4 + 2] * 29) >> 8;
                if (
                  this.pendingIndexHint &&
                  capture - this.pendingIndexHint.requestedAt >
                    indexImageAlgorithmDescriptor.manualAnchor.maximumDispatchAgeMs
                )
                  this.pendingIndexHint = null;
                const hint = this.pendingIndexHint;
                if (!hint || capture >= hint.requestedAt) {
                  if (hint) hint.attemptedCapture = capture;
                  const token = this.imageTracker.prepare(
                    { data: gray, ...imageSize, capture, received: performance.now() },
                    hint?.point,
                  );
                  this.preparedImage = { token, tracker: this.imageTracker, hint };
                  this.pendingSignalPlane = { data: gray, ...imageSize, rowStrideBytes: imageSize.width, capture };
                }
              } catch {
                this.imageTracker.discard();
                this.preparedImage = null;
                this.pendingSignalPlane = null;
              }
              imageCaptureCost = performance.now() - imageStarted;
            }
          } catch {
            fail("FRAME_FAILURE");
          }
        } else if (!usesPresentedCallbacks) {
          const now = performance.now(),
            delay = Math.max(8, pacer.intervalMs, pacer.nextDelay(now, lastCapture)),
            expected = now + delay;
          captureDue = expected;
          this.timer = setTimeout(() => {
            captureDue = null;
            pacer.recordTimerLateness(expected, performance.now());
            void pump();
          }, delay);
        }
      };
      wakeFreshFrame = () => {
        if (!this.active || generation !== this.generation || !workerReady || this.inFlight) return;
        if (presentedFrame === lastVideoFrame) return;
        if (captureDue !== null && performance.now() > captureDue)
          pacer.recordTimerLateness(captureDue, performance.now());
        // A due capture that found no frame waits for the presentation event,
        // rather than sleeping another whole capture interval.
        schedule();
      };
      const receive = ({ data }: MessageEvent) => {
        if (!this.active || generation !== this.generation || data.generation !== generation) return;
        if (data.type === "READY") {
          if (performance.now() >= modelDeadline) {
            fail("MODEL_FAILURE");
            return;
          }
          if (!originalStartup && performance.now() - modelStartup >= handStartupPolicy.optionalAccelerationMs) {
            fallbackOriginal("RECOVERY_STARTUP_TIMEOUT");
            return;
          }
          const selected = data.backend ?? "CPU_WASM";
          const selectedPolicy = data.providerPolicy ?? "ORIGINAL_CPU";
          if (
            workerReady ||
            !["CPU_WASM", "GPU_WEBGL"].includes(selected) ||
            !["ORIGINAL_CPU", "WATCHGLASS_ACTUAL_ROI_RECOVERY_V1"].includes(selectedPolicy) ||
            (selected === "GPU_WEBGL" && selectedPolicy !== "WATCHGLASS_ACTUAL_ROI_RECOVERY_V1")
          ) {
            fail("MODEL_BACKEND_CHANGED");
            return;
          }
          backend = selected;
          inferencePolicy = selectedPolicy;
          legacyBackend = data.backend === undefined;
          legacyPolicy = data.providerPolicy === undefined;
          adapter = new BrowserHandAdapter(binding, "UNQUALIFIED", selected, inferencePolicy);
          this.perception = {
            backend: selected,
            policy: inferencePolicy,
            fallbackReason: startupFallbackReason ?? data.fallbackReason ?? null,
            startupMs: performance.now() - modelStartup,
          };
          workerReady = true;
          clearTimeout(this.startup);
          this.startup = undefined;
          this.status("READY");
          void pump();
        } else if (data.type === "RESULT") {
          if (
            !adapter ||
            !backend ||
            (data.backend ?? (legacyBackend ? "CPU_WASM" : null)) !== backend ||
            (data.providerPolicy ?? (legacyPolicy ? "ORIGINAL_CPU" : null)) !== inferencePolicy
          ) {
            fail("MODEL_BACKEND_CHANGED");
            return;
          }
          const resultStarted = performance.now();
          clearTimeout(this.timer);
          this.timer = undefined;
          this.inFlight = false;
          // Recording is separate from observation eligibility. Include rejected
          // raw results so a fixture cannot silently contain only good frames.
          // A recorder failure must never alter the normal tracking lifecycle.
          try {
            this.rawInference?.({
              result: data.result,
              capture: data.capture,
              inference: data.inferenceTime - performance.timeOrigin,
              received: performance.now(),
              videoTime: lastVideoTime,
              width: data.width,
              height: data.height,
              mirror,
              inferenceBackend: backend,
              inferencePolicy,
            });
          } catch {
            // Optional local diagnostics must not interrupt inference.
          }
          let observation: HandObservation | null = null;
          let gateTime = performance.now();
          const frameOrigin =
            pendingFrameOrigin && pendingFrameOrigin.capture === data.capture ? pendingFrameOrigin.origin : null;
          const originExpired = () => frameOrigin !== null && !originFresh(frameOrigin, performance.now());
          const captureFresh = () =>
            !originExpired() && performance.now() - data.capture <= reachImmutableSafety.maximumObservationAgeMs;
          try {
            if (!captureFresh()) throw new Error("OBSERVATION_PIXEL_ORIGIN_STALE");
            const gated: { observation: HandObservation | null } = { observation: null };
            adapter.envelope(
              data.result,
              data.capture,
              data.inferenceTime - performance.timeOrigin,
              data.width,
              data.height,
              (candidate) => {
                if (!captureFresh()) return false;
                if (candidate) {
                  gateTime = performance.now();
                  // Commit the gate and adapter together. A rejected schema,
                  // future clock or source cannot advance association history.
                  gated.observation = gate.accept(
                    frameOrigin === null ? candidate : { ...candidate, monotonicPixelOriginTime: frameOrigin },
                    gateTime,
                    captureFresh,
                  );
                }
                return true;
              },
            );
            if (!gated.observation) throw new Error("OBSERVATION_NOT_GATED");
            observation = gated.observation;
            this.observe(observation);
            this.status("READY");
          } catch {
            gateTime = performance.now();
            this.status("STALE_OR_INVALID_OBSERVATION");
          }
          if (this.inferenceMetrics) {
            try {
              this.inferenceMetrics({
                disposition: observation
                  ? "ACCEPTED"
                  : originExpired() || gateTime - data.capture > 150
                    ? "LATE"
                    : "INVALID",
                packetAgeMs: Math.max(gateTime - data.capture, frameOrigin === null ? 0 : gateTime - frameOrigin),
                modelResultMs: data.inferenceTime - performance.timeOrigin - data.capture,
                preprocessingMs: imageCaptureCost,
                frameIntervalMs: lastMetricCapture === null ? null : data.capture - lastMetricCapture,
                handCount: observation?.hands.length ?? null,
              });
            } catch {
              // Optional aggregate diagnostics cannot alter capture or eligibility.
            }
            lastMetricCapture = data.capture;
          }
          const prepared = this.preparedImage;
          let modelAnchor: ReturnType<typeof selectIndexModelAnchor> = null;
          let modelSelectionFailed = false;
          try {
            if (observation) modelAnchor = selectIndexModelAnchor(observation);
          } catch {
            modelSelectionFailed = true;
          }
          let imageObservation: IndexImageObservation | null = null;
          if (this.indexObserve && this.indexEnabled && this.pendingImageCapture !== null) {
            let imageAccepted = false;
            try {
              const received = performance.now();
              // Never relabel a stale model image or an older in-flight image
              // as a fresh response to an explicit selection.
              if (
                observation &&
                !modelSelectionFailed &&
                this.imageTracker &&
                imageGate &&
                prepared &&
                prepared.tracker === this.imageTracker &&
                this.pendingImageCapture === data.capture &&
                prepared.token.capture === data.capture &&
                received - prepared.token.capture <= 150 &&
                !originExpired() &&
                prepared.hint === this.pendingIndexHint
              ) {
                const tracked = this.imageTracker.complete(
                  prepared.token,
                  modelAnchor,
                  () => performance.now(),
                  captureFresh,
                );
                if (!captureFresh()) throw new Error("OBSERVATION_PIXEL_ORIGIN_STALE");
                // Processing completion is current; capture remains the original
                // bitmap time. Gate independently enforces the150ms age limit.
                const accepted = imageGate.accept(
                  {
                    ...tracked,
                    sequence: imageSequence++,
                    monotonicInferenceTime: performance.now(),
                    ...(frameOrigin === null ? {} : { monotonicPixelOriginTime: frameOrigin }),
                  },
                  performance.now(),
                  captureFresh,
                );
                if (!captureFresh()) throw new Error("OBSERVATION_PIXEL_ORIGIN_STALE");
                imageAccepted = true;
                imageObservation = accepted;
                try {
                  this.indexObserve(accepted);
                } catch {
                  /* Optional consumer isolation. */
                }
              }
            } catch {
              // A rejected capture pauses evidence without closing the model.
            }
            // An attempted selection belongs to one source image. Replaying its
            // old coordinates after a rejected capture could select a moved hand
            // or background. Keep manual intent, but require a fresh selection.
            if (this.pendingIndexHint && this.pendingIndexHint.attemptedCapture !== null) this.pendingIndexHint = null;
            if (!imageAccepted) this.status("STALE_OR_INVALID_OBSERVATION");
            prepared?.tracker.discard(prepared.token);
            this.preparedImage = null;
            this.pendingImageCapture = null;
          }
          const signalPlane = this.pendingSignalPlane;
          this.pendingSignalPlane = null;
          let imageSignal: CaptureImageSignal | null = null;
          try {
            if (
              observation &&
              (!this.indexEnabled || imageObservation !== null) &&
              signalPlane &&
              signalPlane.capture === data.capture &&
              data.capture === lastCapture &&
              performance.now() - data.capture <= reachImmutableSafety.maximumObservationAgeMs
            ) {
              const point = imageObservation?.matchedPoint ?? imageObservation?.point ?? modelAnchor?.point ?? null;
              imageSignal = this.measureCaptureSignal(signalPlane, point);
            }
          } catch {
            /* Optional measured signal cannot interrupt the hand/image pipeline. */
          }
          const completed = performance.now();
          if (data.capture === lastCapture) {
            pacer.recordCompleted(
              data.capture,
              completed,
              Math.min(completed - data.capture, imageCaptureCost + completed - resultStarted + this.assistanceCostMs),
            );
            this.assistanceCostMs = 0;
          }
          // Diagnostic evidence cannot authorize capture, pointer output or calibration.
          try {
            if (!this.diagnosticLeaseCurrent()) this.captureHealth.reset();
            else if (data.capture === lastCapture && data.capture >= this.diagnosticNotBefore) {
              const reason = imageObservation?.reason ?? "";
              const identityConflict =
                reason.includes("CONFLICT") ||
                reason.includes("AMBIGUOUS") ||
                modelAnchor?.authority === "AMBIGUOUS" ||
                !!observation?.hands.some((h) => h.continuity === "AMBIGUOUS");
              const contraryGesture =
                reason.includes("CONTRARY") ||
                (!identityConflict && !!modelAnchor?.contrary && imageObservation?.modelAgreement !== "DISAGREE");
              const freshImageContinuity = !!(imageObservation?.point || imageObservation?.matchedPoint);
              const usablePoint = this.indexEnabled ? !!imageObservation?.point : !!modelAnchor?.pointing;
              if (observation && usablePoint && !contraryGesture && !identityConflict)
                this.lastUsableCapture = data.capture;
              const diagnostics = pacer.diagnostics;
              const measuredPressure = captureProcessingPressure(
                diagnostics,
                reachTrackingPacingPolicy.timerToleranceMs,
              );
              const sourceBinding = JSON.stringify([
                handModel.providerId,
                handProviderVersion(inferencePolicy),
                handModel.modelId,
                handModel.modelVersion,
                handModel.modelDigest,
                backend,
                generation,
                lease.id,
                lease.generation,
                width,
                height,
                binding.mirrorTransform,
                0,
              ]);
              this.diagnosticSourceBinding = sourceBinding;
              this.captureHealth.record({
                sourceBinding,
                context: this.captureHealthContext(sourceBinding),
                captureMs: data.capture,
                receivedMs: performance.now(),
                accepted: !!observation,
                trackingExpected:
                  this.calibrationCollecting ||
                  this.manualIndexSelection ||
                  (!contraryGesture && completed - this.lastUsableCapture <= defaultReachCaptureHealthPolicy.windowMs),
                usablePoint,
                modelHandPresent: !!observation?.hands.length,
                freshImageContinuity,
                identityConflict,
                contraryGesture,
                processingPressure: measuredPressure,
                imageSignal,
              });
            }
            this.assistanceTick();
          } catch {
            /* Read-only diagnostics cannot interrupt the existing pipeline. */
          }
          pendingFrameOrigin = null;
          schedule();
        } else if (
          !workerReady &&
          !originalStartup &&
          !/INTEGRITY|ARCHIVE|CLEANUP|CLOSE_FAILED/.test(String(data.reason))
        ) {
          fallbackOriginal("RECOVERY_STARTUP_UNAVAILABLE");
        } else
          this.stop(
            ["MODEL_FETCH", "MODEL_INTEGRITY", "RUNTIME_INIT", "MODEL_INIT", "MODEL_INFERENCE"].includes(data.reason)
              ? `MODEL_FAILURE_${data.reason}`
              : "MODEL_FAILURE",
          );
      };
      const install = (current: Worker, delegate?: "GPU") => {
        current.onmessage = (event) => {
          if (current === worker) receive(event);
        };
        current.onerror = () => {
          if (current !== worker) return;
          if (!workerReady && !originalStartup) fallbackOriginal("RECOVERY_STARTUP_UNAVAILABLE");
          else fail("MODEL_FAILURE");
        };
        current.postMessage({
          type: "INIT",
          generation,
          geometryVersion: lease.generation,
          mirrorTransform: binding.mirrorTransform,
          ...(delegate ? { delegate } : {}),
        });
      };
      const fallbackOriginal = (reason: string) => {
        if (workerReady || originalStartup || !this.active || generation !== this.generation) return;
        originalStartup = true;
        startupFallbackReason = reason;
        worker.onmessage = null;
        worker.onerror = null;
        worker.terminate();
        clearTimeout(this.startup);
        const remaining = modelDeadline - performance.now();
        if (remaining <= 0) {
          fail("MODEL_FAILURE");
          return;
        }
        try {
          worker = new Worker("/reach/hand-worker.js");
          this.worker = worker;
          this.startup = setTimeout(() => fail("MODEL_FAILURE"), remaining);
          install(worker);
        } catch {
          fail("MODEL_FAILURE");
        }
      };
      // Bounded acceleration startup. No camera frame is sent before READY.
      // Retire a slow optional worker before starting the original CPU path;
      // both attempts share the existing total15s model-start deadline.
      this.startup = setTimeout(
        () => fallbackOriginal("RECOVERY_STARTUP_TIMEOUT"),
        handStartupPolicy.optionalAccelerationMs,
      );
      install(worker, "GPU");
    } catch (error) {
      if (generation === this.generation)
        this.stop(
          error instanceof Error && error.message === "CAMERA_EXCLUSIVE_LEASE_BUSY"
            ? "CAMERA_BUSY"
            : this.camera.state === "READY"
              ? "ERROR"
              : this.camera.state,
        );
    }
  }
  stop(reason = "DISABLED") {
    this.active = false;
    ++this.generation;
    this.stopCaptureAssistance();
    this.stopCaptureAssistance = () => {};
    this.cancelCaptureAssistance = () => {};
    this.assistanceTick = () => {};
    clearTimeout(this.assistanceTimer);
    this.assistanceTimer = undefined;
    clearTimeout(this.timer);
    clearTimeout(this.startup);
    this.timer = undefined;
    this.startup = undefined;
    this.detach();
    this.detach = () => {};
    this.worker?.terminate();
    this.worker = null;
    this.inFlight = false;
    if (this.videoFrameCallback !== undefined) this.video.cancelVideoFrameCallback?.(this.videoFrameCallback);
    this.videoFrameCallback = undefined;
    this.imageTracker?.reset();
    this.imageTracker = null;
    this.imageCanvas = null;
    this.imageContext = null;
    this.preparedImage = null;
    this.pendingImageCapture = null;
    this.pendingIndexHint = null;
    this.manualIndexSelection = false;
    this.pendingSignalPlane = null;
    this.captureHealth.reset();
    ++this.captureHealthEpoch;
    this.lastUsableCapture = -Infinity;
    this.diagnosticCapability = null;
    this.diagnosticTrack = null;
    this.diagnosticLease = null;
    this.assistanceCostMs = 0;
    this.diagnosticMode = 0;
    this.diagnosticNotBefore = -Infinity;
    this.diagnosticSourceBinding = null;
    this.perception = null;
    this.pacer = null;
    this.video.pause();
    this.video.srcObject = null;
    // Prevent recursive camera ended notification; listeners are removed before tracks stop.
    this.camera.release();
    this.status(reason);
  }
  resources() {
    return {
      tracks: this.camera.ownedTracks,
      workers: this.worker ? 1 : 0,
      timers:
        Number(this.timer !== undefined) +
        Number(this.startup !== undefined) +
        Number(this.assistanceTimer !== undefined),
    };
  }
}
