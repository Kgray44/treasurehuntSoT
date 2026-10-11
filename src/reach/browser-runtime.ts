import { BrowserCameraBroker } from "@/sextant/camera";
import { BrowserHandAdapter } from "@/watchglass/hand-provider";
import { ObservationGate, type HandObservation } from "./observation";
export class ReachBrowserRuntime {
  readonly camera: BrowserCameraBroker;
  private generation = 0;
  private worker: Worker | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private startup: ReturnType<typeof setTimeout> | undefined;
  private inFlight = false;
  private detach = () => {};
  private active = false;
  constructor(
    private video: HTMLVideoElement,
    private observe: (o: HandObservation) => void,
    private status: (state: string) => void,
    media: Pick<MediaDevices, "getUserMedia"> | null = navigator.mediaDevices ?? null,
  ) {
    this.camera = new BrowserCameraBroker(media, (state) => {
      this.status(state);
      if (state === "SUSPENDED") this.stop("SUSPENDED");
    });
  }
  async start(consent: boolean, mirror: boolean, deviceId?: string) {
    this.stop();
    if (
      !window.isSecureContext ||
      typeof Worker === "undefined" ||
      typeof createImageBitmap === "undefined" ||
      typeof OffscreenCanvas === "undefined"
    ) {
      this.status("UNSUPPORTED");
      return;
    }
    this.active = true;
    const generation = ++this.generation;
    const fail = (reason: string) => {
      if (generation === this.generation) this.stop(reason);
    };
    const hidden = () => {
      if (document.visibilityState !== "visible") fail("SUSPENDED");
    };
    const freeze = () => fail("SUSPENDED");
    document.addEventListener("visibilitychange", hidden);
    document.addEventListener("freeze", freeze);
    window.addEventListener("pagehide", freeze);
    this.detach = () => {
      document.removeEventListener("visibilitychange", hidden);
      document.removeEventListener("freeze", freeze);
      window.removeEventListener("pagehide", freeze);
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
      const adapter = new BrowserHandAdapter(binding);
      const gate = new ObservationGate({ ...binding, orientation: 0 });
      const worker = new Worker("/reach/hand-worker.js");
      this.worker = worker;
      this.status("MODEL_STARTING");
      this.startup = setTimeout(() => fail("MODEL_FAILURE"), 15000);
      let lastVideoTime = -1;
      let width = 0,
        height = 0;
      const pump = async () => {
        if (!this.active || generation !== this.generation) return;
        if (!this.inFlight && this.video.readyState >= 2 && this.video.currentTime !== lastVideoTime) {
          if (width && (this.video.videoWidth !== width || this.video.videoHeight !== height)) {
            this.stop("FRAME_CHANGED_RECALIBRATE");
            return;
          }
          width = this.video.videoWidth;
          height = this.video.videoHeight;
          this.inFlight = true;
          lastVideoTime = this.video.currentTime;
          const capture = performance.now();
          try {
            const bitmap = await createImageBitmap(this.video);
            if (!this.active || generation !== this.generation) {
              bitmap.close();
              return;
            }
            worker.postMessage({ type: "FRAME", bitmap, capture, generation }, [bitmap]);
            this.timer = setTimeout(() => fail("INFERENCE_TIMEOUT"), 3000);
          } catch {
            fail("FRAME_FAILURE");
          }
        } else
          this.timer = setTimeout(() => {
            void pump();
          }, 40);
      };
      worker.onmessage = ({ data }) => {
        if (!this.active || generation !== this.generation || data.generation !== generation) return;
        if (data.type === "READY") {
          clearTimeout(this.startup);
          this.startup = undefined;
          this.status("READY");
          void pump();
        } else if (data.type === "RESULT") {
          clearTimeout(this.timer);
          this.timer = undefined;
          this.inFlight = false;
          try {
            this.observe(
              gate.accept(
                adapter.envelope(
                  data.result,
                  data.capture,
                  data.inferenceTime - performance.timeOrigin,
                  data.width,
                  data.height,
                ),
                performance.now(),
              ),
            );
            this.status("READY");
          } catch {
            this.status("STALE_OR_INVALID_OBSERVATION");
          }
          this.timer = setTimeout(() => {
            void pump();
          }, 40);
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
