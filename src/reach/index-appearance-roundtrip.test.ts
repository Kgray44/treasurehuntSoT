// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { IndexImageTracker, type IndexGrayFrame, type IndexModelAnchor } from "./index-image-tracker";

type Chain = NonNullable<IndexModelAnchor["geometry"]>["index"];
type AppearanceProof = { appearanceSupportsIndex(frame: IndexGrayFrame, index: Chain, source: string): boolean };
const source = "synthetic-known-index-roundtrip";
const binding = {
  providerGeneration: 1,
  cameraLeaseId: "synthetic-appearance-roundtrip",
  cameraFrameVersion: 1,
  frameWidth: 320,
  frameHeight: 240,
  mirrorTransform: "NONE" as const,
};
const ys = [160, 128, 100, 76];
function geometry(dx = 0, short = false): Chain {
  const values = short ? [124, 118, 112, 106] : ys;
  const joint = (i: number) => ({
    x: (100 + dx) / 319,
    y: values[i] / 239,
    z: short ? (3 - i) * 0.05 : 0,
  });
  return [joint(0), joint(1), joint(2), joint(3)];
}
function pixels(
  at: number,
  dx = 0,
  options: { missingDip?: boolean; short?: boolean; repeatProximalAtDistal?: boolean } = {},
): IndexGrayFrame {
  const data = new Uint8Array(320 * 240).fill(30);
  (options.short ? [124, 118, 112, 106] : ys).forEach((y, joint) => {
    if (joint === 2 && options.missingDip) return;
    for (let v = -9; v <= 9; v++)
      for (let u = -9; u <= 9; u++) {
        const seed = options.repeatProximalAtDistal && joint === 2 ? 0 : joint;
        let value = Math.imul(u + 31, 73856093) ^ Math.imul(v + 31, 19349663) ^ Math.imul(seed + 1, 83492791);
        value ^= value >>> 13;
        data[(y + v) * 320 + 100 + dx + u] = 45 + ((value >>> 0) % 150);
      }
  });
  return { data, width: 320, height: 240, capture: at, received: at + 10 };
}
function established(short = false, repeatProximalAtDistal = false) {
  const tracker = new IndexImageTracker(binding);
  const index = geometry(0, short);
  const model: IndexModelAnchor = {
    point: { x: index[3].x, y: index[3].y },
    pointing: true,
    contrary: false,
    authority: "POINT",
    authoritySource: source,
    identitySource: source,
    identityObserved: true,
    geometry: { index, palmSpan: 0.2 },
  };
  let observation;
  for (const at of [100, 166, 233])
    observation = tracker.update(pixels(at, 0, { short, repeatProximalAtDistal }), model);
  expect(observation).toMatchObject({ state: "TRACKING", coordinateSource: "FUSED" });
  return tracker as unknown as AppearanceProof;
}

describe("previously verified index appearance roundtrip", () => {
  it("roundtrips actual matched material when the current NN joint is four pixels from it", () => {
    const tracker = established();
    // Actual material translates5px; current anatomical prediction translates9px.
    // The four-pixel innovation is inside the existing8px model agreement radius.
    expect(tracker.appearanceSupportsIndex(pixels(300, 5), geometry(9), source)).toBe(true);
  });

  it("does not accept a twelve-pixel NN displacement as a two-pixel optical roundtrip", () => {
    const tracker = established();
    expect(tracker.appearanceSupportsIndex(pixels(300, 5), geometry(17), source)).toBe(false);
  });

  it("does not borrow the old index regions for a foreign source", () => {
    const tracker = established();
    expect(tracker.appearanceSupportsIndex(pixels(300, 5), geometry(9), "other-observed-hand")).toBe(false);
  });

  it("still requires a current DIP match even when two other old regions remain visible", () => {
    const tracker = established();
    expect(tracker.appearanceSupportsIndex(pixels(300, 5, { missingDip: true }), geometry(9), source)).toBe(false);
  });

  it("retains the fifteen-pixel independence requirement for a foreshortened index", () => {
    const tracker = established(true);
    expect(tracker.appearanceSupportsIndex(pixels(300, 5, { short: true }), geometry(9, true), source)).toBe(false);
  });

  it("cannot count one current material patch as two separated old index regions", () => {
    const tracker = established(false, true);
    const prior = pixels(233, 0, { repeatProximalAtDistal: true });
    const current: IndexGrayFrame = { ...pixels(300), data: new Uint8Array(320 * 240).fill(30) };
    // Two genuinely separated prior patches have the same appearance, but
    // both forward matches now converge on the single patch at (105,140).
    for (let v = -9; v <= 9; v++)
      for (let u = -9; u <= 9; u++) current.data[(140 + v) * 320 + 105 + u] = prior.data[(160 + v) * 320 + 100 + u];
    const joint = (y: number, z: number) => ({ x: 105 / 319, y: y / 239, z });
    const inferred: Chain = [joint(148, 0.15), joint(140, 0.1), joint(132, 0.05), joint(124, 0)];
    // NN predictions are16px apart. Actual matched regions are0px apart.
    expect(tracker.appearanceSupportsIndex(current, inferred, source)).toBe(false);
  });
});
