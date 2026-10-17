import { BrowserCameraBroker } from "@/sextant/camera";
import { BrowserHandAdapter, type HandInferenceBackend } from "@/watchglass/hand-provider";
import { ObservationGate, type HandObservation } from "./observation";
import {
  IndexImageTracker,
  indexImageAlgorithmDescriptor,
  type IndexImagePreparedToken,
  type IndexImageObservation,
} from "./index-image-tracker";
import { IndexImageObservationGate } from "./index-image-observation";
import { ReachTrackingPacer } from "./tracking-pacer";
import { selectIndexModelAnchor } from "./hand-detection-authority";
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
};
type IndexHint = { point: { x: number; y: number }; requestedAt: number };
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
  private imageTracker: IndexImageTracker | null = null;
  private imageCanvas: OffscreenCanvas | null = null;
  private imageContext: OffscreenCanvasRenderingContext2D | null = null;
  private preparedImage: { token: IndexImagePreparedToken; tracker: IndexImageTracker; hint: IndexHint | null } | null =
    null;
  private pendingImageCapture: number | null = null;
  private videoFrameCallback: number | undefined;
  private indexEnabled = false;
  private pendingIndexHint: IndexHint | null = null;
  constructor(
    private video: HTMLVideoElement,
    private observe: (o: HandObservation) => void,
    private status: (state: string) => void,
    media: Pick<MediaDevices, "getUserMedia"> | null = navigator.mediaDevices ?? null,
    private rawInference?: (frame: RawHandInference) => void,
    private indexObserve?: (observation: IndexImageObservation) => void,
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
    if (this.preparedImage) this.preparedImage.tracker.discard(this.preparedImage.token);
    this.preparedImage = null;
    this.pendingIndexHint = { point: { ...point }, requestedAt: performance.now() };
    return true;
  }
  trackingPacing() {
    return this.pacer?.diagnostics ?? null;
  }
  /** Lab phase only: active TRAINING/VALIDATION collection, excluding pauses. */
  setCalibrationCollecting(collecting: boolean) {
    this.calibrationCollecting = collecting;
    this.pacer?.setCalibrationCollecting(collecting);
  }
  setIndexTrackingEnabled(enabled: boolean) {
    this.indexEnabled = !!this.indexObserve && enabled;
    if (!this.indexEnabled) {
      this.imageTracker?.reset();
      this.imageTracker = null;
      this.imageCanvas = null;
      this.imageContext = null;
      this.preparedImage = null;
      this.pendingImageCapture = null;
      this.pendingIndexHint = null;
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
      let adapter: BrowserHandAdapter | null = null;
      let backend: HandInferenceBackend | null = null;
      let legacyBackend = false;
      const gate = new ObservationGate({ ...binding, orientation: 0 });
      const imageGate = this.indexObserve ? new IndexImageObservationGate({ ...binding, orientation: 0 }) : null;
      const worker = new Worker("/reach/hand-worker.js");
      this.worker = worker;
      this.status("MODEL_STARTING");
      this.startup = setTimeout(() => fail("MODEL_FAILURE"), 15000);
      let lastVideoTime = -1;
      let lastVideoFrame = 0;
      let presentedFrame = 0;
      let presentedMediaTime = -1;
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
            wakeFreshFrame();
          }
          this.videoFrameCallback = this.video.requestVideoFrameCallback(presented);
        };
        this.videoFrameCallback = this.video.requestVideoFrameCallback(presented);
      }
      const frameIdentity = () => {
        if (usesPresentedCallbacks) return { frame: presentedFrame, mediaTime: presentedMediaTime };
        const quality = this.video.getVideoPlaybackQuality();
        const frame = quality.totalVideoFrames - quality.droppedVideoFrames;
        return { frame: Number.isInteger(frame) && frame >= 0 ? frame : 0, mediaTime: this.video.currentTime };
      };
      let width = 0,
        height = 0;
      let lastCapture = -Infinity;
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
          try {
            const bitmap = await createImageBitmap(this.video);
            if (!this.active || generation !== this.generation) {
              bitmap.close();
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
                const hint = this.pendingIndexHint;
                if (!hint || capture >= hint.requestedAt) {
                  const token = this.imageTracker.prepare(
                    { data: gray, ...imageSize, capture, received: performance.now() },
                    hint?.point,
                  );
                  this.preparedImage = { token, tracker: this.imageTracker, hint };
                }
              } catch {
                this.imageTracker.discard();
                this.preparedImage = null;
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
      worker.onmessage = ({ data }) => {
        if (!this.active || generation !== this.generation || data.generation !== generation) return;
        if (data.type === "READY") {
          const selected = data.backend ?? "CPU_WASM";
          if (workerReady || selected !== "CPU_WASM") {
            fail("MODEL_BACKEND_CHANGED");
            return;
          }
          backend = selected;
          legacyBackend = data.backend === undefined;
          adapter = new BrowserHandAdapter(binding, "UNQUALIFIED", selected);
          workerReady = true;
          clearTimeout(this.startup);
          this.startup = undefined;
          this.status("READY");
          void pump();
        } else if (data.type === "RESULT") {
          if (!adapter || !backend || (data.backend ?? (legacyBackend ? "CPU_WASM" : null)) !== backend) {
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
            });
          } catch {
            // Optional local diagnostics must not interrupt inference.
          }
          let observation: HandObservation | null = null;
          try {
            observation = gate.accept(
              adapter.envelope(
                data.result,
                data.capture,
                data.inferenceTime - performance.timeOrigin,
                data.width,
                data.height,
              ),
              performance.now(),
            );
            this.observe(observation);
            this.status("READY");
          } catch {
            this.status("STALE_OR_INVALID_OBSERVATION");
          }
          const prepared = this.preparedImage;
          if (this.indexObserve && this.indexEnabled && this.pendingImageCapture !== null) {
            let imageAccepted = false;
            try {
              const received = performance.now();
              // Never relabel a stale model image or an older in-flight image
              // as a fresh response to an explicit selection.
              if (
                observation &&
                this.imageTracker &&
                imageGate &&
                prepared &&
                prepared.tracker === this.imageTracker &&
                this.pendingImageCapture === data.capture &&
                prepared.token.capture === data.capture &&
                received - prepared.token.capture <= 150 &&
                prepared.hint === this.pendingIndexHint
              ) {
                const model = selectIndexModelAnchor(observation);
                const tracked = this.imageTracker.complete(prepared.token, model, () => performance.now());
                this.pendingIndexHint = null;
                // Processing completion is current; capture remains the original
                // bitmap time. Gate independently enforces the150ms age limit.
                const accepted = imageGate.accept(
                  { ...tracked, sequence: imageSequence++, monotonicInferenceTime: performance.now() },
                  performance.now(),
                );
                imageAccepted = true;
                try {
                  this.indexObserve(accepted);
                } catch {
                  /* Optional consumer isolation. */
                }
              }
            } catch {
              // A rejected capture pauses evidence without closing the model.
            }
            if (!imageAccepted) this.status("STALE_OR_INVALID_OBSERVATION");
            prepared?.tracker.discard(prepared.token);
            this.preparedImage = null;
            this.pendingImageCapture = null;
          }
          const completed = performance.now();
          if (data.capture === lastCapture)
            pacer.recordCompleted(
              data.capture,
              completed,
              Math.min(completed - data.capture, imageCaptureCost + completed - resultStarted),
            );
          schedule();
        } else
          this.stop(
            ["MODEL_FETCH", "MODEL_INTEGRITY", "RUNTIME_INIT", "MODEL_INIT", "MODEL_INFERENCE"].includes(data.reason)
              ? `MODEL_FAILURE_${data.reason}`
              : "MODEL_FAILURE",
          );
      };
      worker.onerror = () => fail("MODEL_FAILURE");
      worker.postMessage({ type: "INIT", generation });
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
      timers: Number(this.timer !== undefined) + Number(this.startup !== undefined),
    };
  }
}
