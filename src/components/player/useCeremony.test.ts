import { describe, expect, it } from "vitest";
import { ceremonyStages, getCeremonyStages } from "./useCeremony";
describe("ceremony plan", () => {
  it("keeps the full ordered theatrical sequence", () => {
    expect(getCeremonyStages(false)).toEqual(ceremonyStages);
    expect(ceremonyStages.at(-1)).toBe("active");
  });
  it("uses a brief but complete reduced-motion branch", () => {
    const stages = getCeremonyStages(true);
    expect(stages).not.toContain("seal");
    expect(stages).toContain("ink-riddle");
    expect(stages).toContain("map");
    expect(stages.at(-1)).toBe("active");
  });
});
