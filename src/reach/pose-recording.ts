import { handModel } from "@/watchglass/hand-provider";
import { observationFreshnessTime, type HandObservation } from "@/watchglass/hand-observation";
import type { RawHandInference, ReachFrameDiagnostics } from "./browser-runtime";
import type { IndexImageObservation } from "./index-image-tracker";
import type { IndexImageReadinessResult } from "./index-image-readiness";

export const poseRecordingLimits = {
  durationMs: 90_000,
  frames: 3000,
  traceBytes: 16 * 1024 * 1024,
  videoBytes: 64 * 1024 * 1024,
} as const;
export const poseRecordingSteps = [
  {
    id: "CENTER",
    seconds: 6,
    intent: "POINT",
    target: { x: 0.5, y: 0.5 },
    prompt: "Point comfortably in the center. Keep your other fingers relaxed.",
  },
  {
    id: "BOTTOM",
    seconds: 8,
    intent: "POINT",
    target: { x: 0.5, y: 0.9 },
    prompt: "Point toward the bottom. Try an end-on index and let your wrist approach the camera edge.",
  },
  {
    id: "TOP",
    seconds: 6,
    intent: "POINT",
    target: { x: 0.5, y: 0.1 },
    prompt: "Point toward the top without forcing your index perfectly straight.",
  },
  {
    id: "LEFT",
    seconds: 5,
    intent: "POINT",
    target: { x: 0.1, y: 0.5 },
    prompt: "Move your point comfortably toward the left.",
  },
  {
    id: "RIGHT",
    seconds: 5,
    intent: "POINT",
    target: { x: 0.9, y: 0.5 },
    prompt: "Move your point comfortably toward the right.",
  },
  {
    id: "TOP_LEFT",
    seconds: 4,
    intent: "POINT",
    target: { x: 0.1, y: 0.1 },
    prompt: "Point toward the top-left corner, without straining.",
  },
  {
    id: "TOP_RIGHT",
    seconds: 4,
    intent: "POINT",
    target: { x: 0.9, y: 0.1 },
    prompt: "Point toward the top-right corner, without straining.",
  },
  {
    id: "BOTTOM_LEFT",
    seconds: 4,
    intent: "POINT",
    target: { x: 0.1, y: 0.9 },
    prompt: "Point toward the bottom-left corner. A clipped wrist is useful evidence.",
  },
  {
    id: "BOTTOM_RIGHT",
    seconds: 4,
    intent: "POINT",
    target: { x: 0.9, y: 0.9 },
    prompt: "Point toward the bottom-right corner. Keep your other fingers relaxed.",
  },
  {
    id: "RELAXED",
    seconds: 6,
    intent: "POINT",
    prompt: "Gently bend the index and relax the other fingers. Avoid making a fist.",
  },
  {
    id: "SWEEP",
    seconds: 10,
    intent: "POINT",
    prompt: "Sweep continuously from bottom to top and back. Turn naturally through different depth angles.",
  },
  {
    id: "OPEN_PALM",
    seconds: 5,
    intent: "OPEN_PALM",
    prompt: "Show an open palm. This is a negative example, not a pointing pose.",
  },
  {
    id: "HIDE",
    seconds: 1,
    intent: "NO_HAND",
    prompt: "Briefly hide now; bring the same hand back when Recover appears.",
  },
  {
    id: "RECOVER",
    seconds: 6,
    intent: "RECOVERY",
    prompt: "Bring the same hand back and point comfortably. Let tracking recover naturally.",
  },
] as const;
export const poseRecordingDurationMs = poseRecordingSteps.reduce((sum, step) => sum + step.seconds * 1000, 0);
type Step = (typeof poseRecordingSteps)[number];
type RawPoint = { x: number | null; y: number | null; z: number | null };
type CanonicalProvider = { id: string; version: string; digest: string };
type CanonicalMeasurements = {
  model: { x: number; y: number } | null;
  image: { x: number; y: number } | null;
  accepted: { x: number; y: number } | null;
  imageDisposition: "TIP" | "SHAFT" | "DISPUTED" | "UNAVAILABLE";
  modelDisposition: "QUALIFIED" | "CANDIDATE" | "UNAVAILABLE";
};
type CanonicalTemporalTrack = {
  state: "ACQUIRING" | "TRACKING" | "UNCERTAIN" | "COASTING" | "REACQUIRING" | "AMBIGUOUS" | "EXPIRED";
  identity: "ESTABLISHED" | "CANDIDATE" | "AMBIGUOUS" | "EXPIRED";
  intent: "POINT" | "CONTRARY" | "UNCERTAIN";
  measurementAgeMs: number | null;
  positionUncertaintyPixels: number | null;
  sourceGenerationCount: number;
  hypothesisCount: number;
};
export type PoseCanonicalReadiness = { result: IndexImageReadinessResult; evaluatedAt: number };
export type PoseCanonicalIndexTrack =
  | { schemaVersion: 1; disposition: "PENDING" }
  | {
      schemaVersion: 1;
      disposition: "COMPLETE";
      completedMs: number | null;
      model: {
        accepted: boolean;
        reason: string;
        sourceRef: string | null;
        provider: CanonicalProvider | null;
        hands: {
          handRef: string | null;
          continuity: string;
          associationBasis: string | null;
          reportedIndexTip: { x: number; y: number } | null;
        }[];
      };
      index: {
        accepted: boolean;
        reason: string;
        sourceRef: string | null;
        indexRef: string | null;
        provider: CanonicalProvider | null;
        sequence: number | null;
        pixelOriginMs: number | null;
        state: IndexImageObservation["state"] | null;
        coordinateSource: IndexImageObservation["coordinateSource"] | null;
        modelSupport: IndexImageObservation["modelSupport"] | null;
        modelAgreement: IndexImageObservation["modelAgreement"] | null;
        anchorSource: IndexImageObservation["anchorSource"] | null;
        opticalEpoch: number | null;
        point: { x: number; y: number } | null;
        matchedPoint: { x: number; y: number } | null;
        quality: IndexImageObservation["quality"] | null;
        uncertaintyRadiusPixels: number | null;
        freshAtCompletion: boolean | null;
        measurements?: CanonicalMeasurements;
        temporalTrack?: CanonicalTemporalTrack;
      };
      readiness: {
        condition: IndexImageReadinessResult["condition"] | "NOT_EVALUATED";
        trackingEligible: boolean;
        changed: boolean | null;
        evaluatedMs: number | null;
      };
      calibration: { evaluated: false; samplesCollected: 0; reason: "NO_CALIBRATION_TARGET_OR_FIT_CONTEXT" };
      actions: { evaluated: false; committed: 0 };
    };
