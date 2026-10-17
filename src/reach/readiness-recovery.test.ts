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
it("pauses an imperfect posture frame and immediately resumes established fresh anatomy", () => {
  const selector = readySelector();
  const bad = frame(400);
  bad.hands[0].landmarks[8] = { ...bad.hands[0].landmarks[5] };
  expect(selector.update(bad)).toMatchObject({ eligible: false, changed: false, condition: "POSTURE" });
  expect(selector.update(frame(450))).toMatchObject({ eligible: true, changed: false, condition: "READY" });
});
it("does not starve good evidence when isolated imperfect frames recur during movement", () => {
  const selector = readySelector();
  let goodFrames = 0;
  for (let i = 0; i < 36; i++) {
    const o = frame(400 + i * 50);
    const bad = i % 3 === 0;
    if (bad) o.hands[0].landmarks[8] = { ...o.hands[0].landmarks[5] };
    const ready = selector.update(o);
    expect(ready.changed).toBe(false);
    expect(ready.eligible).toBe(!bad);
    if (!bad) ++goodFrames;
  }
  expect(goodFrames).toBe(24);
});
it("never samples an invalid landmark frame while preserving brief framing recovery", () => {
  const selector = readySelector();
  const partial = frame(400);
  partial.hands[0].landmarks[8].valid = false;
  expect(selector.update(partial)).toMatchObject({ eligible: false, changed: false, condition: "FRAMING" });
  expect(selector.update(frame(450))).toMatchObject({ eligible: true, changed: false, condition: "READY" });
});
it("requires settling after sustained ineligibility rather than extending a soft pause indefinitely", () => {
  const selector = readySelector();
  for (const at of [400, 450, 500, 550, 600]) {
    const bad = frame(at);
    bad.hands[0].landmarks[8] = { ...bad.hands[0].landmarks[5] };
    expect(selector.update(bad)).toMatchObject({ eligible: false, changed: false });
  }
  expect(selector.update(frame(650))).toMatchObject({ eligible: false, changed: false, condition: "ACQUIRING" });
  expect(selector.update(frame(750)).eligible).toBe(false);
  expect(selector.update(frame(800))).toMatchObject({ eligible: true, changed: false });
});
it.each([
  [179, true],
  [180, false],
] as const)("bounds a soft posture interruption to less than 180ms (%s)", (duration, eligible) => {
  const selector = readySelector();
  const bad = frame(400);
  bad.hands[0].landmarks[8] = { ...bad.hands[0].landmarks[5] };
  selector.update(bad);
  expect(selector.update(frame(400 + duration))).toMatchObject({ eligible, changed: false });
});
it("does not borrow established readiness while acquiring a first eligible posture", () => {
  const selector = new ActiveHandSelector();
  selector.update(frame(100));
  const bad = frame(350);
  bad.hands[0].landmarks[8] = { ...bad.hands[0].landmarks[5] };
  expect(selector.update(bad).eligible).toBe(false);
  expect(selector.update(frame(400))).toMatchObject({ eligible: false, condition: "ACQUIRING" });
  expect(selector.update(frame(550))).toMatchObject({ eligible: true, changed: false });
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
