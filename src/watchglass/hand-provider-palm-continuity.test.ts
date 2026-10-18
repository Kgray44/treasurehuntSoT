// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { BrowserHandAdapter, HAND_CONTINUITY_GRACE_MS, handModel, type HandResult } from "./hand-provider";
import { handObservationSchema } from "./hand-observation";
import { indexGeometry } from "./index-geometry";
import { usableHand } from "@/reach/observation";
import { pointingPose } from "../../tests/e2e/fixtures/reach/pointing-poses";

const binding = {
  providerGeneration: 1,
  cameraLeaseId: "d0-observed-palm-continuity",
  cameraFrameVersion: 1,
  mirrorTransform: "NONE" as const,
};
function pose(depthAngle = 0, malformed = false, x = 0) {
  const points = pointingPose({ depthAngle, indexBends: [0, 10, 20] }).map((point) => ({ ...point, x: point.x + x }));
  points[0] = { x: -1, y: -1, z: 0, valid: false };
  if (malformed) for (const index of [6, 7, 8]) points[index] = { ...points[5] };
  return points;
}
function result(...hands: ReturnType<typeof pose>[]): HandResult {
  return { landmarks: hands, handedness: [] };
}
function frame(adapter: BrowserHandAdapter, at: number, ...hands: ReturnType<typeof pose>[]) {
  return adapter.envelope(result(...hands), at, at + 5, 640, 480);
}

