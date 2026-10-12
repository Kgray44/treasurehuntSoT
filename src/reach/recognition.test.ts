// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BrowserHandAdapter, type HandResult } from "@/watchglass/hand-provider";
import { assessHand } from "@/watchglass/hand-posture";
import { ActiveHandSelector, handObservationSchema, usableHand } from "./observation";
import { syntheticObservation } from "./synthetic";
const binding = {
  providerGeneration: 1,
  cameraLeaseId: "test-camera",
  cameraFrameVersion: 1,
  mirrorTransform: "NONE" as const,
};
function realPoint() {
  const text = readFileSync("tests/e2e/fixtures/reach/pointing_up_landmarks.pbtxt", "utf8");
  const points = [...text.matchAll(/landmark\s*\{\s*x:\s*([\d.e+-]+)\s*y:\s*([\d.e+-]+)\s*z:\s*([\d.e+-]+)/g)]
    .slice(0, 21)
    .map((match) => ({ x: Number(match[1]), y: Number(match[2]), z: Number(match[3]) }));
  expect(points).toHaveLength(21);
  return points;
}
const result = (points = realPoint()): HandResult => ({
  landmarks: [points],
  handedness: [[{ categoryName: "Right", score: 0.95 }]],
});
describe("stage separation and geometric posture on an official measured landmark fixture", () => {
  it("recognizes natural index pointing without fabricated confidence", () => {
    const o = new BrowserHandAdapter(binding, "D1").envelope(result(), 100, 110, 358, 376);
    expect(handObservationSchema.parse(o)).toEqual(o);
    expect(assessHand(o.hands[0])).toMatchObject({ detected: true, pointing: true, framed: true, geometry: true });
    expect(usableHand(o)).not.toBeNull();
    expect(o.hands[0].presenceScore).toBeNull();
    expect(o.hands[0].trackingScore).toBeNull();
  });
  it.each([0, Math.PI / 4, Math.PI / 2, Math.PI, Math.PI * 1.5])(
    "recognizes left/right reflected and rotated points at %s radians",
    (angle) => {
      for (const side of [1, -1]) {
        const points = realPoint().map((p) => {
          const x = (p.x - 0.5) * side * 0.7,
            y = (p.y - 0.5) * 0.7;
          return {
            x: 0.5 + x * Math.cos(angle) - y * Math.sin(angle),
            y: 0.5 + x * Math.sin(angle) + y * Math.cos(angle),
            z: p.z * 0.7,
          };
        });
        const o = new BrowserHandAdapter(binding).envelope(result(points), 100, 110, 640, 480);
        expect(assessHand(o.hands[0]).pointing).toBe(true);
      }
    },
  );
  it("allows a hidden nonessential little-finger tip but rejects a missing index tip", () => {
    const points = realPoint();
    points[20].x = 1.1;
    const o = new BrowserHandAdapter(binding).envelope(result(points), 100, 110, 640, 480);
    expect(o.hands[0].landmarks[20].valid).toBe(false);
    expect(usableHand(o)).not.toBeNull();
    const invalid = structuredClone(o);
    invalid.hands[0].landmarks[8].valid = false;
    expect(usableHand(invalid)).toBeNull();
    expect(assessHand(invalid.hands[0]).detected).toBe(true);
  });
  it("keeps a visibly detected edge hand distinct from sample eligibility", () => {
    const points = realPoint();
    points[8].x = 0.995;
    const o = new BrowserHandAdapter(binding).envelope(result(points), 100, 110, 640, 480);
    expect(o.quality).toBe("USABLE");
    expect(o.reason).toBe("LOW_VISIBILITY");
    expect(usableHand(o)).toBeNull();
    expect(assessHand(o.hands[0]).detected).toBe(true);
  });
  it("rejects a curled index, collapsed joints and an open palm", () => {
    for (const kind of ["BENT", "COLLAPSED", "OPEN"]) {
      const o = syntheticObservation({ x: 0.5, y: 0.5 }, 0, 100),
        hand = o.hands[0];
      if (kind === "BENT") hand.landmarks[8] = { ...hand.landmarks[5] };
      if (kind === "COLLAPSED") hand.landmarks[7] = { ...hand.landmarks[8] };
      if (kind === "OPEN")
        for (const base of [9, 13, 17])
          for (let i = 0; i < 4; i++)
            hand.landmarks[base + i] = { x: 0.5 + (base - 9) * 0.005, y: 0.5 - i * 0.025, z: 0, valid: true };
      expect(assessHand(hand).pointing).toBe(false);
      expect(assessHand(hand).detected).toBe(true);
    }
  });
});
describe("local continuity and deliberate active-hand selection", () => {
  const handAt = (x: number) => syntheticObservation({ x, y: 0.5 }, 0, 100).hands[0].landmarks;
  it("keeps the selected hand when another appears and provider array order reverses", () => {
    const adapter = new BrowserHandAdapter(binding),
      selector = new ActiveHandSelector();
    let o = adapter.envelope(result(handAt(0.3)), 100, 105, 640, 480);
    selector.update(o);
    o = adapter.envelope(result(handAt(0.3)), 400, 405, 640, 480);
    const active = selector.update(o).hand!.trackId;
    o = adapter.envelope({ landmarks: [handAt(0.75), handAt(0.31)], handedness: [] }, 450, 455, 640, 480);
    const r = selector.update(o);
    expect(r.eligible).toBe(true);
    expect(r.hand!.trackId).toBe(active);
    expect(r.detectedCount).toBe(2);
    expect(o.quality).toBe("USABLE");
    expect(o.reason).toBe("MULTIPLE_HANDS");
  });
  it("suspends crossings and creates fresh tracks after separation", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = adapter.envelope({ landmarks: [handAt(0.35), handAt(0.65)], handedness: [] }, 100, 105, 640, 480);
    const crossing = adapter.envelope({ landmarks: [handAt(0.49), handAt(0.51)], handedness: [] }, 150, 155, 640, 480);
    expect(crossing.hands.every((h) => h.continuity === "AMBIGUOUS")).toBe(true);
    expect(crossing.hands.every((h) => usableHand(crossing, h.trackId) === null)).toBe(true);
    const next = adapter.envelope({ landmarks: [handAt(0.35), handAt(0.65)], handedness: [] }, 200, 205, 640, 480);
    expect(next.hands.every((h) => !first.hands.some((old) => old.trackId === h.trackId))).toBe(true);
  });
  it("requires a choice when two equally eligible hands first appear", () => {
    const adapter = new BrowserHandAdapter(binding),
      selector = new ActiveHandSelector();
    const o = adapter.envelope({ landmarks: [handAt(0.3), handAt(0.7)], handedness: [] }, 100, 105, 640, 480);
    expect(selector.update(o).condition).toBe("CHOOSE_HAND");
    selector.choose(o.hands[1].trackId);
    selector.update(o);
    const settled = adapter.envelope({ landmarks: [handAt(0.3), handAt(0.7)], handedness: [] }, 350, 355, 640, 480);
    expect(selector.update(settled)).toMatchObject({ eligible: true, hand: { trackId: o.hands[1].trackId } });
  });
  it("never preserves identity through a camera context change or implausible hand jump", () => {
    const adapter = new BrowserHandAdapter(binding),
      selector = new ActiveHandSelector();
    const a = adapter.envelope(result(handAt(0.3)), 100, 105, 640, 480);
    selector.update(a);
    const b = adapter.envelope(result(handAt(0.3)), 350, 355, 640, 480);
    selector.update(b);
    expect(selector.update({ ...b, providerGeneration: 2 }).changed).toBe(true);
    const jump = adapter.envelope(result(handAt(0.8)), 400, 405, 640, 480);
    expect(jump.hands[0].trackId).not.toBe(b.hands[0].trackId);
  });
  it("rejects provider clock regression before mutating continuity", () => {
    const adapter = new BrowserHandAdapter(binding);
    adapter.envelope(result(), 100, 105, 640, 480);
    expect(() => adapter.envelope(result(), 99, 110, 640, 480)).toThrow("HAND_PROVIDER_CLOCK_INVALID");
    expect(() => adapter.envelope(result(), 120, 110, 640, 480)).toThrow("HAND_PROVIDER_CLOCK_INVALID");
  });
});
