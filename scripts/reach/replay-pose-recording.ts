import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { BrowserHandAdapter, handModel } from "../../src/watchglass/hand-provider";
import { assessHand } from "../../src/watchglass/hand-posture";
import { ActiveHandSelector, ObservationGate } from "../../src/reach/observation";
import { poseRecordingSteps, type PoseTraceFrame } from "../../src/reach/pose-recording";

const finite = z.number().finite();
const nullable = finite.nullable();
const targetSchema = z.object({ x: finite.min(0).max(1), y: finite.min(0).max(1) });
const stepIds = poseRecordingSteps.map((step) => step.id);
const intents = ["POINT", "OPEN_PALM", "NO_HAND", "RECOVERY"] as const;
const frameSchema = z.object({
  sequence: finite.int().nonnegative(),
  step: z.enum(stepIds),
  promptedIntent: z.enum(intents),
  target: targetSchema.nullable(),
  activeElapsedMs: finite.nonnegative(),
  recordingElapsedMs: nullable,
  receivedMs: finite,
  captureMs: nullable,
  inferenceMs: nullable,
  cameraVideoTimeMs: nullable,
  relativeCameraVideoTimeMs: nullable,
  width: nullable,
  height: nullable,
  mirror: z.boolean(),
  timingFlags: z.array(z.string()).max(20),
  hands: z
    .array(
      z.object({
        landmarks: z.array(z.object({ x: nullable, y: nullable, z: nullable })).length(21),
        handedness: z.enum(["LEFT", "RIGHT", "UNKNOWN"]),
        handednessScore: nullable,
      }),
    )
    .max(2),
  rawHandCount: finite.int().nonnegative(),
  malformed: z.boolean(),
  truncated: z.boolean(),
});
const traceSchema = z.object({
  format: z.literal("VOYAGEWRIGHT_LOCAL_POSE_RECORDING"),
  version: z.literal(1),
  recordingId: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9._-]+$/),
  purpose: z.literal("LOCAL_TEST_FIXTURE_ONLY"),
  physicalAccuracyQualified: z.literal(false),
  intentLabels: z.literal("PROMPTS_ONLY_NOT_VERIFIED_GROUND_TRUTH"),
  coordinates: z.literal("RAW_UNMIRRORED_CAMERA_NORMALIZED_XY_AND_MONOCULAR_RELATIVE_Z"),
  missingCoordinates: z.literal("NULL_NOT_FABRICATED_ZERO"),
  model: z.object({
    providerId: z.string(),
    providerVersion: z.string(),
    modelId: z.string(),
    modelVersion: z.string(),
    modelDigest: z.string(),
  }),
  guide: z
    .array(
      z.object({
        id: z.enum(stepIds),
        intent: z.enum(intents),
        seconds: finite.positive().max(90),
        target: targetSchema.optional(),
      }),
    )
    .max(20),
  durationMs: finite.nonnegative(),
  activeDurationMs: finite.nonnegative(),
  pauseEvents: z.array(z.object({ atMs: finite.nonnegative(), event: z.enum(["PAUSE", "RESUME"]) })).max(1000),
  frames: z.array(frameSchema).max(3000),
});
type Trace = z.infer<typeof traceSchema>;
type Marker = {
  sequence: number;
  captureMs: number | null;
  suggestedRecordedVideoTimeMs: number;
  relativeCameraVideoTimeMs: number | null;
  reason: string;
  target: { x: number; y: number } | null;
  capturedDuringRecorderPause: boolean;
  timingFlags: string[];
};
type Outcome = {
  frame: PoseTraceFrame;
  eligible: boolean;
  recognized: boolean;
  reset: boolean;
  rejection: string | null;
  detected: number;
  providerProcessed: boolean;
};
const clockOffsetMs = 1_000_000;
const knownCaptureFlags = new Set([
  "CLOCK_MISSING_OR_INVALID",
  "CAPTURE_BEFORE_RECORDING_START",
  "STALE_OVER_150MS",
  "CAPTURE_REORDERED_OR_REPEATED",
  "INFERENCE_BEFORE_CAPTURE",
  "CAPTURE_IN_FUTURE",
  "CAPTURE_DURING_PAUSE",
  "CAPTURE_FROM_PREVIOUS_PROMPT",
]);
const bump = (counts: Record<string, number>, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1;
};
const marker = (frame: PoseTraceFrame, reason: string): Marker => ({
  sequence: frame.sequence,
  captureMs: frame.captureMs,
  suggestedRecordedVideoTimeMs: frame.recordingElapsedMs ?? frame.activeElapsedMs,
  relativeCameraVideoTimeMs: frame.relativeCameraVideoTimeMs,
  reason,
  target: frame.target,
  capturedDuringRecorderPause: frame.timingFlags.includes("CAPTURE_DURING_PAUSE"),
  timingFlags: frame.timingFlags.map((flag) => (knownCaptureFlags.has(flag) ? flag : "OTHER_CAPTURE_FLAG")),
});
const middle = (frames: PoseTraceFrame[], target?: number) => {
  const time = target ?? (frames[0].activeElapsedMs + frames.at(-1)!.activeElapsedMs) / 2;
  return frames.reduce((best, frame) =>
    Math.abs(frame.activeElapsedMs - time) < Math.abs(best.activeElapsedMs - time) ? frame : best,
  );
};
function longestMiss(outcomes: Outcome[], start: number, end: number) {
  let since: number | null = start,
    freshUntil = start,
    bestStart = start,
    bestEnd = start;
  const finish = (at: number) => {
    if (since !== null && at - since > bestEnd - bestStart) {
      bestStart = since;
      bestEnd = at;
    }
    since = null;
  };
  for (const outcome of outcomes) {
    const at = Math.min(end, Math.max(start, outcome.frame.activeElapsedMs));
    if (since === null && at > freshUntil) since = freshUntil;
    if (!outcome.eligible) since ??= at;
    else {
      finish(at);
      const age = outcome.frame.receivedMs - outcome.frame.captureMs!;
      freshUntil = Math.min(end, at + Math.max(0, 150 - age));
    }
  }
  if (since === null && end > freshUntil) since = freshUntil;
  finish(end);
  return { durationMs: bestEnd - bestStart, fromActiveMs: bestStart, toActiveMs: bestEnd };
}
function validateTrace(input: unknown): Trace {
  const parsed = traceSchema.safeParse(input);
  if (!parsed.success) throw new Error("POSE_REPLAY_UNSUPPORTED_OR_INVALID_SCHEMA");
  const trace = parsed.data;
  if (
    trace.model.modelDigest !== handModel.modelDigest ||
    trace.model.modelId !== handModel.modelId ||
    trace.model.modelVersion !== handModel.modelVersion ||
    trace.model.providerId !== handModel.providerId
  )
    throw new Error("POSE_REPLAY_MODEL_IDENTITY_MISMATCH");
  if (
    trace.guide.length !== poseRecordingSteps.length ||
    trace.guide.some((step, i) => step.id !== poseRecordingSteps[i].id || step.intent !== poseRecordingSteps[i].intent)
  )
    throw new Error("POSE_REPLAY_GUIDE_SCHEMA_MISMATCH");
  if (trace.frames.some((frame) => frame.promptedIntent !== trace.guide.find((step) => step.id === frame.step)!.intent))
    throw new Error("POSE_REPLAY_PROMPT_SCHEMA_MISMATCH");
  return trace;
}

