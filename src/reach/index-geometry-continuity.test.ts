// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { IndexImageTracker, indexShapeContinues, type IndexModelAnchor } from "./index-image-tracker";

type Chain = NonNullable<IndexModelAnchor["geometry"]>["index"];
const aspect = 0.75;
const binding = {
  providerGeneration: 1,
  cameraLeaseId: "d0-rotating-index",
  cameraFrameVersion: 1,
  frameWidth: 320,
  frameHeight: 240,
  mirrorTransform: "NONE" as const,
};
function anchor(angle: number, source = "same-hand-index", scale = 1, x = 50): IndexModelAnchor {
  const radians = (angle * Math.PI) / 180,
    point = { x: x / 159, y: 40 / 119 };
  const index = [0.18, 0.11, 0.05, 0].map((distance) => ({
    x: point.x,
    y: point.y + (distance * scale * Math.cos(radians)) / aspect,
    z: distance * scale * Math.sin(radians),
  })) as unknown as Chain;
  return {
    point,
    pointing: true,
    contrary: false,
    authority: "POINT",
    authoritySource: source,
    identitySource: source,
    identityObserved: true,
    geometry: { index, palmSpan: 0.12 * scale },
  };
}
function cue(angle: number, source = "same-hand-index"): IndexModelAnchor {
  const full = anchor(angle, source);
  return {
    point: full.point,
    pointing: true,
    contrary: false,
    identitySource: source,
    indexCue: { source, index: full.geometry!.index },
  };
}
function frame(capture: number, texture = false) {
  const data = new Uint8Array(160 * 120).fill(30);
  if (texture)
    for (let dy = -10; dy <= 10; dy++)
      for (let dx = -10; dx <= 10; dx++)
        data[(40 + dy) * 160 + 50 + dx] = 45 + ((dx * 73 + dy * 127 + dx * dy * 19 + 100000) % 135);
  return { data, width: 160, height: 120, capture, received: capture + 5 };
}
const chain = (angle: number, scale = 1) => anchor(angle, "same-hand-index", scale).geometry!.index;

