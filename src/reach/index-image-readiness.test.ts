// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { indexImageAlgorithm, type IndexImageObservation } from "./index-image-tracker";
import { IndexImageReadiness } from "./index-image-readiness";

function frame(capture: number, change: Partial<IndexImageObservation> = {}): IndexImageObservation {
  return {
    observationVersion: 1,
    providerId: indexImageAlgorithm.providerId,
    providerVersion: indexImageAlgorithm.providerVersion,
    algorithmDigest: indexImageAlgorithm.algorithmDigest,
    providerGeneration: 1,
    cameraLeaseId: "test-camera",
    cameraFrameVersion: 1,
    frameWidth: 640,
    frameHeight: 480,
    orientation: 0,
    mirrorTransform: "NONE",
    sequence: capture,
    monotonicCaptureTime: capture,
    monotonicInferenceTime: capture + 5,
    trackId: "image-tip-1",
    trackGeneration: 1,
    point: { x: 0.4, y: 0.6 },
    state: "TRACKING",
    modelAgreement: "UNAVAILABLE",
    anchorSource: "MANUAL_HINT",
    quality: { correlation: null, separation: null, texture: null, forwardBackwardErrorPixels: null },
    uncertaintyRadiusPixels: null,
    reason: "TEST",
    ...change,
  };
}
function establish(selector: IndexImageReadiness, change: Partial<IndexImageObservation> = {}) {
  for (let at = 0; at < 250; at += 50) selector.update(frame(at, change));
  return selector.update(frame(250, change));
}

