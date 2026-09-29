import { describe, expect, it } from "vitest";
import {
  buildActors,
  CUT,
  DURATION,
  camera,
  entryDuration,
  gust,
  focusPose,
  stormEnergy,
  materialResponse,
  poseAt,
  seedFor,
  welcome,
  wind,
  TITLE_TURN,
} from "./program";
import { rotateEuler } from "./projection";

describe("Embarkation authored scene contract", () => {
  it("keeps the opening title face readable and resolves its type at one brief edge-on turn", () => {
    for (let time = 0.45; time <= 4.4; time += 0.025) {
      const pose = focusPose(time, 1280, 720);
      expect(rotateEuler([0, 0, 1], pose.rotation)[2]).toBeGreaterThan(0.96);
      expect(Math.abs(pose.rotation[2])).toBeLessThan(0.11);
      expect(pose.bend).toBeLessThanOrEqual(0.25);
    }
    const edge = focusPose(TITLE_TURN.edge, 1280, 720);
    expect(rotateEuler([0, 0, 1], edge.rotation)[2]).toBeCloseTo(0, 10);
    expect(edge.bend).toBe(0);
    for (const time of [TITLE_TURN.edge - 0.001, TITLE_TURN.edge + 0.001]) {
      const pose = focusPose(time, 1280, 720);
      expect(Math.hypot(...pose.position.map((v, i) => v - edge.position[i]))).toBeLessThan(1);
      expect(rotateEuler([0, 0, 1], pose.rotation)[2]).toBeGreaterThan(0);
    }
    expect(rotateEuler([0, 0, 1], focusPose(TITLE_TURN.end, 1280, 720).rotation)[2]).toBeGreaterThan(0.99);
  });
  it("reproduces arbitrary seek order and per-Voyage identity without frame-count state", () => {
    const representative = () => buildActors(seedFor("voyage-a")).filter((a, i) => a.hero || i % 97 === 0);
    const actors = representative();
    const t = [1.5, 3, 5, 7.2, 10, 12.15, 14.5, 18, 22.5, 24.5, 28.5, 32.5, 35.8];
    const first = t.map((time) => actors.map((a) => poseAt(a, time, 1536, 1024)));
    const second = t
      .toReversed()
      .map((time) => representative().map((a) => poseAt(a, time, 1536, 1024)))
      .reverse();
    expect(second).toEqual(first);
    expect(buildActors(seedFor("voyage-b"))).not.toEqual(actors);
    for (const poses of first)
      for (const p of poses) expect([...p.position, ...p.rotation, p.alpha, p.bend].every(Number.isFinite)).toBe(true);
  });
  it("keeps the field dominated by small receding material and reserves authored close passes", () => {
    const props = buildActors(123).filter((a) => a.id.startsWith("recede-") || a.hero || a.id.startsWith("eddy-"));
    expect(props.filter((a) => a.id.startsWith("recede-")).length / props.length).toBeGreaterThanOrEqual(0.75);
    expect(props.filter((a) => a.hero === "map")).toHaveLength(1);
    expect(props.some((a) => a.hero === "rope")).toBe(false);
    for (const a of props.filter((a) => a.id.startsWith("recede-")))
      expect(materialResponse(a, a.life * 0.9)[2]).toBeLessThan(-3000);
  });
  it("entrains high area paper faster than a heavy metal prop", () => {
    const a = { ...buildActors(123)[0], position: [0, 0, 0] as [number, number, number], birth: 11 };
    const paper = materialResponse({ ...a, material: "paper" }, 1),
      metal = materialResponse({ ...a, material: "metal" }, 1);
    expect(paper[2]).toBeLessThan(metal[2] - 900);
  });
  it("starts every loose actor behind the eye and physically removes the focus", () => {
    for (const a of buildActors(123).filter((a) => a.hero !== "lantern")) {
      expect(poseAt(a, a.birth, 1600, 1000).position[2]).toBeGreaterThan(camera(a.birth).position[2] + 1150);
    }
    expect(focusPose(18.5, 1600, 1000).alpha).toBe(1);
    expect(focusPose(30.6, 1600, 1000).position[2]).toBeLessThan(-70000);
  });
  it("crests before destination discovery and decays into shelter", () => {
    const crest = Array.from({ length: 250 }, (_, i) => i / 10).sort((a, b) => gust(b) - gust(a))[0];
    expect(crest).toBeGreaterThanOrEqual(11.5);
    expect(crest).toBeLessThanOrEqual(13);
    expect(stormEnergy(19)).toBeLessThan(stormEnergy(12) * 0.2);
    expect(gust(21)).toBeGreaterThan(0);
    expect(gust(CUT.still)).toBe(0);
    expect(wind(7, [200, 100, -1000], 0)).toEqual(wind(7, [200, 100, -1000], 4));
  });
  it("removes transitional material and camera motion for the final stillness", () => {
    expect(gust(CUT.still)).toBe(0);
    expect(camera(CUT.still)).toEqual({ position: [0, 0, 0], roll: 0 });
    expect(camera(DURATION)).toEqual(camera(CUT.still));
    expect(buildActors(123).every((a) => poseAt(a, DURATION, 390, 844).alpha === 0)).toBe(true);
  });
  it("travels forward through the crossing then backs into a stationary room without turning", () => {
    const forward = [0, 4, 10, 12, 16, 22, 27].map((t) => camera(t).position[2]);
    for (let i = 1; i < forward.length; i++) expect(forward[i]).toBeLessThanOrEqual(forward[i - 1]);
    expect(forward.at(-1)).toBeLessThan(-3500);
    const backward = [27, 28, 29, 30, 31].map((t) => camera(t).position[2]);
    for (let i = 1; i < backward.length; i++) expect(backward[i]).toBeGreaterThan(backward[i - 1]);
    expect(camera(31)).toEqual(camera(DURATION));
    expect(Math.abs(camera(30.9).position[2] - camera(31).position[2])).toBeLessThan(1);
  });
  it("drives mist and spray away with the dominant rear-origin wind", () => {
    const flow = wind(8, [500, 100, -1000]);
    expect(-flow[2]).toBeGreaterThan(Math.hypot(flow[0], flow[1]) * 3);
    for (const a of buildActors(123).filter(
      (a) => (a.layer === "mist" || a.layer === "spray") && a.birth > 4 && a.birth < 11,
    )) {
      const aTime = a.birth + 0.25,
        bTime = a.birth + 1.2;
      const early = poseAt(a, aTime, 1536, 1024).position[2] - camera(aTime).position[2];
      const later = poseAt(a, bTime, 1536, 1024).position[2] - camera(bTime).position[2];
      expect(later).toBeLessThan(early - 1100);
    }
  });
  it("keeps first/replay pacing, return pacing, and registered/guest welcome distinct", () => {
    expect(entryDuration(false, false, false)).toBe(35.8);
    expect(entryDuration(true, true, false)).toBe(35.8);
    expect(entryDuration(true, false, false)).toBe(2);
    expect(entryDuration(false, true, true)).toBe(1.8);
    expect(welcome({ registered: true, displayName: "Lina" }, true)).toBe("WELCOME, LINA");
    expect(welcome({ registered: false, displayName: "Guest 482" }, false)).toBe("WELCOME ABOARD");
  });
});
