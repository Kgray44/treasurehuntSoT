// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { expect, it } from "vitest";
import { ActiveHandSelector } from "./observation";
import { syntheticObservation } from "./synthetic";

const frame = (at: number) => syntheticObservation({ x: 0.5, y: 0.5 }, Math.round(at), at);
function readySelector() {
  const selector = new ActiveHandSelector();
  selector.update(frame(100));
  expect(selector.update(frame(350))).toMatchObject({ eligible: true, changed: false });
  return selector;
}
it("pauses on one imperfect posture frame and settles fresh anatomy without changing identity", () => {
  const selector = readySelector();
  const bad = frame(400);
  bad.hands[0].landmarks[8] = { ...bad.hands[0].landmarks[5] };
  expect(selector.update(bad)).toMatchObject({ eligible: false, changed: false, condition: "POSTURE" });
  expect(selector.update(frame(450))).toMatchObject({ eligible: false, changed: false, condition: "ACQUIRING" });
  expect(selector.update(frame(550)).eligible).toBe(false);
  expect(selector.update(frame(600))).toMatchObject({ eligible: true, changed: false });
});
it("retains setup identity through brief loss but never samples absent or unsettled hands", () => {
  const selector = readySelector();
  const absent = frame(500);
  absent.hands = [];
  absent.reason = "NO_HAND";
  expect(selector.update(absent)).toMatchObject({
    eligible: false,
    changed: false,
    hand: null,
    condition: "RECOVERING",
  });
  expect(selector.update(frame(1000))).toMatchObject({ eligible: false, changed: false });
  expect(selector.update(frame(1150))).toMatchObject({ eligible: true, changed: false });
});
it("settles after a silent capture gap even without an explicit absent-hand observation", () => {
  const selector = readySelector();
  expect(selector.update(frame(1000))).toMatchObject({ eligible: false, changed: false, condition: "ACQUIRING" });
  expect(selector.update(frame(1100)).eligible).toBe(false);
  expect(selector.update(frame(1150))).toMatchObject({ eligible: true, changed: false });
});
it("pauses an ambiguous frame without declaring a new hand or reusing its landmarks", () => {
  const selector = readySelector();
  const ambiguous = frame(400);
  ambiguous.hands[0].continuity = "AMBIGUOUS";
  expect(selector.update(ambiguous)).toMatchObject({
    eligible: false,
    changed: false,
    hand: null,
    condition: "AMBIGUOUS",
  });
  expect(selector.update(frame(450)).eligible).toBe(false);
  expect(selector.update(frame(600))).toMatchObject({ eligible: true, changed: false });
});
it("invalidates a confirmed replacement generation rather than transferring old samples", () => {
  const selector = readySelector();
  const replacement = (at: number) => {
    const o = frame(at);
    o.hands[0].trackGeneration = 2;
    o.hands[0].trackId = "replacement";
    return o;
  };
  expect(selector.update(replacement(400))).toMatchObject({ eligible: false, changed: false });
  expect(selector.update(replacement(1600))).toMatchObject({ eligible: false, changed: false });
  expect(selector.update(replacement(1900))).toMatchObject({ changed: true, hand: { trackId: "replacement" } });
});
it.each(["providerGeneration", "cameraFrameVersion"] as const)(
  "immediately invalidates a changed %s context",
  (key) => {
    const selector = readySelector();
    expect(selector.update({ ...frame(400), [key]: 2 })).toMatchObject({ eligible: false, changed: true });
  },
);
it("rejects an interrupted provider reason even when landmarks are populated", () => {
  const selector = readySelector();
  expect(selector.update({ ...frame(400), reason: "INTERRUPTED" })).toMatchObject({ eligible: false, changed: false });
});