describe("independently observed palm-row continuation of an established hand", () => {
  it("retains one known hand through malformed index/depth rotation without inventing index evidence", () => {
    const adapter = new BrowserHandAdapter(binding, "D0");
    const first = frame(adapter, 100, pose()).hands[0];
    for (let at = 200; at <= 1800; at += 100) {
      const observation = frame(adapter, at, pose(((at - 100) / 1700) * 80, true));
      expect(observation.hands[0]).toMatchObject({
        trackId: first.trackId,
        trackGeneration: first.trackGeneration,
        continuity: "CONTINUOUS",
        associationBasis: "OBSERVED_PALM_CONTINUITY_V1",
        pose: "UNKNOWN",
      });
      expect(indexGeometry(observation.hands[0], observation).geometry).toBe(false);
      expect(usableHand(observation, first.trackId)).toBeNull();
      expect(handObservationSchema.safeParse(observation).success).toBe(true);
    }
    expect(frame(adapter, 1900, pose(80)).hands[0]).toMatchObject({
      trackId: first.trackId,
      continuity: "CONTINUOUS",
    });
  });

  it("does not cold-initialize a malformed index from a visible palm", () => {
    const adapter = new BrowserHandAdapter(binding);
    for (const at of [100, 200, 300]) expect(frame(adapter, at, pose(0, true)).hands[0].continuity).toBe("AMBIGUOUS");
    expect(frame(adapter, 400, pose()).hands[0].continuity).toBe("ACQUIRED");
  });

  it.each([5, 9, 13, 17])("requires the current observed knuckle %s rather than inferring it", (index) => {
    const adapter = new BrowserHandAdapter(binding);
    const first = frame(adapter, 100, pose()).hands[0];
    const current = pose(0, true);
    current[index] = { x: -1, y: -1, z: 0, valid: false };
    for (const at of [200, 500, 800, 1100, 1350])
      expect(frame(adapter, at, current).hands[0].continuity).toBe("AMBIGUOUS");
    expect(frame(adapter, 1400, pose()).hands[0].trackId).not.toBe(first.trackId);
  });

  it.each(["ORDER", "SHAPE", "SCALE", "TRANSLATION"])("rejects an independently implausible %s palm cue", (kind) => {
    const adapter = new BrowserHandAdapter(binding);
    frame(adapter, 100, pose());
    let current = pose(0, true);
    if (kind === "ORDER") [current[9], current[13]] = [current[13], current[9]];
    if (kind === "SHAPE") current[9].y += 0.04;
    if (kind === "SCALE") {
      const base = current[5];
      current = current.map((point) => ({
        ...point,
        x: base.x + (point.x - base.x) * 1.25,
        y: base.y + (point.y - base.y) * 1.25,
        z: base.z + (point.z - base.z) * 1.25,
      }));
    }
    if (kind === "TRANSLATION") current = current.map((point) => ({ ...point, x: point.x + 0.16 }));
    expect(frame(adapter, 200, current).hands[0].continuity).toBe("AMBIGUOUS");
  });

  it.each([200, 201])("uses a bounded actual palm observation gap of %sms", (gap) => {
    const adapter = new BrowserHandAdapter(binding);
    const first = frame(adapter, 100, pose()).hands[0];
    const current = frame(adapter, 100 + gap, pose(0, true)).hands[0];
    expect(current.continuity).toBe(gap === 200 ? "CONTINUOUS" : "AMBIGUOUS");
    if (gap === 200) expect(current.trackId).toBe(first.trackId);
  });

  it("expires from the last observed palm when the hand disappears", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = frame(adapter, 100, pose()).hands[0];
    expect(frame(adapter, 200, pose(0, true)).hands[0].trackId).toBe(first.trackId);
    frame(adapter, 1000);
    expect(frame(adapter, 201 + HAND_CONTINUITY_GRACE_MS, pose()).hands[0].trackId).not.toBe(first.trackId);
  });

  it("does not resolve two current hypotheses through their matching palms", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = frame(adapter, 100, pose()).hands[0];
    for (let at = 200; at <= 1500; at += 100)
      expect(
        frame(adapter, at, pose(0, true), pose(0, true, 0.01)).hands.every((hand) => hand.continuity === "AMBIGUOUS"),
      ).toBe(true);
    expect(frame(adapter, 1600, pose()).hands[0].trackId).not.toBe(first.trackId);
  });

  it("cannot use a palm to select between two established histories", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = frame(adapter, 100, pose(0, false, -0.2), pose(0, false, 0.2));
    frame(adapter, 150, pose(0, false, -0.2), pose(0, false, 0.2));
    const current = frame(adapter, 200, pose(0, true, -0.2)).hands[0];
    expect(current.continuity).toBe("AMBIGUOUS");
    expect(first.hands.some((hand) => hand.trackId === current.trackId)).toBe(false);
  });

  it("retires two established tracks on crossing instead of using palm shape to break it", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = frame(adapter, 100, pose(0, false, -0.2), pose(0, false, 0.2));
    const crossing = frame(adapter, 200, pose(0, true), pose(0, true, 0.01));
    expect(crossing.hands.every((hand) => hand.continuity === "AMBIGUOUS")).toBe(true);
    const returned = frame(adapter, 300, pose(0, false, -0.2), pose(0, false, 0.2));
    expect(returned.hands.every((hand) => !first.hands.some((old) => old.trackId === hand.trackId))).toBe(true);
  });

  it("does not publish an old fixed index or its velocity after the palm moved", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = frame(adapter, 100, pose()).hands[0];
    for (let at = 200; at <= 500; at += 100)
      expect(frame(adapter, at, pose(0, true, ((at - 100) / 100) * 0.05)).hands[0].trackId).toBe(first.trackId);
    const oldIndexOnly = pose();
    for (const i of [9, 13, 17]) oldIndexOnly[i] = { x: -1, y: -1, z: 0, valid: false };
    expect(frame(adapter, 600, oldIndexOnly).hands[0].trackId).not.toBe(first.trackId);
  });

  it("does not renew palm state from a result rejected by the final capture predicate", () => {
    const adapter = new BrowserHandAdapter(binding);
    frame(adapter, 100, pose());
    let checks = 0;
    expect(() => adapter.envelope(result(pose(0, true)), 250, 255, 640, 480, () => ++checks === 1)).toThrow(
      "HAND_PROVIDER_CAPTURE_REJECTED",
    );
    expect(frame(adapter, 301, pose(0, true)).hands[0].continuity).toBe("AMBIGUOUS");
  });

  it("does not reuse a palm measurement from another negotiated geometry or provider session", () => {
    const adapter = new BrowserHandAdapter(binding);
    frame(adapter, 100, pose());
    expect(adapter.envelope(result(pose(0, true)), 200, 205, 800, 600).hands[0].continuity).toBe("AMBIGUOUS");
    expect(
      frame(new BrowserHandAdapter({ ...binding, providerGeneration: 2 }), 300, pose(0, true)).hands[0].continuity,
    ).toBe("AMBIGUOUS");
  });

  it("versions the new association interpretation without changing model weights", () => {
    expect(handModel.providerVersion).toBe("1.6.0");
    expect(handModel.modelDigest).toBe("fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1");
  });
});
