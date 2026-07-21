import { describe, expect, it } from "vitest";
import { canonicalReadsEnabled, canonicalWritesEnabled, projectOneVoyageStage } from "./project-one-voyage-stage";

describe("Project One Voyage stages", () => {
  it("defaults to compatibility-only canonical operation and keeps rehearsal stages explicit", () => {
    expect(projectOneVoyageStage(undefined)).toBe("F_COMPATIBILITY_ONLY");
    expect(canonicalReadsEnabled("C_SHADOW_READS")).toBe(false);
    expect(canonicalReadsEnabled("D_CANONICAL_READS")).toBe(true);
    expect(canonicalWritesEnabled("D_CANONICAL_READS")).toBe(false);
    expect(canonicalWritesEnabled("E_CANONICAL_WRITES")).toBe(true);
    expect(canonicalWritesEnabled("F_COMPATIBILITY_ONLY")).toBe(true);
  });
});
