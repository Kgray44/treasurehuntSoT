import { describe, expect, it } from "vitest";
import { validateProjectOneVoyage } from "./validate-project-one-voyage";

describe("Project One Voyage architecture boundary", () => {
  it("keeps retired terminology and legacy writers out of active compatibility routes", async () => {
    await expect(validateProjectOneVoyage(process.cwd())).resolves.toEqual([]);
  });
});