export type PoseTraceFrame = {
  sequence: number;
  step: Step["id"];
  promptedIntent: Step["intent"];
  target: { x: number; y: number } | null;
  activeElapsedMs: number;
  recordingElapsedMs: number | null;
  receivedMs: number;
  captureMs: number | null;
  inferenceMs: number | null;
  cameraVideoTimeMs: number | null;
  relativeCameraVideoTimeMs: number | null;
  width: number | null;
  height: number | null;
  mirror: boolean;
  inferenceBackend: RawHandInference["inferenceBackend"] | null;
  inferencePolicy: RawHandInference["inferencePolicy"] | null;
  timingFlags: string[];
  hands: { landmarks: RawPoint[]; handedness: "LEFT" | "RIGHT" | "UNKNOWN"; handednessScore: number | null }[];
  rawHandCount: number;
  truncated: boolean;
  malformed: boolean;
  canonicalIndexTrack?: PoseCanonicalIndexTrack;
};
const finite = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
const reason = (value: string) => (/^[A-Z][A-Z0-9_]{0,159}$/.test(value) ? value : "DIAGNOSTIC_REASON_UNAVAILABLE");
const boundedPoint = (value: { x: number; y: number } | null | undefined) =>
  value && [value.x, value.y].every(Number.isFinite) && value.x >= 0 && value.x <= 1 && value.y >= 0 && value.y <= 1
    ? { x: value.x, y: value.y }
    : null;
