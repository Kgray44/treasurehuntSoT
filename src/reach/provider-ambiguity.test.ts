// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { BrowserHandAdapter, HAND_CONTINUITY_GRACE_MS, type HandResult } from "@/watchglass/hand-provider";
import { ActiveHandSelector } from "./observation";
import { syntheticObservation } from "./synthetic";

const binding = {
  providerGeneration: 1,
  cameraLeaseId: "ambiguity-test-camera",
  cameraFrameVersion: 1,
  mirrorTransform: "NONE" as const,
};
const handAt = (x: number) => syntheticObservation({ x, y: 0.5 }, 0, 100).hands[0].landmarks;
const resultAt = (...xs: number[]): HandResult => ({ landmarks: xs.map(handAt), handedness: [] });
const frame = (adapter: BrowserHandAdapter, at: number, ...xs: number[]) =>
  adapter.envelope(resultAt(...xs), at, at + 5, 640, 480);

describe("bounded association recovery from transient extra hypotheses", () => {
  it.each([false, true])(
    "recovers a lone trusted history after ambiguous overlapping outputs (reverse=%s)",
    (reverse) => {
      const adapter = new BrowserHandAdapter(binding);
      const first = frame(adapter, 100, 0.5).hands[0];
      for (const at of [200, 300, 400, 500, 600]) {
        const xs = reverse ? [0.53, 0.5] : [0.5, 0.53];
        const ambiguous = frame(adapter, at, ...xs);
        expect(ambiguous.hands).toHaveLength(2);
        expect(ambiguous.hands.every((hand) => hand.continuity === "AMBIGUOUS")).toBe(true);
        expect(ambiguous.hands.every((hand) => hand.trackId !== first.trackId)).toBe(true);
      }
      expect(frame(adapter, 700, 0.51).hands[0]).toMatchObject({
        trackId: first.trackId,
        trackGeneration: first.trackGeneration,
        continuity: "CONTINUOUS",
      });
    },
  );

  it("does not refresh retained capture time through ambiguous hypotheses", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = frame(adapter, 100, 0.5).hands[0];
    for (const at of [300, 600, 900, 1200]) {
      expect(frame(adapter, at, 0.5, 0.53).hands.every((hand) => hand.continuity === "AMBIGUOUS")).toBe(true);
    }
    const expired = frame(adapter, 101 + HAND_CONTINUITY_GRACE_MS, 0.5).hands[0];
    expect(expired.trackId).not.toBe(first.trackId);
    expect(expired.continuity).toBe("ACQUIRED");
  });

  it("does not use pre-ambiguity velocity to carry a track outside its ordinary spatial gate", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = frame(adapter, 100, 0.2).hands[0];
    expect(frame(adapter, 150, 0.33).hands[0].trackId).toBe(first.trackId);
    expect(frame(adapter, 200, 0.49, 0.51).hands.every((hand) => hand.continuity === "AMBIGUOUS")).toBe(true);
    const jumped = frame(adapter, 250, 0.65).hands[0];
    expect(jumped.trackId).not.toBe(first.trackId);
    expect(jumped.continuity).toBe("ACQUIRED");
  });

  it("keeps ambiguous frames ineligible and settles the same selected source after recovery", () => {
    const adapter = new BrowserHandAdapter(binding),
      selector = new ActiveHandSelector();
    selector.update(frame(adapter, 100, 0.5));
    const ready = selector.update(frame(adapter, 350, 0.5));
    expect(ready.eligible).toBe(true);
    for (const at of [400, 550, 700]) {
      expect(selector.update(frame(adapter, at, 0.5, 0.53))).toMatchObject({
        condition: "AMBIGUOUS",
        eligible: false,
        changed: false,
        hand: null,
      });
    }
    expect(selector.update(frame(adapter, 750, 0.5))).toMatchObject({
      condition: "ACQUIRING",
      eligible: false,
      changed: false,
    });
    const recovered = selector.update(frame(adapter, 900, 0.5));
    expect(recovered).toMatchObject({ condition: "READY", eligible: true, changed: false });
    expect(recovered.hand?.trackId).toBe(ready.hand?.trackId);
  });

  it.each([false, true])(
    "drops an absent one-frame newcomer before it can cause a later false tie (reverse=%s)",
    (reverse) => {
      const adapter = new BrowserHandAdapter(binding);
      const first = frame(adapter, 100, 0.35).hands[0];
      const observed = frame(adapter, 200, ...(reverse ? [0.55, 0.35] : [0.35, 0.55]));
      expect(observed.hands).toHaveLength(2);
      const extra = observed.hands.find((hand) => hand.trackId !== first.trackId)!;
      expect(extra.continuity).toBe("ACQUIRED");
      expect(frame(adapter, 250, 0.4).hands[0].trackId).toBe(first.trackId);
      // The old newcomer at .55 would tie the trusted .40 record at .475.
      expect(frame(adapter, 300, 0.475).hands[0]).toMatchObject({
        trackId: first.trackId,
        continuity: "CONTINUOUS",
      });
    },
  );

  it("abstains on an immediate newcomer tie, discards the probation record and recovers the unrefreshed incumbent", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = frame(adapter, 100, 0.4).hands[0];
    frame(adapter, 200, 0.4, 0.6);
    const tie = frame(adapter, 250, 0.5);
    expect(tie.hands[0].continuity).toBe("AMBIGUOUS");
    expect(frame(adapter, 300, 0.45).hands[0]).toMatchObject({ trackId: first.trackId, continuity: "CONTINUOUS" });
  });

  it("establishes a repeatedly observed separate second hand and retires both histories after crossing", () => {
    const adapter = new BrowserHandAdapter(binding);
    const first = frame(adapter, 100, 0.25).hands[0];
    const two = frame(adapter, 200, 0.25, 0.75);
    const second = two.hands[1];
    const confirmed = frame(adapter, 300, 0.25, 0.75);
    expect(confirmed.hands.map((hand) => hand.trackId)).toEqual([first.trackId, second.trackId]);
    expect(frame(adapter, 400, 0.49, 0.51).hands.every((hand) => hand.continuity === "AMBIGUOUS")).toBe(true);
    const separated = frame(adapter, 500, 0.25, 0.75);
    expect(separated.hands.every((hand) => hand.continuity === "ACQUIRED")).toBe(true);
    expect(separated.hands.every((hand) => ![first.trackId, second.trackId].includes(hand.trackId))).toBe(true);
  });

  it("preserves established separate-hand crossing and single-observation tie retirement", () => {
    const adapter = new BrowserHandAdapter(binding);
    const initial = frame(adapter, 100, 0.4, 0.6);
    expect(frame(adapter, 200, 0.5).hands[0].continuity).toBe("AMBIGUOUS");
    const separated = frame(adapter, 300, 0.4, 0.6);
    expect(separated.hands.every((hand) => !initial.hands.some((old) => old.trackId === hand.trackId))).toBe(true);
  });

  it("does not retain a missing probation hand or promote it across absence", () => {
    const adapter = new BrowserHandAdapter(binding);
    frame(adapter, 100, 0.25);
    const second = frame(adapter, 200, 0.25, 0.75).hands[1];
    expect(frame(adapter, 250).hands).toEqual([]);
    const returned = frame(adapter, 300, 0.25, 0.75).hands[1];
    expect(returned.trackId).not.toBe(second.trackId);
    expect(returned.continuity).toBe("ACQUIRED");
  });
});

