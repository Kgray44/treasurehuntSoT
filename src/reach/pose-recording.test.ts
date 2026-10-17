// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { expect, it } from "vitest";
import {
  PoseRecordingSession,
  poseRecordingDurationMs,
  poseRecordingLimits,
  poseRecordingSteps,
} from "./pose-recording";
import type { RawHandInference } from "./browser-runtime";
const points = () => Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: -0.1 }));
const frame = (capture = 1010): RawHandInference => ({
  result: { landmarks: [points()], handedness: [[{ categoryName: "Right", score: 0.92 }]] },
  capture,
  inference: capture + 20,
  received: capture + 30,
  videoTime: 20 + (capture - 1000) / 1000,
  width: 640,
  height: 480,
  mirror: true,
});
it("labels all nine positions separately and keeps the complete guide below the wall limit", () => {
  const targets = poseRecordingSteps.filter((step) => "target" in step);
  expect(targets).toHaveLength(9);
  expect(new Set(targets.map((step) => step.id)).size).toBe(9);
  expect(poseRecordingDurationMs).toBe(74_000);
  expect(poseRecordingDurationMs).toBeLessThan(poseRecordingLimits.durationMs);
  expect(poseRecordingSteps.find((step) => step.id === "HIDE")!.seconds).toBe(1);
});
it("retains out-of-bounds relative landmarks without clamping or manufacturing missing coordinates", () => {
  const recording = new PoseRecordingSession(1000, 20),
    raw = frame();
  const result = raw.result as { landmarks: ReturnType<typeof points>[] };
  result.landmarks[0][0] = { x: -0.25, y: 1.4, z: -0.3 };
  result.landmarks[0][1].x = NaN;
  result.landmarks[0][2].y = Infinity;
  recording.append(raw, 1040);
  result.landmarks[0][0].x = 99;
  const recorded = recording.export().frames[0];
  expect(recorded.hands[0].landmarks[0]).toEqual({ x: -0.25, y: 1.4, z: -0.3 });
  expect(recorded.hands[0].landmarks[1].x).toBeNull();
  expect(recorded.hands[0].landmarks[2].y).toBeNull();
  expect(recorded.malformed).toBe(true);
  expect(recorded.hands[0].handednessScore).toBe(0.92);
});
it("retains no-hand and multiple-hand results and bounds cloned joints and categories", () => {
  const recording = new PoseRecordingSession(1000, 20);
  recording.append({ ...frame(), result: { landmarks: [], handedness: [] } }, 1040);
  recording.append(
    {
      ...frame(1050),
      result: {
        landmarks: [points(), points(), points()],
        handedness: [[{ categoryName: "private untrusted text", score: 0.2 }]],
      },
    },
    1080,
  );
  const frames = recording.export().frames;
  expect(frames[0]).toMatchObject({ sequence: 0, hands: [], rawHandCount: 0, malformed: false });
  expect(frames[1]).toMatchObject({ sequence: 1, rawHandCount: 3, truncated: true });
  expect(frames[1].hands).toHaveLength(2);
  expect(frames[1].hands[0].landmarks).toHaveLength(21);
  expect(frames[1].hands[0].handedness).toBe("UNKNOWN");
  expect(JSON.stringify(frames)).not.toContain("private untrusted text");
});
it("records malformed and missing model data as bounded evidence instead of failing the pipeline", () => {
  const recording = new PoseRecordingSession(1000, 20);
  recording.append({ ...frame(), result: undefined }, 1040);
  recording.append({ ...frame(1050), result: { landmarks: [[{ x: 0.2 }]] } }, 1080);
  expect(recording.export().frames[0]).toMatchObject({ malformed: true, hands: [] });
  expect(recording.export().frames[1].hands[0].landmarks[0]).toEqual({ x: 0.2, y: null, z: null });
  expect(recording.export().frames[1].hands[0].landmarks[20]).toEqual({ x: null, y: null, z: null });
});
it("keeps stale, repeated and pre-start captures with explicit timing anomalies", () => {
  const recording = new PoseRecordingSession(1000, 20);
  recording.append({ ...frame(990), received: 1200 }, 1200);
  recording.append({ ...frame(990), received: 1250 }, 1250);
  const frames = recording.export().frames;
  expect(frames[0].captureMs).toBe(-10);
  expect(frames[0].timingFlags).toEqual(expect.arrayContaining(["CAPTURE_BEFORE_RECORDING_START", "STALE_OVER_150MS"]));
  expect(frames[1].timingFlags).toContain("CAPTURE_REORDERED_OR_REPEATED");
  expect(frames.map((item) => item.sequence)).toEqual([0, 1]);
});
it("keeps clip-relative capture time separate from camera time across an explicit pause", () => {
  const recording = new PoseRecordingSession(1000, 20);
  recording.pause(1100);
  expect(recording.append(frame(1150), 1180)).toBe(false);
  recording.resume(1200);
  recording.append({ ...frame(1250), videoTime: 20.25 }, 1280);
  const recorded = recording.export().frames[0];
  expect(recorded.recordingElapsedMs).toBe(150);
  expect(recorded.activeElapsedMs).toBe(180);
  expect(recorded.relativeCameraVideoTimeMs).toBeCloseTo(250);
  expect(recording.export().pauseEvents).toEqual([
    { atMs: 100, event: "PAUSE" },
    { atMs: 200, event: "RESUME" },
  ]);
});
it("flags an in-flight capture from a pause and labels captures by the prompt present at capture time", () => {
  const recording = new PoseRecordingSession(1000, 20);
  recording.pause(1100);
  recording.resume(1200);
  recording.append(frame(1150), 1210);
  expect(recording.export().frames[0].timingFlags).toContain("CAPTURE_DURING_PAUSE");
  expect(recording.export().frames[0].recordingElapsedMs).toBe(100);
  recording.append(frame(7090), 7150);
  const recorded = recording.export().frames[1];
  expect(recorded.step).toBe("CENTER");
  expect(recorded.recordingElapsedMs).toBe(5990);
  expect(recorded.timingFlags).toContain("CAPTURE_FROM_PREVIOUS_PROMPT");
});
it("stops automatically at the guide boundary without fitting or asserting actual intent", () => {
  const recording = new PoseRecordingSession(1000, 20);
  expect(recording.tick(1000 + poseRecordingDurationMs).stopped).toBe(true);
  expect(recording.export()).toMatchObject({
    stopReason: "GUIDE_COMPLETE",
    intentLabels: "PROMPTS_ONLY_NOT_VERIFIED_GROUND_TRUTH",
    physicalAccuracyQualified: false,
  });
  expect(recording.append(frame(75_000), 75_030)).toBe(false);
});
it("bounds time even while paused and retains the original stop reason", () => {
  const recording = new PoseRecordingSession(1000, 20);
  recording.pause(2000);
  recording.tick(91_000);
  recording.stop(91_010, "OTHER");
  expect(recording.export().stopReason).toBe("WALL_TIME_LIMIT");
  expect(recording.export().activeDurationMs).toBe(1000);
});
it("caps the raw trace at three thousand frames without unbounded memory", () => {
  const recording = new PoseRecordingSession(0, 0);
  for (let i = 1; i <= 3001; i++) recording.append({ ...frame(i), result: { landmarks: [] } }, i);
  const result = recording.export();
  expect(result.frames).toHaveLength(3000);
  expect(result.stopReason).toBe("FRAME_LIMIT");
  expect(result.traceBytes).toBeLessThanOrEqual(poseRecordingLimits.traceBytes);
});
it("omits identity, lease and fit fields and refuses a regressing control clock", () => {
  const recording = new PoseRecordingSession(1000, 20);
  recording.append(frame(), 1040);
  expect(() => recording.pause(1039)).toThrow("POSE_RECORDING_CLOCK_INVALID");
  const text = JSON.stringify(recording.export());
  for (const key of ["cameraLeaseId", "trackId", "providerGeneration", "coefficients", "deviceId"])
    expect(text).not.toContain(key);
  expect(recording.export().model.modelDigest).toMatch(/^[a-f0-9]{64}$/);
});
