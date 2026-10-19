// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { IndexImageTracker, type IndexModelAnchor } from "./index-image-tracker";
import { selectIndexModelAnchor } from "./hand-detection-authority";
import { syntheticObservation } from "./synthetic";
import { pointingPose } from "../../tests/e2e/fixtures/reach/pointing-poses";

type Chain = NonNullable<IndexModelAnchor["geometry"]>["index"];
const source = "same-observed-hand";
const binding = {
  providerGeneration: 1,
  cameraLeaseId: "synthetic-index-identity-certificate",
  cameraFrameVersion: 1,
  frameWidth: 320,
  frameHeight: 240,
  mirrorTransform: "NONE" as const,
};
function full(angle = 0): IndexModelAnchor {
  const radians = (angle * Math.PI) / 180;
  const index = [0.18, 0.11, 0.05, 0].map((length) => ({
    x: 0.4,
    y: 0.4 + (length * Math.cos(radians)) / 0.75,
    z: length * Math.sin(radians),
  })) as unknown as Chain;
  return {
    point: { x: 0.4, y: 0.4 },
    pointing: true,
    contrary: false,
    authority: "POINT",
    authoritySource: source,
    identitySource: source,
    identityObserved: true,
    geometry: { index, palmSpan: 0.12 },
  };
}
function uncertain(index?: Chain, certificateSource = source): IndexModelAnchor {
  return {
    point: null,
    pointing: false,
    contrary: false,
    authority: "AMBIGUOUS",
    authoritySource: source,
    identitySource: source,
    ...(index ? { indexIdentityGeometry: { source: certificateSource, index } } : {}),
  };
}
function frame(capture: number) {
  return { data: new Uint8Array(160 * 120).fill(30), width: 160, height: 120, capture, received: capture + 1 };
}
function establish(tracker: IndexImageTracker) {
  let selected;
  for (const at of [100, 166, 233]) selected = tracker.update(frame(at), full());
  expect(selected).toMatchObject({ state: "TRACKING", coordinateSource: "MODEL" });
  return selected!;
}