/** Read-only analysis. Prompt instructions never establish what the hand actually did. */
export function replayPoseRecording(input: unknown) {
  const trace = validateTrace(input),
    selector = new ActiveHandSelector();
  let adapter: BrowserHandAdapter | null = null,
    gate: ObservationGate | null = null;
  let context: string | null = null,
    previousSequence = -1,
    previousReceived = -Infinity;
  const outcomes: Outcome[] = [],
    rejectionCounts: Record<string, number> = {},
    capturedFlagCounts: Record<string, number> = {};
  const pauseIssues: string[] = [],
    pauses: { from: number; to: number }[] = [];
  let pausedAt: number | null = null,
    lastPauseEvent = -Infinity;
  for (const event of trace.pauseEvents) {
    if (event.atMs < lastPauseEvent) {
      pauseIssues.push("PAUSE_EVENT_REORDERED");
      continue;
    }
    lastPauseEvent = event.atMs;
    if (event.event === "PAUSE") {
      if (pausedAt !== null) pauseIssues.push("PAUSE_WITHOUT_RESUME");
      else pausedAt = event.atMs;
    } else if (pausedAt === null) pauseIssues.push("RESUME_WITHOUT_PAUSE");
    else {
      pauses.push({ from: pausedAt, to: event.atMs });
      pausedAt = null;
    }
  }
  if (pausedAt !== null) pauses.push({ from: pausedAt, to: trace.durationMs });
  for (const frame of trace.frames) {
    for (const flag of frame.timingFlags)
      bump(capturedFlagCounts, knownCaptureFlags.has(flag) ? flag : "OTHER_CAPTURE_FLAG");
    const outcome: Outcome = {
      frame,
      eligible: false,
      recognized: false,
      reset: false,
      rejection: null,
      detected: 0,
      providerProcessed: false,
    };
    const reject = (reason: string) => {
      outcome.rejection = reason;
      bump(rejectionCounts, reason);
      outcomes.push(outcome);
    };
    if (frame.sequence <= previousSequence) {
      reject("TRACE_SEQUENCE_REORDERED_OR_REPEATED");
      continue;
    }
    previousSequence = frame.sequence;
    if (frame.receivedMs < previousReceived) {
      reject("RECEIPT_CLOCK_REORDERED");
      continue;
    }
    previousReceived = frame.receivedMs;
    if (pauses.some((pause) => frame.receivedMs >= pause.from && frame.receivedMs < pause.to)) {
      reject("FRAME_DURING_DECLARED_PAUSE");
      continue;
    }
    if (
      frame.captureMs === null ||
      frame.inferenceMs === null ||
      frame.timingFlags.includes("CLOCK_MISSING_OR_INVALID")
    ) {
      reject("CLOCK_MISSING_OR_INVALID");
      continue;
    }
    if (
      frame.captureMs + clockOffsetMs < 0 ||
      frame.inferenceMs + clockOffsetMs < 0 ||
      frame.receivedMs + clockOffsetMs < 0
    ) {
      reject("CLOCK_OUTSIDE_FIXED_REPLAY_ORIGIN");
      continue;
    }
    if (
      !frame.width ||
      !frame.height ||
      !Number.isInteger(frame.width) ||
      !Number.isInteger(frame.height) ||
      frame.width <= 0 ||
      frame.height <= 0
    ) {
      reject("FRAME_DIMENSIONS_INVALID");
      continue;
    }
    const frameContext = `${frame.width}:${frame.height}:${frame.mirror}`;
    if (context !== null && context !== frameContext) {
      reject("FRAME_CONTEXT_CHANGED_NO_REBIND");
      continue;
    }
    if (!adapter) {
      context = frameContext;
      const binding = {
        providerGeneration: 1,
        cameraLeaseId: "local-replay-synthetic-binding",
        cameraFrameVersion: 1,
        mirrorTransform: frame.mirror ? ("PREVIEW_X" as const) : ("NONE" as const),
      };
      adapter = new BrowserHandAdapter(binding, "D0");
      gate = new ObservationGate({ ...binding, orientation: 0 });
    }
    try {
      const envelope = adapter.envelope(
        {
          landmarks: frame.hands.map((hand) =>
            hand.landmarks.map((point) => ({ x: point.x ?? NaN, y: point.y ?? NaN, z: point.z ?? NaN })),
          ),
          handedness: frame.hands.map((hand) =>
            hand.handedness === "UNKNOWN"
              ? []
              : [
                  {
                    categoryName: hand.handedness === "LEFT" ? "Left" : "Right",
                    score: hand.handednessScore ?? NaN,
                  },
                ],
          ),
        },
        frame.captureMs + clockOffsetMs,
        frame.inferenceMs + clockOffsetMs,
        frame.width,
        frame.height,
      );
      outcome.providerProcessed = true;
      outcome.detected = envelope.hands.length;
      const observation = gate!.accept(envelope, frame.receivedMs + clockOffsetMs);
      outcome.recognized = observation.hands.some((hand) => {
        const assessment = assessHand(hand, observation);
        return assessment.pointing && assessment.geometry && assessment.framed;
      });
      const readiness = selector.update(observation);
      outcome.eligible = readiness.eligible;
      outcome.reset = readiness.changed;
      outcomes.push(outcome);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      reject(
        [
          "HAND_PROVIDER_CLOCK_INVALID",
          "OBSERVATION_REORDERED",
          "OBSERVATION_CLOCK_OR_FRESHNESS",
          "OBSERVATION_FRAME_CHANGED",
        ].includes(message)
          ? message
          : "REPLAY_INPUT_REJECTED",
      );
    }
  }
  let stepStart = 0;
  const steps = trace.guide.map((step) => {
    const stepEnd = stepStart + step.seconds * 1000;
    const values = outcomes.filter((outcome) => outcome.frame.step === step.id),
      frames = values.map((outcome) => outcome.frame);
    const intendedPoint = step.intent === "POINT" || step.intent === "RECOVERY";
    const eligible = values.filter((outcome) => outcome.eligible),
      misses = values.filter((outcome) => !outcome.eligible);
    const rejected = values.filter((outcome) => outcome.rejection !== null),
      resets = values.filter((outcome) => outcome.reset);
    const recordedEnd = Math.max(stepStart, Math.min(stepEnd, trace.activeDurationMs));
    const longest = longestMiss(values, stepStart, recordedEnd);
    const representatives: Marker[] = [];
    if (frames.length)
      representatives.push(marker(middle(frames, (stepStart + stepEnd) / 2), "HOLD_MIDDLE_WITHOUT_FILTERING_FAILURES"));
    if (intendedPoint && misses.length)
      representatives.push(
        marker(middle(misses.map((outcome) => outcome.frame)), "POTENTIAL_MISS_REQUIRES_VISUAL_REVIEW"),
      );
    if (!intendedPoint && eligible.length)
      representatives.push(
        marker(middle(eligible.map((outcome) => outcome.frame)), "POTENTIAL_FALSE_POSITIVE_REQUIRES_VISUAL_REVIEW"),
      );
    if (resets.length) representatives.push(marker(resets[0].frame, "FIRST_REPLAY_CONTEXT_RESET"));
    if (rejected.length) representatives.push(marker(rejected[0].frame, rejected[0].rejection!));
    const rawCount = values.reduce((sum, outcome) => sum + outcome.frame.rawHandCount, 0);
    const accepted = values.filter((outcome) => !outcome.rejection);
    const processed = values.filter((outcome) => outcome.providerProcessed);
    const processedRawCount = processed.reduce((sum, outcome) => sum + outcome.frame.hands.length, 0);
    const postSuppressionCount = processed.reduce((sum, outcome) => sum + outcome.detected, 0);
    const report = {
      step: step.id,
      promptedIntent: step.intent,
      recordedFrames: values.length,
      replayAcceptedFrames: accepted.length,
      replayRejectedFrames: rejected.length,
      postureRecognizedFrames: values.filter((outcome) => outcome.recognized).length,
      eligibleFrames: eligible.length,
      eligibleFractionOfRecordedFrames: values.length ? eligible.length / values.length : null,
      rawHypothesesTotal: rawCount,
      providerProcessedFrames: processed.length,
      processedRecordedHypothesesTotal: processedRawCount,
      postSuppressionHypothesesTotal: postSuppressionCount,
      suppressedHypotheses: processedRawCount - postSuppressionCount,
      malformedFrames: frames.filter((frame) => frame.malformed).length,
      truncatedFrames: frames.filter((frame) => frame.truncated).length,
      replayContextResets: resets.length,
      potentialMissFrames: intendedPoint ? misses.length : null,
      potentialFalsePositiveFrames: intendedPoint ? null : eligible.length,
      longestEligibilityMiss: intendedPoint && recordedEnd > stepStart ? longest : null,
      representatives,
    };
    stepStart = stepEnd;
    return report;
  });
  return {
    format: "VOYAGEWRIGHT_LOCAL_POSE_REPLAY_AGGREGATE",
    version: 1,
    recordingId: trace.recordingId,
    physicalAccuracyQualified: false,
    labels: "PROMPTS_ONLY_NOT_VERIFIED_GROUND_TRUTH",
    analysis: "CURRENT_SOFTWARE_REPLAY_OF_RECORDED_MODEL_OUTPUT;_NOT_NEW_INFERENCE_OR_CAMERA_QUALIFICATION",
    modelDigest: handModel.modelDigest,
    recordedProviderVersion: trace.model.providerVersion,
    replayProviderVersion: handModel.providerVersion,
    clocks: {
      fixedSyntheticOffsetMs: clockOffsetMs,
      representativeSeekBasis: "CAPTURE_CLOCK_MINUS_PAUSES_BEST_EFFORT;_GUIDE_ELAPSED_FALLBACK_IF_CLOCK_MISSING",
      seekCaveat:
        "Check the visible step/time label in extracted video. Original camera media time includes pauses; container timestamps may vary.",
      replayCaveat:
        "Only recorded observations are replayed. Pauses omit tracking history; continuity metrics are replay diagnostics, not physical identity proof.",
    },
    recordedFrames: trace.frames.length,
    replayRejectedFrames: outcomes.filter((outcome) => outcome.rejection).length,
    replayContextResets: outcomes.filter((outcome) => outcome.reset).length,
    capturedFlagCounts,
    rejectionCounts,
    pauseEventIssues: pauseIssues,
    steps,
    privacy: "AGGREGATE_ONLY;_NO_VIDEO_LANDMARKS_CAMERA_OR_TRACK_IDENTIFIERS;_NO_NETWORK_OR_CALIBRATION_FITTING",
  };
}