type Source = HandObservation | IndexImageObservation;
const sourceKey = (o: Source) =>
  JSON.stringify([
    o.providerId,
    o.providerVersion,
    "algorithmDigest" in o ? o.algorithmDigest : o.modelDigest,
    o.providerGeneration,
    o.cameraLeaseId,
    o.cameraFrameVersion,
    o.frameWidth,
    o.frameHeight,
    o.mirrorTransform,
    o.orientation,
    "inferenceBackend" in o ? o.inferenceBackend : null,
  ]);
const sameCaptureContext = (model: HandObservation, index: IndexImageObservation) =>
  model.providerGeneration === index.providerGeneration &&
  model.cameraLeaseId === index.cameraLeaseId &&
  model.cameraFrameVersion === index.cameraFrameVersion &&
  model.frameWidth === index.frameWidth &&
  model.frameHeight === index.frameHeight &&
  model.mirrorTransform === index.mirrorTransform &&
  model.orientation === index.orientation;
function snapshotResult(input: unknown) {
  const result = object(input),
    raw = Array.isArray(result.landmarks) ? result.landmarks : [];
  const handedness = Array.isArray(result.handedness) ? result.handedness : [];
  let malformed = !Array.isArray(result.landmarks),
    truncated = raw.length > 2;
  const hands = raw.slice(0, 2).map((points, index) => {
    const list = Array.isArray(points) ? points : [];
    if (!Array.isArray(points) || list.length !== 21) malformed = true;
    truncated ||= list.length > 21;
    const scoreList = Array.isArray(handedness[index]) ? handedness[index] : [];
    const category = object(scoreList[0]);
    const categoryName = category.categoryName;
    const side =
      categoryName === "Left"
        ? ("LEFT" as const)
        : categoryName === "Right"
          ? ("RIGHT" as const)
          : ("UNKNOWN" as const);
    return {
      landmarks: Array.from({ length: 21 }, (_, joint) => {
        const point = object(list[joint]);
        const snapshot = { x: finite(point.x), y: finite(point.y), z: finite(point.z) };
        if (Object.values(snapshot).some((value) => value === null)) malformed = true;
        return snapshot;
      }),
      handedness: side,
      handednessScore: finite(category.score),
    };
  });
  return { hands, rawHandCount: raw.length, malformed, truncated };
}
/** Ephemeral local test evidence. Ordinal references never export raw lease/track identities. */
export class PoseRecordingSession {
  private frames: PoseTraceFrame[] = [];
  private bytes = 0;
  private pausedAt: number | null = null;
  private pauseMs = 0;
  private previousCapture: number | null = null;
  private lastNow: number;
  private endedAt: number | null = null;
  private endReason: string | null = null;
  private events: { atMs: number; event: "PAUSE" | "RESUME" }[] = [];
  private sourceRefs = new Map<string, string>();
  private handRefs = new Map<string, string>();
  private indexRefs = new Map<string, string>();
  private canonicalAttachments = { completed: 0, unmatched: 0, duplicate: 0, contextRejected: 0 };
  private readonly canonicalTracking: boolean;
  constructor(
    readonly startedAt: number,
    readonly cameraVideoStartedAt: number,
    readonly recordingId: string = crypto.randomUUID(),
    options: { canonicalTracking?: boolean } = {},
  ) {
    if (!Number.isFinite(startedAt) || !Number.isFinite(cameraVideoStartedAt))
      throw new Error("POSE_RECORDING_CLOCK_INVALID");
    this.lastNow = startedAt;
    this.canonicalTracking = options.canonicalTracking === true;
  }
  private clock(now: number) {
    if (!Number.isFinite(now) || now < this.lastNow) throw new Error("POSE_RECORDING_CLOCK_INVALID");
    this.lastNow = now;
  }
  activeElapsed(now: number) {
    return Math.max(0, (this.endedAt ?? this.pausedAt ?? now) - this.startedAt - this.pauseMs);
  }
  currentStep(now: number): Step {
    return this.stepAtElapsed(this.activeElapsed(now));
  }
  private stepAtElapsed(elapsed: number): Step {
    for (const step of poseRecordingSteps) {
      if (elapsed < step.seconds * 1000) return step;
      elapsed -= step.seconds * 1000;
    }
    return poseRecordingSteps[poseRecordingSteps.length - 1];
  }
  private recordingClock(capture: number) {
    const relative = capture - this.startedAt;
    let paused = 0,
      pauseStart: number | null = null;
    for (const event of this.events) {
      if (event.atMs > relative) break;
      if (event.event === "PAUSE") pauseStart = event.atMs;
      else if (pauseStart !== null) {
        paused += event.atMs - pauseStart;
        pauseStart = null;
      }
    }
    if (pauseStart !== null) paused += relative - pauseStart;
    return { elapsed: relative - paused, capturedDuringPause: pauseStart !== null };
  }
  get stopped() {
    return this.endedAt !== null;
  }
  get paused() {
    return this.pausedAt !== null;
  }
  get frameCount() {
    return this.frames.length;
  }
  tick(now: number) {
    this.clock(now);
    if (!this.stopped && now - this.startedAt >= poseRecordingLimits.durationMs) this.stop(now, "WALL_TIME_LIMIT");
    else if (!this.stopped && this.activeElapsed(now) >= poseRecordingDurationMs) this.stop(now, "GUIDE_COMPLETE");
    return {
      step: this.currentStep(now),
      elapsedMs: this.activeElapsed(now),
      frames: this.frames.length,
      stopped: this.stopped,
      paused: this.paused,
    };
  }
  pause(now: number) {
    this.tick(now);
    if (this.stopped || this.paused) return;
    this.pausedAt = now;
    this.events.push({ atMs: now - this.startedAt, event: "PAUSE" });
  }
  resume(now: number) {
    this.tick(now);
    if (this.stopped || this.pausedAt === null) return;
    this.pauseMs += now - this.pausedAt;
    this.pausedAt = null;
    this.events.push({ atMs: now - this.startedAt, event: "RESUME" });
  }
  stop(now: number, reason = "USER_STOPPED") {
    this.clock(now);
    if (this.stopped) return;
    if (this.pausedAt !== null) {
      this.pauseMs += now - this.pausedAt;
      this.pausedAt = null;
    }
    this.endedAt = now;
    this.endReason = reason;
  }
  append(input: RawHandInference, now: number) {
    this.tick(now);
    if (this.stopped || this.paused) return false;
    if (this.frames.length >= poseRecordingLimits.frames) {
      this.stop(now, "FRAME_LIMIT");
      return false;
    }
    const capture = finite(input.capture),
      inference = finite(input.inference),
      received = finite(input.received);
    const videoTime = finite(input.videoTime);
    const captureClock = capture === null ? null : this.recordingClock(capture);
    const step = captureClock ? this.stepAtElapsed(captureClock.elapsed) : this.currentStep(now),
      flags: string[] = [];
    if (capture === null || inference === null || received === null) flags.push("CLOCK_MISSING_OR_INVALID");
    if (capture !== null && capture < this.startedAt) flags.push("CAPTURE_BEFORE_RECORDING_START");
    if (capture !== null && received !== null && received - capture > 150) flags.push("STALE_OVER_150MS");
    if (capture !== null && this.previousCapture !== null && capture <= this.previousCapture)
      flags.push("CAPTURE_REORDERED_OR_REPEATED");
    if (capture !== null && inference !== null && inference < capture) flags.push("INFERENCE_BEFORE_CAPTURE");
    if (capture !== null && received !== null && capture > received + 5) flags.push("CAPTURE_IN_FUTURE");
    if (captureClock?.capturedDuringPause) flags.push("CAPTURE_DURING_PAUSE");
    if (step.id !== this.currentStep(now).id) flags.push("CAPTURE_FROM_PREVIOUS_PROMPT");
    const frame: PoseTraceFrame = {
      sequence: this.frames.length,
      step: step.id,
      promptedIntent: step.intent,
      target: "target" in step ? { ...step.target } : null,
      activeElapsedMs: this.activeElapsed(now),
      recordingElapsedMs: captureClock?.elapsed ?? null,
      receivedMs: (received ?? now) - this.startedAt,
      captureMs: capture === null ? null : capture - this.startedAt,
      inferenceMs: inference === null ? null : inference - this.startedAt,
      cameraVideoTimeMs: videoTime === null ? null : videoTime * 1000,
      relativeCameraVideoTimeMs: videoTime === null ? null : (videoTime - this.cameraVideoStartedAt) * 1000,
      width: finite(input.width),
      height: finite(input.height),
      mirror: input.mirror === true,
      inferenceBackend: input.inferenceBackend ?? null,
      inferencePolicy: input.inferencePolicy ?? null,
      timingFlags: flags,
      ...snapshotResult(input.result),
      ...(this.canonicalTracking
        ? { canonicalIndexTrack: { schemaVersion: 1 as const, disposition: "PENDING" as const } }
        : {}),
    };
    const bytes = JSON.stringify(frame).length;
    if (this.bytes + bytes > poseRecordingLimits.traceBytes) {
      this.stop(now, "TRACE_MEMORY_LIMIT");
      return false;
    }
    this.frames.push(frame);
    this.bytes += bytes;
    if (capture !== null) this.previousCapture = capture;
    return true;
  }
  /** Attach final same-frame canonical output without rerunning tracking or dropping a raw result. */
  attachCanonical(input: ReachFrameDiagnostics, readiness: PoseCanonicalReadiness | null, now: number) {
    if (!this.canonicalTracking) return false;
    const row = this.frames[this.frames.length - 1];
    if (!Number.isFinite(input.capture) || !row || row.captureMs !== input.capture - this.startedAt) {
      this.canonicalAttachments.unmatched++;
      return false;
    }
    if (row.canonicalIndexTrack?.disposition !== "PENDING") {
      this.canonicalAttachments.duplicate++;
      return false;
    }
    this.clock(now);
    const matchesRaw = (o: Source) =>
      o.monotonicCaptureTime === input.capture &&
      o.frameWidth === row.width &&
      o.frameHeight === row.height &&
      (o.mirrorTransform === "PREVIEW_X") === row.mirror;
    const modelMatches = input.modelObservation !== null && matchesRaw(input.modelObservation);
    const indexMatches = input.indexObservation !== null && matchesRaw(input.indexObservation);
    const model = modelMatches ? input.modelObservation : null;
    const contextMatches =
      !input.indexObservation || (model !== null && sameCaptureContext(model, input.indexObservation));
    const index = indexMatches && contextMatches ? input.indexObservation : null;
    const extra = index as
      | (IndexImageObservation & { measurements?: CanonicalMeasurements; temporalTrack?: CanonicalTemporalTrack })
      | null;
    if ((!modelMatches && input.modelObservation) || (!indexMatches && input.indexObservation) || !contextMatches)
      this.canonicalAttachments.contextRejected++;
    const ordinal = (map: Map<string, string>, key: string, prefix: string) => {
      let ref = map.get(key);
      if (!ref && map.size < poseRecordingLimits.frames * 2) {
        ref = `${prefix}-${map.size + 1}`;
        map.set(key, ref);
      }
      return ref ?? null;
    };
    const source = (o: Source) => ordinal(this.sourceRefs, sourceKey(o), "source");
    const provider = (o: Source): CanonicalProvider => ({
      id: o.providerId,
      version: o.providerVersion,
      digest: "algorithmDigest" in o ? o.algorithmDigest : o.modelDigest,
    });
    const fresh = (o: Source, at: number) =>
      at - observationFreshnessTime(o) >= 0 && at - observationFreshnessTime(o) <= 150;
    const matchingReadiness = index !== null && readiness?.result.observation === index;
    const mismatchReason = (o: Source) =>
      o.monotonicCaptureTime === input.capture ? "CANONICAL_CONTEXT_MISMATCH" : "CANONICAL_CAPTURE_MISMATCH";
    const snapshot: PoseCanonicalIndexTrack = {
      schemaVersion: 1,
      disposition: "COMPLETE",
      completedMs: finite(input.completed) === null ? null : input.completed - this.startedAt,
      model: {
        accepted: model !== null,
        reason:
          input.modelObservation && !modelMatches ? mismatchReason(input.modelObservation) : reason(input.modelReason),
        sourceRef: model ? source(model) : null,
        provider: model ? provider(model) : null,
        hands:
          model?.hands.slice(0, 2).map((hand) => ({
            handRef: ordinal(this.handRefs, `${sourceKey(model)}:${hand.trackId}:${hand.trackGeneration}`, "hand"),
            continuity: hand.continuity ?? "UNKNOWN",
            associationBasis: hand.associationBasis ?? null,
            reportedIndexTip: hand.landmarks[8]?.valid ? boundedPoint(hand.landmarks[8]) : null,
          })) ?? [],
      },
      index: {
        accepted: index !== null,
        reason:
          input.indexObservation && !indexMatches
            ? mismatchReason(input.indexObservation)
            : !contextMatches
              ? "CANONICAL_CONTEXT_MISMATCH"
              : reason(input.indexReason),
        sourceRef: index ? source(index) : null,
        indexRef:
          index?.trackId && index.trackGeneration > 0
            ? ordinal(this.indexRefs, `${sourceKey(index)}:${index.trackId}:${index.trackGeneration}`, "index")
            : null,
        provider: index ? provider(index) : null,
        sequence: index?.sequence ?? null,
        pixelOriginMs:
          index?.monotonicPixelOriginTime === undefined ? null : index.monotonicPixelOriginTime - this.startedAt,
        state: index?.state ?? null,
        coordinateSource: index?.coordinateSource ?? null,
        modelSupport: index?.modelSupport ?? null,
        modelAgreement: index?.modelAgreement ?? null,
        anchorSource: index?.anchorSource ?? null,
        opticalEpoch: index?.opticalEpoch ?? null,
        point: boundedPoint(index?.point),
        matchedPoint: boundedPoint(index?.matchedPoint),
        quality: index
          ? {
              correlation: finite(index.quality.correlation),
              separation: finite(index.quality.separation),
              texture: finite(index.quality.texture),
              forwardBackwardErrorPixels: finite(index.quality.forwardBackwardErrorPixels),
            }
          : null,
        uncertaintyRadiusPixels: index?.uncertaintyRadiusPixels ?? null,
        freshAtCompletion: index ? fresh(index, input.completed) : null,
        ...(extra?.measurements
          ? {
              measurements: {
                model: boundedPoint(extra.measurements.model),
                image: boundedPoint(extra.measurements.image),
                accepted: boundedPoint(extra.measurements.accepted),
                imageDisposition: extra.measurements.imageDisposition,
                modelDisposition: extra.measurements.modelDisposition,
              },
            }
          : {}),
        ...(extra?.temporalTrack
          ? {
              temporalTrack: {
                state: extra.temporalTrack.state,
                identity: extra.temporalTrack.identity,
                intent: extra.temporalTrack.intent,
                measurementAgeMs: finite(extra.temporalTrack.measurementAgeMs),
                positionUncertaintyPixels: finite(extra.temporalTrack.positionUncertaintyPixels),
                sourceGenerationCount: extra.temporalTrack.sourceGenerationCount,
                hypothesisCount: extra.temporalTrack.hypothesisCount,
              },
            }
          : {}),
      },
      readiness: {
        condition: matchingReadiness ? readiness.result.condition : "NOT_EVALUATED",
        trackingEligible: matchingReadiness && readiness.result.eligible && fresh(index!, readiness.evaluatedAt),
        changed: matchingReadiness ? readiness.result.changed : null,
        evaluatedMs: matchingReadiness ? readiness.evaluatedAt - this.startedAt : null,
      },
      calibration: { evaluated: false, samplesCollected: 0, reason: "NO_CALIBRATION_TARGET_OR_FIT_CONTEXT" },
      actions: { evaluated: false, committed: 0 },
    };
    const next = { ...row, canonicalIndexTrack: snapshot };
    const nextBytes = this.bytes - JSON.stringify(row).length + JSON.stringify(next).length;
    if (nextBytes > poseRecordingLimits.traceBytes) {
      this.stop(now, "TRACE_MEMORY_LIMIT");
      return false;
    }
    row.canonicalIndexTrack = snapshot;
    this.bytes = nextBytes;
    this.canonicalAttachments.completed++;
    return true;
  }
  export() {
    return {
      format: "VOYAGEWRIGHT_LOCAL_POSE_RECORDING",
      version: 1,
      recordingId: this.recordingId,
      purpose: "LOCAL_TEST_FIXTURE_ONLY",
      physicalAccuracyQualified: false,
      intentLabels: "PROMPTS_ONLY_NOT_VERIFIED_GROUND_TRUTH",
      coordinates: "RAW_UNMIRRORED_CAMERA_NORMALIZED_XY_AND_MONOCULAR_RELATIVE_Z",
      missingCoordinates: "NULL_NOT_FABRICATED_ZERO",
      model: {
        ...handModel,
        providerVersionMeaning: "BASE_ADAPTER_VERSION;_EXACT_LIVE_VERSION_DEPENDS_ON_PER_FRAME_INFERENCE_POLICY",
        inferenceBackendsUsed: [...new Set(this.frames.map((frame) => frame.inferenceBackend).filter(Boolean))],
        inferencePoliciesUsed: [...new Set(this.frames.map((frame) => frame.inferencePolicy).filter(Boolean))],
      },
      video: {
        kind: "CAMERA_PLUS_EXISTING_RENDERED_TRACE_AND_PROMPT",
        requestedFps: 20,
        audio: false,
        cameraVideoStartedAtMs: this.cameraVideoStartedAt * 1000,
        synchronization: "CAPTURE_TIME_MINUS_PAUSES_AND_ORIGINAL_CAMERA_VIDEO_TIME",
        alignmentUncertainty:
          "Up to one capture/inference/render interval. Verify the visible step and elapsed label; not sensor exposure or latency qualification.",
      },
      limits: poseRecordingLimits,
      ...(this.canonicalTracking
        ? {
            canonicalTracking: {
              schemaVersion: 1,
              pipeline: "SAME_REACH_BROWSER_RUNTIME_AND_INDEX_IMAGE_READINESS_AS_LABORATORY",
              references: "PER_RECORDING_ORDINALS_NOT_RAW_LEASE_HAND_OR_TRACK_IDENTIFIERS",
              calibration: "TRACKING_READINESS_ONLY_NO_TARGET_SETTLE_SAMPLE_WINDOW_FIT_OR_ACTIONS",
              cadence:
                "ACTIVE_RECORDING_CALIBRATION_CEILING_PREVIEW_AND_PAUSE_NORMAL_CEILING_ADAPTIVE_PRESSURE_APPLIES",
              acquisition: "RUNTIME_MAY_PRECEDE_RECORDING_NOT_A_COLD_ACQUISITION_PROOF",
              attachments: { ...this.canonicalAttachments },
              pendingFrames: this.frames.filter((frame) => frame.canonicalIndexTrack?.disposition === "PENDING").length,
            },
          }
        : {}),
      guide: poseRecordingSteps,
      durationMs: (this.endedAt ?? this.lastNow) - this.startedAt,
      activeDurationMs: this.activeElapsed(this.lastNow),
      stopReason: this.endReason,
      pauseEvents: this.events.map((event) => ({ ...event })),
      traceBytes: this.bytes,
      frames: structuredClone(this.frames),
    };
  }
}
