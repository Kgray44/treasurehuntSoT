// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { BrowserHandAdapter } from "@/watchglass/hand-provider";
import { assessHand } from "@/watchglass/hand-posture";
import { pointingPose } from "../../tests/e2e/fixtures/reach/pointing-poses";

const binding = {
  providerGeneration: 1,
  cameraLeaseId: "d0-palm-reference",
  cameraFrameVersion: 1,
  mirrorTransform: "NONE" as const,
};
function largeEndOn(bodyY: number) {
  const points = pointingPose(),
    base = points[5];
  for (const [offset, index] of [6, 7, 8].entries())
    points[index] = { ...base, z: base.z - [0.035, 0.06, 0.08][offset] };
  return points.map((point) => ({
    x: 0.3 + (point.x - base.x) * 4.8,
    y: bodyY + (point.y - base.y) * 4.8,
    z: point.z * 4.8,
  }));
}
describe("same-palm continuity through wrist clipping and depth rotation", () => {
  it.each([false, true])(
    "retains a large framed hand when a six-thousandths image move clips the wrist; reverse=%s",
    (reverse) => {
      const adapter = new BrowserHandAdapter(binding, "D0");
      const positions = [0.282, 0.288, 0.294, 0.3, 0.306];
      if (reverse) positions.reverse();
      let identity: string | undefined,
        sawVisible = false,
        sawHidden = false;
      for (const [index, y] of positions.entries()) {
        const at = 100 + index * 100;
        const observation = adapter.envelope({ landmarks: [largeEndOn(y)], handedness: [] }, at, at + 5, 640, 480);
        const hand = observation.hands[0];
        identity ??= hand.trackId;
        expect(assessHand(hand, observation)).toMatchObject({ framed: true, pointing: true });
        expect(hand.trackId).toBe(identity);
        expect(hand.continuity).toBe(index ? "CONTINUOUS" : "ACQUIRED");
        sawVisible ||= hand.landmarks[0].valid;
        sawHidden ||= !hand.landmarks[0].valid;
      }
      expect(sawVisible && sawHidden).toBe(true);
    },
  );
  it("does not accumulate replacement generations during repeated small wrist-boundary crossings at ten fps", () => {
    const adapter = new BrowserHandAdapter(binding, "D0");
    let identity: string | undefined;
    const positions = [0.288, 0.3, 0.294, 0.306, 0.3, 0.294];
    for (let i = 0; i < 100; i++) {
      const at = 100 + i * 100;
      const observation = adapter.envelope(
        { landmarks: [largeEndOn(positions[i % positions.length])], handedness: [] },
        at,
        at + 5,
        640,
        480,
      );
      const hand = observation.hands[0];
      identity ??= hand.trackId;
      expect(hand.trackId).toBe(identity);
      expect(assessHand(hand, observation).pointing).toBe(true);
    }
  });
  it.each([
    { width: 640, height: 480, reverse: false },
    { width: 1280, height: 720, reverse: false },
    { width: 480, height: 640, reverse: false },
    { width: 640, height: 480, reverse: true },
  ])(
    "keeps coherent motion while projected palm width foreshortens, using observed 3D proportions: %j",
    ({ width, height, reverse }) => {
      const adapter = new BrowserHandAdapter(binding, "D0");
      let identity: string | undefined, originalSpan: number | undefined;
      const positions = reverse ? [0.8, 0.68, 0.52, 0.36] : [0.2, 0.32, 0.48, 0.64];
      const projected: number[] = [];
      for (const [index, turn] of [0, 20, 45, 60].entries()) {
        const landmarks = pointingPose({ palmTurn: turn, aspect: height / width }).map((point) => ({
          ...point,
          x: point.x - 0.45 + positions[index],
        }));
        const at = 100 + index * 100;
        const observation = adapter.envelope({ landmarks: [landmarks], handedness: [] }, at, at + 5, width, height);
        const hand = observation.hands[0],
          a = hand.landmarks[5],
          b = hand.landmarks[17];
        identity ??= hand.trackId;
        const span = Math.hypot(a.x - b.x, ((a.y - b.y) * height) / width, a.z - b.z);
        originalSpan ??= span;
        projected.push(Math.hypot(a.x - b.x, a.y - b.y));
        expect(span).toBeCloseTo(originalSpan, 8);
        expect(assessHand(hand, observation)).toMatchObject({ framed: true, pointing: true });
        expect(hand.trackId).toBe(identity);
        expect(hand.continuity).toBe(index ? "CONTINUOUS" : "ACQUIRED");
      }
      expect(Math.max(...projected) / Math.min(...projected)).toBeGreaterThan(1.2);
    },
  );
});
