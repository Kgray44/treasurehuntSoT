import { describe, expect, it } from "vitest";
import { createSpatialDraft, draftSchema } from "./authoring";
import { createMotionTrack } from "./animation-authoring";
import { evaluateSpatialScene, sampleAnimationTrack } from "./behavior";
import { materializeSpatialVersion } from "./publication";
function scene() {
  const draft = createSpatialDraft("cinematic");
  const id = draft.content.entities[0].id;
  const next = createMotionTrack(draft, id, "POSITION", 0);
  next.content.studio!.animationTracks![0].interpolation = "CINEMATIC";
  return { draft: draftSchema.parse(next), id };
}
describe("canonical cinematic motion", () => {
  it("eases, bends lightly and settles at exact endpoints without altering saved content", () => {
    const { draft, id } = scene(),
      original = structuredClone(draft),
      track = draft.content.studio!.animationTracks![0];
    const start = evaluateSpatialScene(draft.content, [], 0).states[id].transform;
    const end = evaluateSpatialScene(draft.content, [], 2000).states[id].transform;
    expect(start.position).toEqual(track.keyframes[0].value);
    expect(end.position).toEqual(track.keyframes[1].value);
    expect(start.rotation).toEqual(draft.content.entities[0].transform.rotation);
    expect(end.rotation).toEqual(start.rotation);
    const early = evaluateSpatialScene(draft.content, [], 200).states[id].transform;
    expect(early.position.x - start.position.x).toBeLessThan(0.025);
    const middle = evaluateSpatialScene(draft.content, [], 900).states[id].transform;
    expect(middle.position.y).toBeGreaterThan(start.position.y);
    expect(middle.position.y - start.position.y).toBeLessThanOrEqual(0.03);
    expect(Math.hypot(...Object.values(middle.rotation))).toBeCloseTo(1, 10);
    expect(draft).toEqual(original);
    expect(evaluateSpatialScene(draft.content, [], 900, true).states[id].transform).toEqual(
      original.content.entities[0].transform,
    );
    expect(materializeSpatialVersion(draft.content).studio!.animationTracks![0].interpolation).toBe("CINEMATIC");
  });
  it("varies by take but remains deterministic across scrub direction and evaluation frequency", () => {
    const { draft, id } = scene();
    const read = (take: number) => evaluateSpatialScene(draft.content, [], 850, false, { take }).states[id].transform;
    const first = read(1);
    evaluateSpatialScene(draft.content, [], 1700, false, { take: 1 });
    expect(read(1)).toEqual(first);
    expect(read(2)).not.toEqual(first);
    expect(read(2).position.x).toBe(first.position.x);
  });
  it("honors reduced motion, keeps stationary poses still and does not flutter wall text", () => {
    const { draft, id } = scene(),
      track = draft.content.studio!.animationTracks![0];
    const reduced = evaluateSpatialScene(draft.content, [], 800, false, { motion: "reduced" }).states[id].transform;
    expect(reduced.rotation).toEqual(draft.content.entities[0].transform.rotation);
    expect(reduced.position.y).toBe(draft.content.entities[0].transform.position.y);
    draft.content.entities[0].kind = "TEXT";
    expect(evaluateSpatialScene(draft.content, [], 800).states[id].transform).toEqual(reduced);
    track.keyframes[1].value = structuredClone(track.keyframes[0].value);
    expect(evaluateSpatialScene(draft.content, [], 800).states[id].transform.position).toEqual(
      track.keyframes[0].value,
    );
  });
  it("keeps scalar fades and scale bounded, and visibility remains explicitly instantaneous", () => {
    const { draft, id } = scene();
    const next = createMotionTrack(draft, id, "OPACITY", 0);
    const track = next.content.studio!.animationTracks!.find((t) => t.property === "OPACITY")!;
    track.interpolation = "CINEMATIC";
    for (let t = 0; t <= 2000; t += 17) {
      const value = sampleAnimationTrack(track, t)!.value as number;
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    const visibility = createMotionTrack(next, id, "VISIBILITY", 0).content.studio!.animationTracks!.find(
      (t) => t.property === "VISIBILITY",
    )!;
    expect(visibility.interpolation).toBe("STEP");
  });
});