describe("selected-index identity requires current index-specific continuity", () => {
  it("retains index identity from three current observed associated joints without inventing a tip or collecting a point", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker);
    for (let at = 283; at <= 2283; at += 50) {
      const joints = full()
        .geometry!.index.slice(0, 3)
        .map((p, i) => ({ index: i + 5, x: p.x, y: p.y }));
      expect(
        tracker.update(frame(at), {
          ...uncertain(),
          indexIdentityEvidence: { source, associationBasis: "INDEX_CHAIN_V1", joints },
        }),
      ).toMatchObject({ point: null, trackId: first.trackId });
    }
    let returned;
    for (const at of [2333, 2399, 2466]) returned = tracker.update(frame(at), full());
    expect(returned).toMatchObject({ state: "TRACKING", coordinateSource: "MODEL", trackId: first.trackId });
  });
  it.each(["TOO_FEW", "OTHER_SOURCE", "STEP"])("rejects %s observed-index continuity", (kind) => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker);
    for (let at = 283; at <= 2283; at += 50) {
      const joints = full()
        .geometry!.index.slice(0, kind === "TOO_FEW" ? 2 : 3)
        .map((p, i) => ({ index: i + 5, x: p.x + (kind === "STEP" ? 0.5 : 0), y: p.y }));
      tracker.update(frame(at), {
        ...uncertain(),
        indexIdentityEvidence: {
          source: kind === "OTHER_SOURCE" ? "other-hand" : source,
          associationBasis: "INDEX_CHAIN_V1",
          joints,
        },
      });
    }
    for (const at of [2333, 2399, 2466])
      expect(tracker.update(frame(at), full())).toMatchObject({ point: null, trackId: first.trackId });
  });
  it("retains an already registered index through monocular depth changes using explicit current index-chain association", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker);
    for (let at = 283; at <= 2283; at += 50) {
      const index = full((at / 50) % 2 ? 85 : 0).geometry!.index;
      expect(
        tracker.update(frame(at), {
          ...uncertain(index),
          indexIdentityGeometry: { source, index, associationBasis: "INDEX_CHAIN_V1" },
        }),
      ).toMatchObject({ point: null, trackId: first.trackId });
    }
    let returned;
    for (const at of [2333, 2399, 2466]) returned = tracker.update(frame(at), full(85));
    expect(returned).toMatchObject({ state: "TRACKING", coordinateSource: "MODEL", trackId: first.trackId });
  });
  it.each(["OBSERVED_PALM_CONTINUITY_V1", undefined] as const)(
    "cannot substitute %s association for lost selected-index geometry",
    (associationBasis) => {
      const tracker = new IndexImageTracker(binding),
        first = establish(tracker);
      for (let at = 283; at <= 2283; at += 50) {
        const index = full(85).geometry!.index;
        tracker.update(frame(at), { ...uncertain(index), indexIdentityGeometry: { source, index, associationBasis } });
      }
      for (const at of [2333, 2399, 2466])
        expect(tracker.update(frame(at), full())).toMatchObject({ point: null, trackId: first.trackId });
    },
  );
  it("does not resurrect an expired certificate from later index-chain association", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker);
    tracker.update(frame(500), uncertain());
    for (const at of [550, 616, 683, 750]) {
      const current = full();
      current.indexIdentityGeometry = { source, index: current.geometry!.index, associationBasis: "INDEX_CHAIN_V1" };
      expect(tracker.update(frame(at), current)).toMatchObject({ point: null, trackId: first.trackId });
    }
  });
  it("never initializes an index or supplies coordinates from identity-only chain observations", () => {
    const tracker = new IndexImageTracker(binding);
    for (let at = 100; at <= 2100; at += 50)
      expect(tracker.update(frame(at), uncertain(full().geometry!.index))).toMatchObject({
        trackId: null,
        point: null,
      });
  });

  it("keeps a continuously observed rotating index registered through two seconds of gesture uncertainty", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker);
    for (let at = 283; at <= 2283; at += 50) {
      const current = tracker.update(frame(at), uncertain(full(((at - 283) / 50) * 4).geometry!.index));
      expect(current).toMatchObject({ trackId: first.trackId, point: null });
    }
    let returned;
    for (const at of [2333, 2399, 2466]) returned = tracker.update(frame(at), full(160));
    expect(returned).toMatchObject({ state: "TRACKING", coordinateSource: "MODEL", trackId: first.trackId });
  });

  it("retains the same hand identity but cannot resume a point after two seconds of palm-only evidence", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker);
    for (let at = 283; at <= 2283; at += 50)
      expect(tracker.update(frame(at), uncertain())).toMatchObject({ trackId: first.trackId, point: null });
    for (const at of [2333, 2399, 2466, 2533, 2600])
      expect(tracker.update(frame(at), full())).toMatchObject({ trackId: first.trackId, point: null });
  });

  it.each(["SOURCE", "MALFORMED", "STEP", "SHAPE", "TURN"])(
    "cannot renew index permission from %s certificate evidence",
    (kind) => {
      const tracker = new IndexImageTracker(binding),
        first = establish(tracker);
      for (let at = 283; at <= 2283; at += 50) {
        const index = full(kind === "TURN" ? 90 : 0).geometry!.index.map((joint) => ({ ...joint })) as unknown as Chain;
        if (kind === "MALFORMED") index[2].z = NaN;
        if (kind === "STEP") for (const joint of index) joint.x += 0.5;
        if (kind === "SHAPE") {
          index[1].y = index[0].y - 0.12 / 0.75;
          index[2].y = index[1].y - 0.03 / 0.75;
        }
        expect(tracker.update(frame(at), uncertain(index, kind === "SOURCE" ? "other-hand" : source)).point).toBeNull();
      }
      let returned;
      for (const at of [2333, 2399, 2466]) returned = tracker.update(frame(at), full());
      expect(returned).toMatchObject({ point: null, trackId: first.trackId });
    },
  );

  it("holds an isolated valid shape outlier without granting action or renewing its identity certificate", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker);
    const noisy = full().geometry!.index.map((joint) => ({ ...joint })) as unknown as Chain;
    noisy[1].y = noisy[0].y - 0.12 / 0.75;
    noisy[2].y = noisy[1].y - 0.03 / 0.75;
    expect(tracker.update(frame(283), uncertain(noisy))).toMatchObject({ point: null, trackId: first.trackId });
    expect(tracker.update(frame(333), uncertain(full(35).geometry!.index))).toMatchObject({
      point: null,
      trackId: first.trackId,
    });
    let returned;
    for (const at of [383, 449, 516]) returned = tracker.update(frame(at), full(70));
    expect(returned).toMatchObject({ state: "TRACKING", coordinateSource: "MODEL", trackId: first.trackId });
  });

  it("revokes coordinate registration immediately on a known source change, even if the old source soon returns", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker);
    expect(
      tracker.update(frame(283), {
        ...uncertain(full().geometry!.index, "replacement-hand"),
        identitySource: "replacement-hand",
      }),
    ).toMatchObject({ point: null, trackId: first.trackId });
    for (const at of [333, 399, 466])
      expect(tracker.update(frame(at), full())).toMatchObject({ point: null, trackId: first.trackId });
  });

  it.each([250, 251])("preserves the exact bounded index gap at %s ms without changing hand identity", (gap) => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker);
    tracker.update(frame(300), uncertain());
    let returned;
    for (const at of [233 + gap, 299 + gap, 366 + gap]) returned = tracker.update(frame(at), full());
    expect(returned!.trackId).toBe(first.trackId);
    expect(returned!.state === "TRACKING").toBe(gap === 250);
  });

  it("projects current plausible index anatomy separately from gesture eligibility and never fabricates missing joints", () => {
    const current = syntheticObservation({ x: 0.5, y: 0.5 }, 1, 100);
    current.hands[0].continuity = "CONTINUOUS";
    current.hands[0].landmarks = pointingPose();
    const anchor = selectIndexModelAnchor(current)!;
    expect(anchor.indexIdentityGeometry).toEqual({ source: anchor.identitySource, index: anchor.geometry!.index });
    current.hands[0].landmarks[7].valid = false;
    expect(selectIndexModelAnchor(current)).not.toHaveProperty("indexIdentityGeometry");
    current.hands[0].landmarks = pointingPose();
    current.hands[0].continuity = "AMBIGUOUS";
    expect(selectIndexModelAnchor(current)).not.toHaveProperty("indexIdentityGeometry");
    current.hands[0].continuity = "CONTINUOUS";
    current.hands.push({ ...current.hands[0], trackId: "another-physical-hand" });
    expect(selectIndexModelAnchor(current)).not.toHaveProperty("indexIdentityGeometry");
  });
});
