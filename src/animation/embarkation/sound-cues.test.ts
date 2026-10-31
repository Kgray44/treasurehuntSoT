import { describe, expect, it } from "vitest";
import { SoundCueCursor, synthesizeFoley, type SoundCue } from "./sound-cues";
const cue: SoundCue = {
  id: "measured-contact",
  time: 4,
  duration: 0.4,
  kind: "paper-contact",
  energy: 0.5,
  pan: [-0.4, 0.2],
  source: "test contact",
};
describe("Physical sound transport", () => {
  it("schedules once with audio-clock lookahead and does not replay expired impacts after a long frame", () => {
    const cursor = new SoundCueCursor();
    cursor.replace([cue]);
    expect(cursor.advance(3.8, true).start).toEqual([]);
    const start = cursor.advance(3.95, true).start;
    expect(start).toHaveLength(1);
    expect(start[0].delay).toBeCloseTo(0.05);
    expect(start[0].offset).toBe(0);
    for (const t of [3.99, 4, 4.1, 4.39, 6]) expect(cursor.advance(t, true).start).toEqual([]);
    cursor.reset();
    expect(cursor.advance(7, true).start).toEqual([]);
  });
  it("cancels on pause and resumes only the remaining physical tail", () => {
    const cursor = new SoundCueCursor();
    cursor.replace([cue]);
    cursor.advance(4.02, true);
    expect(cursor.advance(4.2, false)).toEqual({ reset: true, start: [] });
    const resumed = cursor.advance(4.2, true);
    expect(resumed.reset).toBe(true);
    expect(resumed.start[0].offset).toBeCloseTo(0.2);
    cursor.advance(4.5, false);
    expect(cursor.advance(4.5, true).start).toEqual([]);
  });
  it("reconstructs offsets at speed changes and allows a deliberate rewind/replay", () => {
    const cursor = new SoundCueCursor();
    cursor.replace([cue]);
    cursor.advance(4.02, true);
    const slower = cursor.advance(4.1, true, 0.25);
    expect(slower.reset).toBe(true);
    expect(slower.start[0].offset).toBeCloseTo(0.1);
    cursor.advance(6, true, 0.25);
    const replay = cursor.advance(3.98, true, 0.25);
    expect(replay.reset).toBe(true);
    expect(replay.start[0].delay).toBeCloseTo(0.08);
    expect(cursor.advance(3.99, true, 0.25).start).toEqual([]);
  });
  it("rejects duplicate identities rather than double-triggering the same anchor", () => {
    const cursor = new SoundCueCursor();
    expect(() => cursor.replace([cue, cue])).toThrow("Duplicate");
    expect(() => cursor.replace([{ ...cue, duration: 0 }])).toThrow("Invalid");
  });
  it("produces bounded seeded material transients with silent endpoints and distinct spectra", () => {
    const render = (kind: SoundCue["kind"]) => synthesizeFoley({ ...cue, kind }, 67, 48000);
    const paper = render("paper-contact"),
      heavy = render("anchor-heavy");
    expect(render("paper-contact")).toEqual(paper);
    expect(synthesizeFoley({ ...cue, id: "another-contact" }, 67, 48000)).not.toEqual(paper);
    for (const samples of [paper, heavy, render("wet-hit"), render("paper-pass"), render("cloth-release")]) {
      expect(Math.abs(samples[0])).toBe(0);
      expect(Math.abs(samples.at(-1)!)).toBeLessThan(0.0001);
      const rms = Math.sqrt(samples.reduce((s, v) => s + v * v, 0) / samples.length);
      expect(rms).toBeGreaterThan(0.006);
      expect(rms).toBeLessThan(0.3);
      expect(samples.every((v) => Number.isFinite(v) && Math.abs(v) < 0.8)).toBe(true);
    }
    const crossings = (a: Float32Array) => a.reduce((s, v, i) => s + (i && v * a[i - 1] < 0 ? 1 : 0), 0);
    expect(crossings(paper)).toBeGreaterThan(crossings(heavy));
  });
});
