// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { BrowserHandAdapter } from "@/watchglass/hand-provider";
import { assessHand } from "@/watchglass/hand-posture";
import { pointingPose, pointingTransitionPose } from "../../tests/e2e/fixtures/reach/pointing-poses";
import { pointingFeatures } from "./coordinates";

const binding = {
  providerGeneration: 1,
  cameraLeaseId: "d0-transition-camera",
  cameraFrameVersion: 1,
  mirrorTransform: "NONE" as const,
};
describe("continuous relaxed pointing through bottom/end-on and top/side-on poses", () => {
  it.each([
    { reverse: false, noisy: false },
    { reverse: true, noisy: false },
    { reverse: false, noisy: true },
    { reverse: true, noisy: true },
  ])("retains fresh observed pointing on 100 frames: %j", ({ reverse, noisy }) => {
    const adapter = new BrowserHandAdapter(binding, "D0");
    let initialTrack: string | undefined, previous: number[] | undefined;
    let sawMissingWrist = false,
      sawVisibleWrist = false;
    for (let i = 0; i < 100; i++) {
      const progress = reverse ? 1 - i / 99 : i / 99;
      const points = pointingTransitionPose(progress, noisy ? i * 0.19 : undefined);
      const at = 1000 + i * 40;
      // Use canonical raw-provider normalization; do not leave invalid raw
      // wrist coordinates inside a supposedly normalized observation fixture.
      const observation = adapter.envelope({ landmarks: [points], handedness: [] }, at, at + 5, 640, 480);
      const hand = observation.hands[0];
      initialTrack ??= hand.trackId;
      expect(hand.trackId).toBe(initialTrack);
      expect(hand.landmarks.filter((_, index) => [5, 6, 7, 8].includes(index)).every((point) => point.valid)).toBe(
        true,
      );
      expect(assessHand(hand, observation)).toMatchObject({ framed: true, geometry: true, pointing: true });
      expect(observation.evidenceTier).toBe("D0");
      sawMissingWrist ||= !hand.landmarks[0].valid;
      sawVisibleWrist ||= hand.landmarks[0].valid;
      const features = pointingFeatures(hand, observation);
      expect(features).toHaveLength(5);
      expect(features.every(Number.isFinite)).toBe(true);
      if (previous)
        expect(Math.max(...features.map((value, index) => Math.abs(value - previous![index])))).toBeLessThan(0.04);
      previous = features;
    }
    expect(sawMissingWrist && sawVisibleWrist).toBe(true);
  });
  it("keeps the palm orientation fixed while only the index rotates into depth", () => {
    const bottom = pointingTransitionPose(0),
      top = pointingTransitionPose(1);
    expect(bottom[0].y).toBeGreaterThan(1);
    expect(top[0].valid).toBe(true);
    for (const index of [0, 9, 17]) {
      expect(bottom[index].x - bottom[5].x).toBeCloseTo(top[index].x - top[5].x);
      expect(bottom[index].y - bottom[5].y).toBeCloseTo(top[index].y - top[5].y);
      expect(bottom[index].z - bottom[5].z).toBeCloseTo(top[index].z - top[5].z);
    }
    expect(Math.abs(bottom[6].y - bottom[5].y)).toBeLessThan(1e-8);
    expect(Math.abs(bottom[6].z - bottom[5].z)).toBeCloseTo(0.035);
    expect(Math.abs(top[6].z - top[5].z)).toBeLessThan(1e-8);
  });
  it.each(["OPEN", "FOLDED"] as const)(
    "never treats a noisy %s hand as pointing throughout the same movement",
    (kind) => {
      const adapter = new BrowserHandAdapter(binding, "D0");
      for (let i = 0; i < 100; i++) {
        const progress = i / 99,
          phase = i * 0.19;
        const points = pointingTransitionPose(progress, phase);
        if (kind === "OPEN") {
          const open = pointingPose({ otherBends: [0, 10, 20] });
          for (const index of [10, 11, 12, 14, 15, 16, 18, 19, 20])
            points[index] = {
              ...open[index],
              y: open[index].y + 0.36 - progress * 0.61,
              x: open[index].x + Math.sin(phase + index * 0.37) * 0.0007,
              z: open[index].z + Math.sin(phase * 0.9 + index * 0.31) * 0.0008,
            };
        } else {
          const angle = ((1 - progress) * Math.PI) / 2;
          for (const [offset, index] of [6, 7, 8].entries()) {
            const previous = points[index - 1],
              bend = angle + ([0, 110, 160][offset] * Math.PI) / 180;
            const length = [0.035, 0.025, 0.02][offset];
            points[index] = {
              ...previous,
              x: previous.x + Math.sin(phase + index * 0.37) * 0.0005,
              y: previous.y - (Math.cos(bend) * length) / 0.75 + Math.cos(phase * 0.7 + index * 0.27) * 0.0003,
              z: previous.z - Math.sin(bend) * length + Math.sin(phase * 0.9 + index * 0.31) * 0.0005,
            };
          }
        }
        const at = 1000 + i * 40;
        const observation = adapter.envelope({ landmarks: [points], handedness: [] }, at, at + 5, 640, 480);
        expect(assessHand(observation.hands[0], observation).pointing).toBe(false);
      }
    },
  );
});