describe("bounded raw off-image secondary-finger support", () => {
  it("retains only finite nearby raw non-index points while ordinary visibility remains invalid", () => {
    const adapter = new BrowserHandAdapter(binding),
      raw = resultAt(0.5);
    raw.landmarks[0][8] = { x: 0.5, y: 1.05, z: 0.01 };
    raw.landmarks[0][9] = { x: 0.5, y: 1.05, z: 0.02 };
    raw.landmarks[0][10] = { x: 0.6, y: 1.05, z: 0.03 };
    raw.landmarks[0][11] = { x: -0.151, y: 0.5, z: 0.04 };
    raw.landmarks[0][12] = { x: 0.5, y: 1.05, z: NaN };
    const hand = adapter.envelope(raw, 100, 105, 640, 480).hands[0];
    expect(hand.offImageFingerLandmarks).toEqual([{ index: 10, x: 0.6, y: 1.05, z: 0.03 }]);
    for (const index of [8, 9, 10, 11, 12]) expect(hand.landmarks[index]).toEqual({ x: 0, y: 0, z: 0, valid: false });
    expect(hand.occluded).toBe(true);
  });

  it("does not invent auxiliary evidence for normal observed points", () => {
    expect(frame(new BrowserHandAdapter(binding), 100, 0.5).hands[0].offImageFingerLandmarks).toBeUndefined();
  });
});
