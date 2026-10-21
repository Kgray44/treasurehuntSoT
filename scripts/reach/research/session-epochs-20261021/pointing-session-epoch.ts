import { observationFreshnessTime } from "@/watchglass/hand-observation";
import {
  assertCurrentReachBinding,
  calibratedPoint,
  type Calibration,
  type CalibrationBinding,
} from "@/reach/calibration";
import type { Point } from "@/reach/coordinates";
import { relativeIndexFeatures } from "@/reach/coordinates";
import { IndexImageReadiness } from "@/reach/index-image-readiness";
import { indexImageAlgorithm, type IndexImageObservation } from "@/reach/index-image-tracker";
import { temporalIndexPolicy } from "@/reach/temporal-index-track";

/** Research orchestration only. No runtime, camera, action or calibration-owner callback. */
export const sessionEpochResearchVersion = 1;
export type SessionEpochState =
  | "ACQUIRING"
  | "LOCAL_READY"
  | "MAPPING_ACTIVE"
  | "UNCERTAIN"
  | "LOCAL_REANCHOR"
  | "COMPATIBILITY_CHECK"
  | "COMPATIBILITY_SUPPORTED"
  | "RECALIBRATION_REQUIRED"
  | "PAUSED"
  | "ENDED";
export type SessionMeasurementDomain = Readonly<{
  binding: CalibrationBinding;
  frameWidth: number;
  frameHeight: number;
}>;
export type SessionEpochToken = Readonly<{ session: number; epoch: number; notBeforeCapture: number }>;
export type SessionEpochSnapshot = Readonly<{
  qualification: false;
  state: SessionEpochState;
  token: SessionEpochToken;
  localTrack: Readonly<{ id: string; generation: number }> | null;
  physicalAssociation: "UNCLAIMED";
  cameraPreview: Point | null;
  sameEpochMappedPreview: Point | null;
  oldEvidence: "RETAIN_UNCHANGED";
  mayPoolOldSamples: false;
  actionPermission: false;
  reason: string;
  command: "ACQUIRE_AUTOMATIC_LOCAL_TRACK" | null;
}>;

let sessionSerial = 0;
const equalBinding = (a: CalibrationBinding, b: CalibrationBinding) =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])].every(
    (key) => a[key as keyof CalibrationBinding] === b[key as keyof CalibrationBinding],
  );

/** Coordinates and samples remain owned by the existing producer and calibration owner.
 * One automatic reacquisition attempt is allowed. It cannot grant cross-epoch calibration.
 */
export class ResearchPointingSession {
  private readonly domain: SessionMeasurementDomain;
  private readonly savedCalibration: Calibration | null;
  private readonly session = ++sessionSerial;
  private token: SessionEpochToken;
  private state: SessionEpochState = "ACQUIRING";
  private readonly readiness = new IndexImageReadiness();
  private localTrack: { id: string; generation: number } | null = null;
  private localBinding: CalibrationBinding | null = null;
  private lastCapture = -Infinity;
  private lastSequence = -Infinity;
  private lastMeasuredAt: number;
  private lastNow: number;
  private attempted = false;
  private attemptStartedAt: number | null = null;
  private acquisitionExpired = false;
  private compatibility: "UNTESTED" | "SUPPORTED" | "REJECTED" = "UNTESTED";
  private cameraPreview: Point | null = null;
  private mappedPreview: Point | null = null;

  constructor(
    domain: SessionMeasurementDomain,
    now: number,
    private readonly selection: "AUTOMATIC" | "MANUAL" = "AUTOMATIC",
    savedCalibration: Calibration | null = null,
  ) {
    assertCurrentReachBinding(domain.binding, "RELATIVE");
    if (
      !Number.isFinite(now) ||
      now < 0 ||
      ![domain.frameWidth, domain.frameHeight].every((v) => v > 1 && Number.isFinite(v))
    )
      throw new Error("SESSION_DOMAIN_OR_CLOCK_INVALID");
    this.domain = structuredClone(domain);
    this.savedCalibration = savedCalibration ? structuredClone(savedCalibration) : null;
    this.token = Object.freeze({ session: this.session, epoch: 1, notBeforeCapture: now });
    this.lastNow = this.lastMeasuredAt = now;
  }

