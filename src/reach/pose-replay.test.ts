// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { parseReplayArguments, replayPoseRecording, runReplayCli } from "../../scripts/reach/replay-pose-recording";
import { pointingPose } from "../../tests/e2e/fixtures/reach/pointing-poses";
import { PoseRecordingSession, poseRecordingSteps } from "./pose-recording";

const ownedDirectories: string[] = [];
afterEach(async () => {
  for (const directory of ownedDirectories.splice(0)) {
    if (path.dirname(directory) !== tmpdir() || !path.basename(directory).startsWith("reach-pose-replay-"))
      throw new Error("REPLAY_TEST_TEMP_BOUNDARY_INVALID");
    await rm(directory, { recursive: true, force: true });
  }
});
function append(session: PoseRecordingSession, at: number, points = pointingPose(), capture = at) {
  session.append(
    {
      result: { landmarks: [points], handedness: [[{ categoryName: "Right", score: 0.95 }]] },
      capture: 1000 + capture,
      inference: 1005 + capture,
      received: 1010 + at,
      videoTime: 5 + at / 1000,
      width: 640,
      height: 480,
      mirror: false,
    },
    1010 + at,
  );
}
function fixture(times = [0, 100, 200, 300, 400, 500]) {
  const session = new PoseRecordingSession(1000, 5);
  for (const time of times) append(session, time);
  session.stop(1010 + times.at(-1)! + 100);
  return session.export();
}
it("replays the real provider and selector without calling an instruction verified ground truth", () => {
  const report = replayPoseRecording(fixture());
  const center = report.steps[0];
  expect(center.recordedFrames).toBe(6);
  expect(center.postureRecognizedFrames).toBe(6);
  expect(center.eligibleFrames).toBe(3);
  expect(center.potentialMissFrames).toBe(3);
  expect(center.longestEligibilityMiss!.durationMs).toBeGreaterThanOrEqual(300);
  expect(report.physicalAccuracyQualified).toBe(false);
  expect(report.labels).toBe("PROMPTS_ONLY_NOT_VERIFIED_GROUND_TRUTH");
  const text = JSON.stringify(report);
  expect(text).not.toContain('"landmarks"');
  expect(text).not.toContain('"cameraLeaseId"');
  expect(text).not.toContain('"trackId"');
  expect(text).not.toContain('"coefficients"');
});
it("restores missing null coordinates as invalid joints rather than fabricated zero geometry", () => {
  const trace = fixture([0, 100, 200, 300, 400, 500, 600]);
  trace.frames[4].hands[0].landmarks[8].z = null;
  trace.frames[4].malformed = true;
  const center = replayPoseRecording(trace).steps[0];
  expect(center.malformedFrames).toBe(1);
  expect(center.postureRecognizedFrames).toBe(6);
  expect(center.eligibleFrames).toBe(3);
  expect(center.replayContextResets).toBe(0);
});
it("preserves stale, repeated and out-of-order clock failures rather than sorting or rebinding them", () => {
  const trace = fixture([0, 100, 200, 300, 400, 500, 600, 700]);
  trace.frames[4].captureMs = 250;
  trace.frames[4].inferenceMs = 255;
  trace.frames[5].captureMs = 310;
  trace.frames[5].inferenceMs = 315;
  trace.frames[5].timingFlags = ["STALE_OVER_150MS"];
  trace.frames[6].sequence = trace.frames[5].sequence;
  const report = replayPoseRecording(trace);
  expect(report.replayRejectedFrames).toBe(3);
  expect(report.rejectionCounts).toMatchObject({
    HAND_PROVIDER_CLOCK_INVALID: 1,
    OBSERVATION_CLOCK_OR_FRESHNESS: 1,
    TRACE_SEQUENCE_REORDERED_OR_REPEATED: 1,
  });
  expect(report.capturedFlagCounts.STALE_OVER_150MS).toBe(1);
  expect(report.steps[0].representatives.some((sample) => sample.reason === "HAND_PROVIDER_CLOCK_INVALID")).toBe(true);
});
it("reports camera-context changes without manufacturing a fresh compatible binding", () => {
  const trace = fixture([0, 100, 200, 300, 400, 500, 600]);
  trace.frames[4].width = 1280;
  trace.frames[5].mirror = true;
  const report = replayPoseRecording(trace);
  expect(report.rejectionCounts.FRAME_CONTEXT_CHANGED_NO_REBIND).toBe(2);
  expect(report.steps[0].replayAcceptedFrames).toBe(5);
});
it("replays recorded GPU recovery provenance and rejects a later backend or policy change without rebinding", () => {
  const trace = fixture();
  for (const frame of trace.frames) {
    frame.inferenceBackend = "GPU_WEBGL";
    frame.inferencePolicy = "WATCHGLASS_ACTUAL_ROI_RECOVERY_V1";
  }
  trace.frames[4].inferenceBackend = "CPU_WASM";
  trace.frames[4].inferencePolicy = "ORIGINAL_CPU";
  const report = replayPoseRecording(trace);
  expect(report.replayProviderVersion).toBe("1.6.0+actual-roi-v1");
  expect(report.rejectionCounts.FRAME_CONTEXT_CHANGED_NO_REBIND).toBe(1);
  expect(report.steps[0].replayAcceptedFrames).toBe(5);
  expect(report.recordedInferenceSources).toContain("GPU_WEBGL:WATCHGLASS_ACTUAL_ROI_RECOVERY_V1");
});
it("does not relabel GPU frames without a supported graph policy as originalCPU", () => {
  const trace = fixture();
  for (const frame of trace.frames) frame.inferenceBackend = "GPU_WEBGL";
  const report = replayPoseRecording(trace);
  expect(report.rejectionCounts.FRAME_INFERENCE_POLICY_UNSUPPORTED).toBe(6);
  expect(report.steps[0].replayAcceptedFrames).toBe(0);
  expect(report.replayProviderVersion).toBeNull();
});
it("counts unobserved long gaps as misses after the last fresh eligible position expires", () => {
  const report = replayPoseRecording(fixture([0, 100, 200, 300, 400, 3000, 3100, 3200]));
  expect(report.steps[0].longestEligibilityMiss!.durationMs).toBeGreaterThan(2400);
});
it("preserves raw count, duplicate suppression and truncation diagnostics separately", () => {
  const trace = fixture();
  for (const frame of trace.frames) {
    frame.hands.push(structuredClone(frame.hands[0]));
    frame.rawHandCount = 3;
    frame.truncated = true;
  }
  const center = replayPoseRecording(trace).steps[0];
  expect(center.rawHypothesesTotal).toBe(18);
  expect(center.processedRecordedHypothesesTotal).toBe(12);
  expect(center.postSuppressionHypothesesTotal).toBe(6);
  expect(center.suppressedHypotheses).toBe(6);
  expect(center.truncatedFrames).toBe(6);
});
it("reports potential unexpected pointing for visual review, including the context reset that preceded it", () => {
  const openIndex = poseRecordingSteps.findIndex((step) => step.id === "OPEN_PALM");
  const openAt = poseRecordingSteps.slice(0, openIndex).reduce((sum, step) => sum + step.seconds * 1000, 0);
  const trace = fixture([
    0,
    100,
    200,
    300,
    openAt,
    openAt + 100,
    openAt + 200,
    openAt + 300,
    openAt + 400,
    openAt + 500,
    openAt + 600,
  ]);
  const report = replayPoseRecording(trace),
    open = report.steps.find((step) => step.step === "OPEN_PALM")!;
  expect(open.potentialFalsePositiveFrames).toBeGreaterThan(0);
  expect(open.replayContextResets).toBe(1);
  expect(
    open.representatives.some((sample) => sample.reason === "POTENTIAL_FALSE_POSITIVE_REQUIRES_VISUAL_REVIEW"),
  ).toBe(true);
});
it("exposes both paused-camera and suggested recording clocks without claiming exact video-frame alignment", () => {
  const session = new PoseRecordingSession(1000, 5);
  for (const at of [0, 100, 200, 300]) append(session, at);
  session.pause(1400);
  session.resume(2000);
  for (const at of [1100, 1200, 1300]) append(session, at);
  session.stop(2400);
  const report = replayPoseRecording(session.export());
  expect(report.replayRejectedFrames).toBe(0);
  expect(report.clocks.representativeSeekBasis).toContain("CAPTURE_CLOCK_MINUS_PAUSES_BEST_EFFORT");
  expect(
    report.steps[0].representatives.some(
      (sample) => sample.relativeCameraVideoTimeMs! - sample.suggestedRecordedVideoTimeMs > 500,
    ),
  ).toBe(true);
  expect(report.clocks.seekCaveat).toContain("visible step/time label");
});
it("requires the known recording schema, model digest and prompt vocabulary", () => {
  const unknown = fixture();
  unknown.version = 2;
  expect(() => replayPoseRecording(unknown)).toThrow("POSE_REPLAY_UNSUPPORTED_OR_INVALID_SCHEMA");
  const sourceModel = fixture();
  const model = { ...sourceModel, model: { ...sourceModel.model, modelDigest: "a".repeat(64) } };
  expect(() => replayPoseRecording(model)).toThrow("POSE_REPLAY_MODEL_IDENTITY_MISMATCH");
  const prompts = fixture();
  prompts.frames[0].promptedIntent = "NO_HAND";
  expect(() => replayPoseRecording(prompts)).toThrow("POSE_REPLAY_PROMPT_SCHEMA_MISMATCH");
  const named = fixture();
  named.recordingId = "reach-pose-recording-20261017T161200Z-ab123456";
  expect(replayPoseRecording(named).recordingId).toBe(named.recordingId);
  named.recordingId = "../private-input";
  expect(() => replayPoseRecording(named)).toThrow("POSE_REPLAY_UNSUPPORTED_OR_INVALID_SCHEMA");
});
it("accepts only explicit input/output arguments and preserves both input and existing outputs", async () => {
  expect(parseReplayArguments(["--help"])).toEqual({ help: true });
  for (const args of [
    [],
    ["fixture.json"],
    ["--input"],
    ["--input", "x", "--upload", "yes"],
    ["--input", "x", "--output", "x"],
  ])
    expect(() => parseReplayArguments(args)).toThrow("POSE_REPLAY_ARGUMENT_INVALID");
  const directory = await mkdtemp(path.join(tmpdir(), "reach-pose-replay-"));
  ownedDirectories.push(directory);
  const input = path.join(directory, "trace.json"),
    output = path.join(directory, "aggregate.json");
  const source = JSON.stringify(fixture());
  await writeFile(input, source);
  await runReplayCli(["--input", input, "--output", output]);
  const aggregate = await readFile(output, "utf8");
  expect(JSON.parse(aggregate).inputSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(aggregate).not.toContain('"landmarks"');
  await expect(runReplayCli(["--input", input, "--output", output])).rejects.toThrow("POSE_REPLAY_OUTPUT_NOT_CREATED");
  expect(await readFile(input, "utf8")).toBe(source);
  expect(await readFile(output, "utf8")).toBe(aggregate);
});
