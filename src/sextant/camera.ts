/** Sextant-owned exclusive browser camera lease. Consumers never acquire their own stream. */
export type CameraState =
  | "DISABLED"
  | "REQUESTING"
  | "READY"
  | "PERMISSION_DENIED"
  | "CAMERA_BUSY"
  | "UNSUPPORTED"
  | "SUSPENDED"
  | "ERROR";
export type CameraLease = { id: string; generation: number; stream: MediaStream; release(): void };
const reservations = new WeakMap<Pick<MediaDevices, "getUserMedia">, BrowserCameraBroker>();
export class BrowserCameraBroker {
  state: CameraState = "DISABLED";
  generation = 0;
  permission: "UNKNOWN" | "GRANTED" | "DENIED" = "UNKNOWN";
  private lease: CameraLease | null = null;
  private requesting = false;
  private detach = () => {};
  constructor(
    private media: Pick<MediaDevices, "getUserMedia"> | null,
    private change: (state: CameraState) => void = () => {},
  ) {}
  private set(state: CameraState) {
    this.state = state;
    this.change(state);
  }
  async acquire(consent: boolean, foreground: boolean, deviceId?: string): Promise<CameraLease> {
    if (!consent || !foreground) throw new Error("CAMERA_EXPLICIT_FOREGROUND_CONSENT_REQUIRED");
    if (this.lease || this.requesting) throw new Error("CAMERA_EXCLUSIVE_LEASE_BUSY");
    if (!this.media) {
      this.set("UNSUPPORTED");
      throw new Error("CAMERA_UNSUPPORTED");
    }
    if (reservations.has(this.media)) throw new Error("CAMERA_EXCLUSIVE_LEASE_BUSY");
    reservations.set(this.media, this);
    this.requesting = true;
    const generation = ++this.generation;
    let acquired: MediaStream | null = null;
    try {
      this.set("REQUESTING");
      const stream = await this.media.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
      });
      acquired = stream;
      if (generation !== this.generation) {
        stream.getTracks().forEach((t) => t.stop());
        acquired = null;
        throw new Error("CAMERA_REQUEST_CANCELLED");
      }
      this.permission = "GRANTED";
      if (
        stream.getVideoTracks().length !== 1 ||
        stream.getTracks().length !== 1 ||
        stream.getVideoTracks()[0].readyState !== "live"
      ) {
        stream.getTracks().forEach((t) => t.stop());
        acquired = null;
        throw new Error("CAMERA_VIDEO_TRACK_REQUIRED");
      }
      let endedDuringAcquisition = false;
      const ended = () => {
        if (generation !== this.generation) return;
        if (this.lease?.generation === generation) {
          this.permission = "UNKNOWN";
          this.release("SUSPENDED");
        } else endedDuringAcquisition = true;
      };
      stream.getVideoTracks().forEach((t) => t.addEventListener("ended", ended));
      this.detach = () => stream.getVideoTracks().forEach((t) => t.removeEventListener("ended", ended));
      if (generation !== this.generation || endedDuringAcquisition || stream.getVideoTracks()[0].readyState !== "live")
        throw new Error("CAMERA_SOURCE_ENDED_DURING_ACQUISITION");
      const lease = {
        id: crypto.randomUUID(),
        generation,
        stream,
        release: () => {
          if (this.lease?.generation === generation) this.release();
        },
      };
      this.lease = lease;
      acquired = null;
      this.set("READY");
      return lease;
    } catch (error) {
      if (acquired) {
        this.detach();
        this.detach = () => {};
        acquired.getTracks().forEach((t) => t.stop());
      }
      if (this.lease?.generation === generation) this.release("ERROR");
      if (
        generation === this.generation &&
        error instanceof DOMException &&
        ["NotAllowedError", "SecurityError"].includes(error.name)
      )
        this.permission = "DENIED";
      if (generation === this.generation)
        this.set(
          error instanceof Error && error.message === "CAMERA_SOURCE_ENDED_DURING_ACQUISITION"
            ? "SUSPENDED"
            : error instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(error.name)
              ? "PERMISSION_DENIED"
              : error instanceof DOMException && error.name === "NotReadableError"
                ? "CAMERA_BUSY"
                : "ERROR",
        );
      throw error;
    } finally {
      this.requesting = false;
      if (!this.lease && reservations.get(this.media) === this) reservations.delete(this.media);
    }
  }
  release(state: CameraState = "DISABLED") {
    ++this.generation;
    this.detach();
    this.detach = () => {};
    this.lease?.stream.getTracks().forEach((t) => t.stop());
    this.lease = null;
    if (this.media && !this.requesting && reservations.get(this.media) === this) reservations.delete(this.media);
    this.set(state);
  }
  get ownedTracks() {
    return this.lease?.stream.getTracks().filter((t) => t.readyState === "live").length ?? 0;
  }
  snapshot() {
    return {
      supported: this.media !== null,
      permission: this.permission,
      availability: this.state,
      generation: this.generation,
      leaseId: this.lease?.id ?? null,
    };
  }
}