  snapshot(reason = "STATE", command: SessionEpochSnapshot["command"] = null): SessionEpochSnapshot {
    return Object.freeze({
      qualification: false,
      state: this.state,
      token: this.token,
      localTrack: this.localTrack ? Object.freeze({ ...this.localTrack }) : null,
      physicalAssociation: "UNCLAIMED",
      cameraPreview: this.cameraPreview ? Object.freeze({ ...this.cameraPreview }) : null,
      sameEpochMappedPreview: this.mappedPreview ? Object.freeze({ ...this.mappedPreview }) : null,
      oldEvidence: "RETAIN_UNCHANGED",
      mayPoolOldSamples: false,
      actionPermission: false,
      reason,
      command,
    });
  }

  private clearDisplay() {
    this.cameraPreview = this.mappedPreview = null;
  }

  private current(token: SessionEpochToken, now: number) {
    return (
      token === this.token &&
      this.state !== "ENDED" &&
      this.state !== "PAUSED" &&
      !this.acquisitionExpired &&
      Number.isFinite(now) &&
      now >= this.lastNow
    );
  }

  private bindingFor(o: IndexImageObservation): CalibrationBinding {
    return { ...this.domain.binding, trackId: o.trackId!, trackGeneration: o.trackGeneration };
  }

  private matchesDomain(o: IndexImageObservation) {
    const b = this.domain.binding;
    return (
      o.providerId === b.providerId &&
      o.providerVersion === b.providerVersion &&
      o.algorithmDigest === b.modelDigest &&
      o.providerGeneration === b.providerGeneration &&
      o.cameraLeaseId === b.cameraLeaseId &&
      o.cameraFrameVersion === b.cameraFrameVersion &&
      o.frameWidth === this.domain.frameWidth &&
      o.frameHeight === this.domain.frameHeight &&
      (o.mirrorTransform === "PREVIEW_X") === b.mirror &&
      o.orientation === b.orientation
    );
  }

  observe(token: SessionEpochToken, o: IndexImageObservation, now: number): SessionEpochSnapshot {
    if (!this.current(token, now)) return this.snapshot("REJECTED_SESSION_OR_TOKEN");
    if (this.attemptStartedAt !== null && now - this.attemptStartedAt > temporalIndexPolicy.identityRecoveryMs)
      return this.tick(now);
    const origin = observationFreshnessTime(o);
    if (
      o.observationVersion !== 1 ||
      !Number.isFinite(o.sequence) ||
      o.sequence <= this.lastSequence ||
      o.monotonicCaptureTime <= Math.max(this.lastCapture, token.notBeforeCapture) ||
      !Number.isFinite(o.monotonicInferenceTime) ||
      o.monotonicInferenceTime < o.monotonicCaptureTime ||
      o.monotonicInferenceTime > now ||
      now - origin < 0 ||
      now - origin > 150
    ) {
      const rejected = this.snapshot("REJECTED_STALE_OR_REORDERED_INPUT");
      return now - this.lastMeasuredAt > 150
        ? Object.freeze({ ...rejected, cameraPreview: null, sameEpochMappedPreview: null })
        : rejected;
    }
    if (!this.matchesDomain(o) || o.algorithmDigest !== indexImageAlgorithm.algorithmDigest) {
      this.state = "PAUSED";
      this.clearDisplay();
      return this.snapshot("SOURCE_OR_GEOMETRY_CHANGED");
    }
    if (this.selection === "AUTOMATIC" && o.anchorSource === "MANUAL_HINT") {
      this.state = "PAUSED";
      this.clearDisplay();
      return this.snapshot("SELECTION_MODE_CHANGED");
    }
    this.lastNow = now;
    this.lastCapture = o.monotonicCaptureTime;
    this.lastSequence = o.sequence;
    const ready = this.readiness.update(o);
    const point = o.point;
    const accepted = o.measurements?.accepted;
    const validLocal =
      ready.eligible &&
      point !== null &&
      accepted !== null &&
      accepted !== undefined &&
      point.x === accepted.x &&
      point.y === accepted.y &&
      [point.x, point.y].every((v) => Number.isFinite(v) && v >= 0 && v <= 1) &&
      o.temporalTrack?.identity === "ESTABLISHED" &&
      o.temporalTrack.state === "TRACKING" &&
      o.temporalTrack.intent === "POINT" &&
      (this.selection === "MANUAL" || o.anchorSource !== "MANUAL_HINT");
    if (!validLocal) {
      this.clearDisplay();
      this.state = "UNCERTAIN";
      return this.tick(now);
    }
    const binding = this.bindingFor(o);
    const replacement = this.localBinding !== null && !equalBinding(this.localBinding, binding);
    if (replacement) {
      this.token = Object.freeze({
        session: this.session,
        epoch: this.token.epoch + 1,
        notBeforeCapture: o.monotonicCaptureTime,
      });
      this.attempted = true;
      this.compatibility = "UNTESTED";
    }
    this.localBinding = binding;
    this.localTrack = { id: o.trackId!, generation: o.trackGeneration };
    this.lastMeasuredAt = o.monotonicCaptureTime;
    this.attemptStartedAt = null;
    this.cameraPreview = { ...point! };
    this.mappedPreview =
      this.savedCalibration && !replacement && this.token.epoch === 1
        ? calibratedPoint(this.savedCalibration, relativeIndexFeatures(point!), binding, now)
        : null;
    this.state = this.mappedPreview
      ? "MAPPING_ACTIVE"
      : !this.savedCalibration
        ? "LOCAL_READY"
        : this.compatibility === "SUPPORTED"
          ? "COMPATIBILITY_SUPPORTED"
          : this.compatibility === "REJECTED"
            ? "RECALIBRATION_REQUIRED"
            : "COMPATIBILITY_CHECK";
    return this.snapshot(replacement ? "NEW_LOCAL_EPOCH_NO_INHERITANCE" : "LOCAL_MEASUREMENT_READY");
  }

