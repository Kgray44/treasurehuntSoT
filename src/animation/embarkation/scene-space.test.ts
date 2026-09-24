import { describe, expect, it } from "vitest";
import { buildActors, camera, CUT, materialResponse, poseAt } from "./program";
import { celestialState, EXTERIOR, exteriorWaterPoint, FOG_BANKS, fogBanksAt } from "./scene-space";

describe("Owner correction: physical time, transport and projection", () => {
  it("does not slow early flight when later scenic beats are extended", () => {
    const actor = { ...buildActors(2595989206).find((a) => a.id === "recede-4")!, birth: 7 };
    const ages = [0.1, 0.4, 0.8, 1.5, 3, 5, 8];
    const before = ages.map((age) => materialResponse({ ...actor }, age));
    const saved = { ...CUT };
    try {
      Object.assign(CUT, {
        landscape: 20,
        wonder: 24,
        fogIn: 28,
        fogOpaque: 30,
        fogOut: 33,
        threshold: 33,
        room: 37,
        end: 42,
      });
      // Fresh actor identities force fresh caches: this cannot pass merely
      // because an earlier, correctly timed cache was reused.
      expect(ages.map((age) => materialResponse({ ...actor }, age))).toEqual(before);
    } finally {
      Object.assign(CUT, saved);
    }
  });
  it("continues downstream beyond the fixed cache without a visible parked endpoint", () => {
    for (const material of ["paper", "cloth", "metal"] as const) {
      const actor = { ...buildActors(4)[0], material, birth: 7 };
      const positions = [11.9, 12, 12.1, 14, 18].map((age) => materialResponse(actor, age));
      for (let i = 1; i < positions.length; i++) expect(positions[i][2]).toBeLessThan(positions[i - 1][2]);
      expect(positions[4][2]).toBeLessThan(positions[1][2] - 30000);
    }
  });
  it("loses ordinary debris to optical depth before dense fog and cannot resurrect it during reversal", () => {
    const ordinary = buildActors(2595989206).filter(
      (a) => a.layer === "paper" || (a.layer === "props" && a.hero !== "lantern"),
    );
    for (const time of [24, 25, 27, 28, 29, 30, 31]) {
      for (const a of ordinary) expect(poseAt(a, time, 1536, 1024).alpha).toBeLessThan(0.002);
    }
    const paper = ordinary.find((a) => a.id === "recede-4")!;
    const early = poseAt(paper, paper.birth + 0.3, 1536, 1024);
    expect(early.alpha).toBe(1);
  });
  it("advects real banks from behind the eye, with a growing then dwindling supply", () => {
    for (const bank of FOG_BANKS) {
      const start = fogBanksAt(bank.birth).find((b) => b.id === bank.id)!;
      const next = fogBanksAt(bank.birth + 0.8).find((b) => b.id === bank.id)!;
      expect(start.position[2]).toBeGreaterThan(camera(bank.birth).position[2] + 1150);
      expect(next.position[2]).toBeLessThan(start.position[2] - 4800);
      expect(next.radiusX).toBeGreaterThan(start.radiusX);
      expect(next.gain).toBeLessThan(start.gain);
    }
    expect(FOG_BANKS[20].strength).toBeGreaterThan(FOG_BANKS[0].strength * 10);
    expect(FOG_BANKS.at(-1)!.strength).toBeLessThan(FOG_BANKS[20].strength / 10);
    expect(fogBanksAt(21)).toEqual([]);
  });
  it("keeps all water rays on one surface throughout forward and backward travel", () => {
    for (const [width, height] of [
      [1536, 1024],
      [390, 844],
      [2560, 1080],
    ]) {
      const viewport = [(1100 * width) / height, 1100],
        roomUV = [1, 1, 0, 0];
      const horizon = (EXTERIOR.horizon - 0.5) * viewport[1] + (EXTERIOR.waterHeight * 1150) / (1150 - EXTERIOR.skyZ);
      for (const time of [23.5, 25, 27, 27.6, 28.5, 29.5, 30.8, 31])
        for (const u of [0.03, 0.25, 0.5, 0.75, 0.97])
          for (const v of [0.02, 0.18, 0.4, 0.6]) {
            const result = exteriorWaterPoint(time, [u, v], viewport, roomUV);
            if (!result) continue;
            const p = result.world;
            expect(p[1] + (horizon * p[2]) / 1150 - horizon + EXTERIOR.waterHeight).toBeCloseTo(0, 7);
            if (time === 31) {
              expect(result.sourceUV[0]).toBeCloseTo(u, 10);
              expect(result.sourceUV[1]).toBeCloseTo(v, 10);
            }
          }
    }
  });
  it("reconciles one celestial state continuously, registering exactly at the final artwork", () => {
    const a = celestialState(23.84, 1536, 1024, [1, 1, 0, 0]);
    expect(a.reconciliation).toBe(0);
    let previous = a.position;
    for (let time = 23.85; time < 24.76; time += 0.01) {
      const state = celestialState(time, 1536, 1024, [1, 1, 0, 0]);
      expect(Math.hypot(...state.direction)).toBeCloseTo(1, 10);
      expect(Math.hypot(...state.position.map((v, i) => v - previous[i]))).toBeLessThan(700);
      previous = state.position;
    }
    const arrived = celestialState(31, 1536, 1024, [1, 1, 0, 0]);
    expect(arrived.projected[0]).toBeCloseTo(1167 / 1536, 10);
    expect(arrived.projected[1]).toBeCloseTo(1 - 240 / 1024, 10);
    expect(arrived.reflectionSourceX).toBeCloseTo(1167 / 1536, 10);
  });
});