describe("rotation-invariant current index geometry cohorts", () => {
  it("buffers compatible geometry through interspersed valid shape outliers without crediting them", () => {
    const tracker = new IndexImageTracker(binding);
    const outlier = () => {
      const value = anchor(0),
        index = value.geometry!.index;
      index[3].x = index[2].x + Math.sin(Math.PI / 3) * 0.05;
      index[3].y = index[2].y - (Math.cos(Math.PI / 3) * 0.05) / aspect;
      value.point = { x: index[3].x, y: index[3].y };
      return value;
    };
    expect(tracker.update(frame(100), anchor(0)).point).toBeNull();
    expect(tracker.update(frame(133), outlier()).point).toBeNull();
    expect(tracker.update(frame(166), anchor(0)).point).toBeNull();
    expect(tracker.update(frame(200), outlier()).point).toBeNull();
    expect(tracker.update(frame(233), anchor(0))).toMatchObject({ state: "TRACKING", coordinateSource: "MODEL" });
  });
  it.each([0.2, 0.35])("accepts rigid3D rotation and uniform scale at shape budget%s", (budget) => {
    expect(indexShapeContinues(chain(0), chain(40, 1.5), aspect, budget, 60)).toBe(true);
    expect(indexShapeContinues(chain(40), chain(80), aspect, budget, 60)).toBe(true);
    expect(indexShapeContinues(chain(80), chain(120), aspect, budget, 60)).toBe(true);
  });

  it("conditions full-model coordinates through legitimate depth rotation", () => {
    const tracker = new IndexImageTracker(binding);
    expect(tracker.update(frame(100), anchor(0)).point).toBeNull();
    expect(tracker.update(frame(166), anchor(35)).point).toBeNull();
    expect(tracker.update(frame(233), anchor(70))).toMatchObject({ state: "TRACKING", coordinateSource: "MODEL" });
  });

  it("conditions a registered current cropped index through the same rotation", () => {
    const tracker = new IndexImageTracker(binding);
    let selected;
    for (const at of [100, 166, 233]) selected = tracker.update(frame(at, true), anchor(0));
    expect(selected!.state).toBe("TRACKING");
    expect(tracker.update(frame(300), cue(35)).point).toBeNull();
    expect(tracker.update(frame(366), cue(70)).point).toBeNull();
    expect(tracker.update(frame(433), cue(105))).toMatchObject({
      state: "TRACKING",
      coordinateSource: "MODEL",
      modelSupport: "REGISTERED_INDEX",
      trackId: selected!.trackId,
    });
  });

  it("rejects an unobserved large axis flip even though internal shape is unchanged", () => {
    expect(indexShapeContinues(chain(0), chain(85), aspect, 0.35, 60)).toBe(false);
    const tracker = new IndexImageTracker(binding);
    tracker.update(frame(100), anchor(0));
    tracker.update(frame(166), anchor(0));
    expect(tracker.update(frame(233), anchor(85)).point).toBeNull();
  });

  it("rejects a changed distal articulation with otherwise plausible length and motion", () => {
    const wrong = anchor(0),
      index = wrong.geometry!.index.map((p) => ({ ...p })) as unknown as Chain;
    const dip = index[2];
    index[3].x = dip.x + Math.sin(Math.PI / 3) * 0.05;
    index[3].y = dip.y - (Math.cos(Math.PI / 3) * 0.05) / aspect;
    wrong.geometry!.index = index;
    wrong.point = { x: index[3].x, y: index[3].y };
    expect(indexShapeContinues(chain(0), index, aspect, 0.35, 60)).toBe(false);
    const tracker = new IndexImageTracker(binding);
    tracker.update(frame(100), anchor(0));
    tracker.update(frame(166), anchor(0));
    expect(tracker.update(frame(233), wrong).point).toBeNull();
  });

  it("rejects a changed bone-length proportion rather than normalizing it away", () => {
    const changed = chain(0).map((p) => ({ ...p })) as unknown as Chain;
    changed[1].y = changed[0].y - 0.12 / aspect;
    changed[2].y = changed[1].y - 0.03 / aspect;
    expect(indexShapeContinues(chain(0), changed, aspect, 0.35, 60)).toBe(false);
  });

  it("keeps full-index lengths consistent with the observed palm while allowing uniform whole-hand scale", () => {
    expect(indexShapeContinues(chain(0), chain(40, 1.5), aspect, 0.35, 60, { previous: 0.12, current: 0.18 })).toBe(
      true,
    );
    expect(indexShapeContinues(chain(0), chain(40, 0.6), aspect, 0.35, 60, { previous: 0.12, current: 0.12 })).toBe(
      false,
    );
    const tracker = new IndexImageTracker(binding);
    tracker.update(frame(100), anchor(0));
    tracker.update(frame(166), anchor(0));
    const shortened = anchor(35, "same-hand-index", 0.6);
    shortened.geometry!.palmSpan = 0.12;
    expect(tracker.update(frame(233), shortened).point).toBeNull();
  });

  it.each(["NAN", "COLLAPSED"])("rejects%sgeometry without creating a coordinate", (kind) => {
    const wrong = anchor(0);
    if (kind === "NAN") wrong.geometry!.index[2].z = NaN;
    else wrong.geometry!.index = wrong.geometry!.index.map(() => ({ ...wrong.geometry!.index[0] })) as unknown as Chain;
    expect(indexShapeContinues(chain(0), wrong.geometry!.index, aspect, 0.35, 60)).toBe(false);
    const tracker = new IndexImageTracker(binding);
    tracker.update(frame(100), anchor(0));
    tracker.update(frame(166), anchor(0));
    expect(tracker.update(frame(233), wrong).point).toBeNull();
  });

  it.each(["SOURCE", "GAP", "STEP", "SCALE"])("preserves existing%s cohort boundaries", (kind) => {
    const tracker = new IndexImageTracker(binding);
    tracker.update(frame(100), anchor(0));
    tracker.update(frame(166), anchor(0));
    const at = kind === "GAP" ? 417 : 233;
    const current = anchor(
      35,
      kind === "SOURCE" ? "another-hand-index" : "same-hand-index",
      kind === "SCALE" ? 1.8 : 1,
      kind === "STEP" ? 120 : 50,
    );
    expect(tracker.update(frame(at), current).point).toBeNull();
  });

  it("retains but does not count an isolated same-hand invalid frame", () => {
    const tracker = new IndexImageTracker(binding);
    tracker.update(frame(100), anchor(0));
    tracker.update(frame(166), anchor(35));
    expect(
      tracker.update(frame(200), {
        point: null,
        pointing: false,
        contrary: false,
        authority: "AMBIGUOUS",
        authoritySource: "same-hand-index",
        identitySource: "same-hand-index",
      }).point,
    ).toBeNull();
    expect(tracker.update(frame(233), anchor(70))).toMatchObject({ state: "TRACKING", coordinateSource: "MODEL" });
  });

  it.each(["NO_IDENTITY", "OTHER_IDENTITY", "CONTRARY"])("cannot retain positive geometry through%s", (kind) => {
    const tracker = new IndexImageTracker(binding);
    tracker.update(frame(100), anchor(0));
    tracker.update(frame(166), anchor(35));
    const invalid: IndexModelAnchor = {
      point: null,
      pointing: false,
      contrary: kind === "CONTRARY",
      authority: kind === "CONTRARY" ? "CONTRARY" : "AMBIGUOUS",
      authoritySource: "same-hand-index",
    };
    if (kind !== "NO_IDENTITY")
      invalid.identitySource = kind === "OTHER_IDENTITY" ? "another-hand-index" : "same-hand-index";
    expect(tracker.update(frame(200), invalid).point).toBeNull();
    expect(tracker.update(frame(233), anchor(70)).point).toBeNull();
  });
});