  tick(now: number): SessionEpochSnapshot {
    if (!Number.isFinite(now) || now < this.lastNow || this.state === "PAUSED" || this.state === "ENDED")
      return this.snapshot("REJECTED_SESSION_CLOCK");
    this.lastNow = now;
    if (now - this.lastMeasuredAt > 150) this.clearDisplay();
    if (this.acquisitionExpired) return this.snapshot("AUTOMATIC_ATTEMPT_EXHAUSTED");
    if (this.attemptStartedAt !== null) {
      if (now - this.attemptStartedAt > temporalIndexPolicy.identityRecoveryMs) {
        this.acquisitionExpired = true;
        this.state = "RECALIBRATION_REQUIRED";
        return this.snapshot("AUTOMATIC_ATTEMPT_EXHAUSTED");
      }
      this.state = "LOCAL_REANCHOR";
      return this.snapshot("LOCAL_ACQUISITION_PENDING");
    }
    if (now - this.lastMeasuredAt > temporalIndexPolicy.identityRecoveryMs) {
      if (this.attempted) {
        this.state = "RECALIBRATION_REQUIRED";
        return this.snapshot("AUTOMATIC_ATTEMPT_EXHAUSTED");
      }
      if (this.selection === "MANUAL") {
        this.state = "UNCERTAIN";
        return this.snapshot("MANUAL_SELECTION_PRESERVED");
      }
      this.attempted = true;
      this.attemptStartedAt = now;
      this.compatibility = "UNTESTED";
      this.token = Object.freeze({ session: this.session, epoch: this.token.epoch + 1, notBeforeCapture: now });
      this.localTrack = this.localBinding = null;
      this.readiness.reset();
      this.state = "LOCAL_REANCHOR";
      return this.snapshot("NEW_ACQUISITION_BOUNDARY", "ACQUIRE_AUTOMATIC_LOCAL_TRACK");
    }
    if (this.cameraPreview === null && this.state !== "ACQUIRING") this.state = "UNCERTAIN";
    return this.snapshot("WAITING_FOR_CURRENT_MEASUREMENT");
  }

  /** A numerical research result is not a calibration-owner adoption operation. */
  compatibilityResult(token: SessionEpochToken, supported: boolean): SessionEpochSnapshot {
    if (token !== this.token || this.state !== "COMPATIBILITY_CHECK")
      return this.snapshot("REJECTED_COMPATIBILITY_CONTEXT");
    this.mappedPreview = null;
    this.compatibility = supported ? "SUPPORTED" : "REJECTED";
    this.state = supported ? "COMPATIBILITY_SUPPORTED" : "RECALIBRATION_REQUIRED";
    return this.snapshot(supported ? "RESEARCH_PROPOSAL_ONLY" : "FRESH_CALIBRATION_REQUIRED");
  }

  pause(): SessionEpochSnapshot {
    this.state = this.state === "ENDED" ? "ENDED" : "PAUSED";
    this.clearDisplay();
    return this.snapshot("SESSION_PAUSED");
  }

  end(): SessionEpochSnapshot {
    this.state = "ENDED";
    this.clearDisplay();
    return this.snapshot("SESSION_ENDED");
  }
}