describe("image-tip readiness", () => {
  it("requires 250ms initial image tracking without a fresh 3D-model agreement", () => {
    const selector = new IndexImageReadiness();
    expect(selector.update(frame(0))).toMatchObject({ eligible: false, changed: false, condition: "ACQUIRING" });
    selector.update(frame(50));
    expect(selector.update(frame(100)).eligible).toBe(false);
    selector.update(frame(150));
    selector.update(frame(200));
    expect(selector.update(frame(249)).eligible).toBe(false);
    const observation = frame(250);
    const ready = selector.update(observation);
    expect(ready).toMatchObject({ eligible: true, changed: false, condition: "READY" });
    expect(ready.observation).toBe(observation);
    expect(ready.guidance).toContain("relative");
  });

  it("caps each fresh frame at 50ms and never credits a long missing interval", () => {
    const selector = new IndexImageReadiness();
    selector.update(frame(0));
    expect(selector.update(frame(5000)).eligible).toBe(false);
    for (let at = 5050; at < 5250; at += 50) expect(selector.update(frame(at)).eligible).toBe(false);
    expect(selector.update(frame(5250))).toMatchObject({ eligible: true, changed: false });
  });

  it.each(["UNSEEDED", "UNCERTAIN", "LOST"] as const)(
    "pauses %s immediately without invalidating an established identity",
    (state) => {
      const selector = new IndexImageReadiness();
      expect(establish(selector).eligible).toBe(true);
      const paused = selector.update(frame(300, { state, point: null, trackId: null, trackGeneration: 0 }));
      expect(paused).toMatchObject({ eligible: false, changed: false, condition: state });
      expect(selector.update(frame(400))).toMatchObject({ eligible: false, changed: false, condition: "RECOVERING" });
      selector.update(frame(450));
      selector.update(frame(500));
      expect(selector.update(frame(519)).eligible).toBe(false);
      expect(selector.update(frame(520))).toMatchObject({ eligible: true, changed: false, condition: "READY" });
    },
  );

  it("also pauses a null tracking point, then recovers naturally", () => {
    const selector = new IndexImageReadiness();
    establish(selector);
    expect(selector.update(frame(300, { point: null }))).toMatchObject({
      eligible: false,
      changed: false,
      condition: "UNCERTAIN",
    });
    selector.update(frame(350));
    selector.update(frame(400));
    selector.update(frame(450));
    expect(selector.update(frame(470))).toMatchObject({ eligible: true, changed: false });
  });

  it("does not credit bad frames or allow their timestamps to poison later recovery", () => {
    const selector = new IndexImageReadiness();
    establish(selector);
    selector.update(frame(300, { state: "UNCERTAIN", point: null }));
    selector.update(frame(400));
    expect(selector.update(frame(450)).eligible).toBe(false);
    selector.update(frame(500, { state: "LOST", point: null }));
    selector.update(frame(10000, { state: "LOST", point: null }));
    expect(selector.update(frame(10100)).eligible).toBe(false);
    selector.update(frame(10150));
    selector.update(frame(10200));
    expect(selector.update(frame(10219)).eligible).toBe(false);
    expect(selector.update(frame(10220))).toMatchObject({ eligible: true, changed: false });
  });

  it("buffers recent good acquisition frames across an isolated bad frame without crediting that frame", () => {
    const selector = new IndexImageReadiness();
    for (let at = 0; at <= 200; at += 50) selector.update(frame(at));
    selector.update(frame(210, { state: "UNCERTAIN", point: null }));
    expect(selector.update(frame(300))).toMatchObject({ eligible: true, changed: false });
  });

  it("reports a change only after a genuinely different nonnull track settles", () => {
    const selector = new IndexImageReadiness();
    establish(selector);
    const other = { trackId: "image-tip-2", trackGeneration: 2 };
    expect(selector.update(frame(300, other))).toMatchObject({ eligible: false, changed: false });
    for (let at = 350; at < 500; at += 50) selector.update(frame(at, other));
    expect(selector.update(frame(500, other))).toMatchObject({ eligible: false, changed: false });
    expect(selector.update(frame(550, other))).toMatchObject({ eligible: true, changed: true });
    expect(selector.update(frame(600, other))).toMatchObject({ eligible: true, changed: false });
  });

  it("preserves the established identity through an incidental new-track hypothesis", () => {
    const selector = new IndexImageReadiness();
    establish(selector);
    expect(selector.update(frame(300, { trackId: "incidental-tip" })).changed).toBe(false);
    expect(selector.update(frame(400))).toMatchObject({ eligible: false, changed: false, condition: "RECOVERING" });
    selector.update(frame(450));
    selector.update(frame(500));
    expect(selector.update(frame(520))).toMatchObject({ eligible: true, changed: false });
  });

  it("includes every source, camera and frame component in the established identity", () => {
    const changes: Partial<IndexImageObservation>[] = [
      { algorithmDigest: "d".repeat(64) },
      { providerGeneration: 2 },
      { cameraLeaseId: "other-camera" },
      { cameraFrameVersion: 2 },
      { frameWidth: 1280 },
      { frameHeight: 720 },
      { mirrorTransform: "PREVIEW_X" },
      { trackGeneration: 2 },
    ];
    for (const change of changes) {
      const selector = new IndexImageReadiness();
      establish(selector);
      expect(selector.update(frame(300, change))).toMatchObject({ eligible: false, changed: false });
      for (let at = 350; at < 550; at += 50) selector.update(frame(at, change));
      expect(selector.update(frame(550, change))).toMatchObject({ eligible: true, changed: true });
    }
  });

  it("never treats missing LOST identities or unconfirmed source changes as setup invalidation", () => {
    const selector = new IndexImageReadiness();
    establish(selector);
    const unknown = {
      state: "LOST" as const,
      point: null,
      trackId: null,
      trackGeneration: 0,
      cameraLeaseId: "other-camera",
    };
    expect(selector.update(frame(300, unknown))).toMatchObject({ eligible: false, changed: false });
    expect(selector.update(frame(10000, unknown))).toMatchObject({ eligible: false, changed: false });
    selector.update(frame(10100));
    selector.update(frame(10150));
    selector.update(frame(10200));
    expect(selector.update(frame(10220))).toMatchObject({ eligible: true, changed: false });
  });

  it("reset discards all readiness and identity so a fresh session settles independently", () => {
    const selector = new IndexImageReadiness();
    establish(selector);
    selector.reset();
    expect(selector.update(frame(300, { trackId: "new-session" }))).toMatchObject({ eligible: false, changed: false });
    for (let at = 350; at < 550; at += 50) selector.update(frame(at, { trackId: "new-session" }));
    expect(selector.update(frame(550, { trackId: "new-session" }))).toMatchObject({ eligible: true, changed: false });
  });

  it("pause preserves an established identity but requires fresh recovery evidence", () => {
    const selector = new IndexImageReadiness();
    establish(selector);
    selector.pause();
    selector.pause();
    expect(selector.update(frame(300))).toMatchObject({ eligible: false, changed: false, condition: "RECOVERING" });
    selector.update(frame(350));
    selector.update(frame(400));
    expect(selector.update(frame(419)).eligible).toBe(false);
    expect(selector.update(frame(420))).toMatchObject({ eligible: true, changed: false });
  });

  it.each([30, 80])(
    "can settle and recover through alternating good/bad %dms frames without making bad frames eligible",
    (spacing) => {
      const selector = new IndexImageReadiness();
      let initialReadyAt = -1;
      for (let i = 0; i < 20; i++) {
        const at = i * spacing * 2;
        const good = selector.update(frame(at));
        expect(good.changed).toBe(false);
        expect(selector.update(frame(at + spacing, { state: "UNCERTAIN", point: null })).eligible).toBe(false);
        if (good.eligible) {
          initialReadyAt = at;
          break;
        }
      }
      expect(initialReadyAt).toBeGreaterThanOrEqual(250);
      let recovered = false;
      for (let i = 1; i < 20; i++) {
        const at = initialReadyAt + i * spacing * 2;
        const good = selector.update(frame(at));
        expect(good.changed).toBe(false);
        expect(selector.update(frame(at + spacing, { state: "LOST", point: null })).eligible).toBe(false);
        if (good.eligible) {
          recovered = true;
          break;
        }
      }
      expect(recovered).toBe(true);
    },
  );

  it("expires partial recovery evidence after a long loss without invalidating the established track", () => {
    const selector = new IndexImageReadiness();
    establish(selector);
    selector.update(frame(300, { state: "UNCERTAIN", point: null }));
    selector.update(frame(350));
    selector.update(frame(400));
    expect(selector.update(frame(450)).eligible).toBe(false);
    selector.update(frame(10000, { state: "LOST", point: null }));
    expect(selector.update(frame(10050))).toMatchObject({ eligible: false, changed: false });
    selector.update(frame(10100));
    selector.update(frame(10150));
    expect(selector.update(frame(10169)).eligible).toBe(false);
    expect(selector.update(frame(10170))).toMatchObject({ eligible: true, changed: false });
  });

  it("never accumulates sparse momentary good frames indefinitely outside the rolling evidence window", () => {
    const selector = new IndexImageReadiness();
    selector.update(frame(0));
    for (let i = 1; i <= 300; i++) {
      selector.update(frame(i * 200 - 1, { state: "UNCERTAIN", point: null }));
      expect(selector.update(frame(i * 200)).eligible).toBe(false);
    }
  });

  it("a silent long gap requires recovery rather than granting readiness from elapsed time", () => {
    const selector = new IndexImageReadiness();
    establish(selector);
    expect(selector.update(frame(10000))).toMatchObject({ eligible: false, changed: false, condition: "RECOVERING" });
    selector.update(frame(10050));
    selector.update(frame(10100));
    expect(selector.update(frame(10119)).eligible).toBe(false);
    expect(selector.update(frame(10120))).toMatchObject({ eligible: true, changed: false });
  });
});

it.each([
  ["FULL_HAND_POINT_PENDING", "image remains tracked"],
  ["FULL_HAND_CONTRARY", "not pointing"],
  ["FULL_HAND_CONTRARY_PENDING", "dashed ring"],
  ["FULL_HAND_CONTRARY_CONFIRMED", "not pointing"],
  ["FULL_HAND_CONTRARY_AWAITING_POINT", "fresh setup"],
  ["FULL_HAND_AMBIGUOUS", "one pointing hand"],
  ["FULL_HAND_INDEX_CONFLICT", "will not jump"],
])("explains %s while preserving the established image source", (reason, expected) => {
  const selector = new IndexImageReadiness();
  expect(establish(selector).eligible).toBe(true);
  const paused = selector.update(
    frame(300, { state: "UNCERTAIN", point: null, matchedPoint: { x: 0.4, y: 0.6 }, reason }),
  );
  expect(paused).toMatchObject({ eligible: false, changed: false, condition: "UNCERTAIN" });
  expect(paused.guidance).toContain(expected);
  selector.update(frame(350));
  selector.update(frame(400));
  selector.update(frame(450));
  expect(selector.update(frame(470))).toMatchObject({ eligible: true, changed: false, condition: "READY" });
});
