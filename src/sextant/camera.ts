/** Sextant-owned exclusive browser camera lease, including explicitly reserved SDK-owned acquisition. */
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
export type ExternalCameraReservation = { adopt(stream: MediaStream): CameraLease; release(): void };
const reservations = new WeakMap<Pick<MediaDevices, "getUserMedia">, BrowserCameraBroker>();
export class BrowserCameraBroker {
  state: CameraState = "DISABLED";
  generation = 0;
  permission: "UNKNOWN" | "GRANTED" | "DENIED" = "UNKNOWN";
  private lease: CameraLease | null = null;
  private requesting = false;
  private external: { generation: number; retire(): void } | null = null;
  private detach = () => {};
  constructor(
    private media: Pick<MediaDevices, "getUserMedia"> | null,
    private change: (state: CameraState) => void = () => {},
  ) {}
  private set(state: CameraState) {
    this.state = state;
    this.change(state);
  }
  /** Reserve exclusivity before a supported SDK opens the camera; no second getUserMedia request is made. */
  reserveExternal(consent: boolean, foreground: boolean, onRelease: () => void = () => {}): ExternalCameraReservation {
    if (!consent || !foreground) throw new Error("CAMERA_EXPLICIT_FOREGROUND_CONSENT_REQUIRED");
    if (this.lease || this.requesting || this.external) throw new Error("CAMERA_EXCLUSIVE_LEASE_BUSY");
    if (!this.media) {
      this.set("UNSUPPORTED");
      throw new Error("CAMERA_UNSUPPORTED");
    }
    if (reservations.has(this.media)) throw new Error("CAMERA_EXCLUSIVE_LEASE_BUSY");
    const generation = ++this.generation;
    let active = true;
    const ownership = {
      generation,
      retire: () => {
        if (!active) return;
        active = false;
        try {
          onRelease();
        } catch {
          /* Source cleanup cannot retain broker ownership. */
        }
      },
    };
    const owns = () => active && this.external === ownership && generation === this.generation;
    const stopUnowned = (stream: MediaStream) => {
      // A late callback must not stop a stream already adopted by a newer broker/session.
      const owner = this.media && reservations.get(this.media);
      if (owner?.lease?.stream !== stream) stream.getTracks().forEach((track) => track.stop());
    };
    const reservation: ExternalCameraReservation = {
      release: () => {
        if (owns()) this.release();
        else ownership.retire();
      },
      adopt: (stream) => {
        if (!owns()) {
          stopUnowned(stream);
          throw new Error("CAMERA_REQUEST_CANCELLED");
        }
        if (this.lease?.generation === generation && this.lease.stream === stream) return this.lease;
        try {
          if (this.lease) throw new Error("CAMERA_EXTERNAL_STREAM_ALREADY_ADOPTED");
          const tracks = stream.getTracks(),
            video = stream.getVideoTracks();
          if (tracks.length !== 1 || video.length !== 1 || tracks[0] !== video[0] || video[0].readyState !== "live")
            throw new Error("CAMERA_VIDEO_TRACK_REQUIRED");
          let endedDuringAdoption = false;
          const ended = () => {
            if (!owns()) return;
            this.permission = "UNKNOWN";
            if (this.lease?.generation === generation) this.release("SUSPENDED");
            else endedDuringAdoption = true;
          };
          this.detach = () => video[0].removeEventListener("ended", ended);
          video[0].addEventListener("ended", ended);
          if (!owns() || endedDuringAdoption || video[0].readyState !== "live")
            throw new Error("CAMERA_SOURCE_ENDED_DURING_ACQUISITION");
          const lease: CameraLease = {
            id: crypto.randomUUID(),
            generation,
            stream,
            release: reservation.release,
          };
          this.lease = lease;
          this.permission = "GRANTED";
          this.set("READY");
          if (!owns()) throw new Error("CAMERA_REQUEST_CANCELLED");
          return lease;
        } catch (error) {
          stopUnowned(stream);
          if (owns())
            this.release(
              error instanceof Error && error.message === "CAMERA_SOURCE_ENDED_DURING_ACQUISITION"
                ? "SUSPENDED"
                : "ERROR",
            );
          else ownership.retire();
          throw error;
        }
      },
    };
    this.external = ownership;
    reservations.set(this.media, this);
    try {
      this.set("REQUESTING");
      if (!owns()) throw new Error("CAMERA_REQUEST_CANCELLED");
    } catch (error) {
      reservation.release();
      throw error;
    }
    return reservation;
  }
  async acquire(
    consent: boolean,
    foreground: boolean,
    deviceId?: string,
    facingMode?: "user" | "environment",
  ): Promise<CameraLease> {
    if (!consent || !foreground) throw new Error("CAMERA_EXPLICIT_FOREGROUND_CONSENT_REQUIRED");
    if (this.lease || this.requesting || this.external) throw new Error("CAMERA_EXCLUSIVE_LEASE_BUSY");
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
          ...(!deviceId && facingMode ? { facingMode: { ideal: facingMode } } : {}),
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
    const external = this.external;
    this.external = null;
    this.detach();
    this.detach = () => {};
    this.lease?.stream.getTracks().forEach((t) => t.stop());
    this.lease = null;
    if (this.media && !this.requesting && reservations.get(this.media) === this) reservations.delete(this.media);
    external?.retire();
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
