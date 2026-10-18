import { handModel } from "@/watchglass/hand-provider";
import type { RawHandInference } from "./browser-runtime";

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
};
const finite = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
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
/** Ephemeral local test evidence. No fitting, identity fields, storage or network calls. */
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
  constructor(
    readonly startedAt: number,
    readonly cameraVideoStartedAt: number,
    readonly recordingId: string = crypto.randomUUID(),
  ) {
    if (!Number.isFinite(startedAt) || !Number.isFinite(cameraVideoStartedAt))
      throw new Error("POSE_RECORDING_CLOCK_INVALID");
    this.lastNow = startedAt;
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