export const replayHelp = `Usage: npx tsx scripts/reach/replay-pose-recording.ts --input <local-trace.json> [--output <new-aggregate.json>]
Reads only the explicitly named v1 local pose trace and replays current posture/continuity software.
No camera access, new inference, fitting, network calls, uploads or source-trace changes.
Prompt intent is an instruction, not verified ground truth. Review potential misses/false positives against video.
Representative video times are best effort; confirm the visible step/time label. Failures remain in counts.
Without --output, writes the aggregate report to stdout. Output parents must exist; existing files are never overwritten.
`;
export function parseReplayArguments(args: string[]) {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) return { help: true } as const;
  let input: string | undefined, output: string | undefined;
  for (let i = 0; i < args.length; i += 2) {
    const value = args[i + 1];
    if (!value || value.startsWith("--")) throw new Error("POSE_REPLAY_ARGUMENT_INVALID");
    if (args[i] === "--input" && !input) input = value;
    else if (args[i] === "--output" && !output) output = value;
    else throw new Error("POSE_REPLAY_ARGUMENT_INVALID");
  }
  if (!input || (output && path.resolve(input) === path.resolve(output)))
    throw new Error("POSE_REPLAY_ARGUMENT_INVALID");
  return { help: false, input, output } as const;
}
export async function runReplayCli(args: string[]) {
  const options = parseReplayArguments(args);
  if (options.help) return replayHelp;
  let source: string;
  try {
    if ((await stat(options.input)).size > 64 * 1024 * 1024) throw new Error("POSE_REPLAY_INPUT_TOO_LARGE");
    source = await readFile(options.input, "utf8");
  } catch (error) {
    if (error instanceof Error && error.message === "POSE_REPLAY_INPUT_TOO_LARGE") throw error;
    throw new Error("POSE_REPLAY_INPUT_UNREADABLE");
  }
  let input: unknown;
  try {
    input = JSON.parse(source);
  } catch {
    throw new Error("POSE_REPLAY_INPUT_JSON_INVALID");
  }
  const report = { ...replayPoseRecording(input), inputSha256: createHash("sha256").update(source).digest("hex") };
  const serialized = JSON.stringify(report, null, 2) + "\n";
  if (options.output) {
    try {
      await writeFile(options.output, serialized, { flag: "wx" });
    } catch {
      throw new Error("POSE_REPLAY_OUTPUT_NOT_CREATED;_CHECK_NEW_PATH_AND_EXISTING_PARENT");
    }
    return "Local aggregate replay report saved. Prompt labels still require visual review.\n";
  }
  return serialized;
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/reach/replay-pose-recording.ts")) {
  void runReplayCli(process.argv.slice(2))
    .then((output) => process.stdout.write(output))
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : "POSE_REPLAY_FAILED"}\n`);
      process.exitCode = 1;
    });
}
