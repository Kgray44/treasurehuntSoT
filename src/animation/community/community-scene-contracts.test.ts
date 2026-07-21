import { describe, expect, it } from "vitest";
import { communitySceneContracts, communitySceneNames } from "./community-scene-contracts";
describe("Harborlight Lanternwake future contracts", () => {
  it("registers unique future-only Community Harbor contracts", () => {
    expect(new Set(communitySceneNames).size).toBe(16);
    expect(Object.values(communitySceneContracts).every((item) => item.reachability === "future-contract")).toBe(true);
  });
  it("inherits Lanternwake ownership, reduced motion, cleanup and truth boundaries", () => {
    for (const item of Object.values(communitySceneContracts)) {
      expect(item.owner).toBe("gsap");
      expect(item.reducedMotion).toBe("reduced");
      expect(item.interruption).toBe("cleanup-and-static-fallback");
      expect(item.focusRestoration).toBe("trigger-or-heading");
    }
  });
});
