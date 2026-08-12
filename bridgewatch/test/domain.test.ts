import { describe, expect, it } from "vitest";
import { measureMilestones, projectProgress, type ProjectRecord } from "../src/domain.js";

describe("governed milestone progress", () => {
  it("uses only explicit accepted milestone weights", () => {
    expect(
      measureMilestones(
        [
          { id: "registry", title: "Registry", weight: 3, state: "ACCEPTED", evidence: ["record"] },
          { id: "reporter", title: "Reporter", weight: 1, state: "IN_PROGRESS", evidence: [] },
        ],
        "HIGH",
      ),
    ).toEqual({ state: "MEASURED", percent: 75, completedWeight: 3, totalWeight: 4 });
  });

  it("does not invent progress or completion from phase arithmetic", () => {
    const project: ProjectRecord = {
      id: "example",
      name: "Example",
      repository: "owner/repository",
      state: "ACTIVE",
      governingReferences: ["record"],
      sourcePaths: ["record"],
      confidence: "LOW",
      phases: [
        {
          id: "example-p1",
          ordinal: 1,
          name: "Complete looking phase",
          scope: "Example",
          state: "MERGED",
          milestones: [{ id: "done", title: "Done", weight: 1, state: "ACCEPTED", evidence: ["record"] }],
        },
      ],
    };
    expect(projectProgress(project)).toEqual({ state: "UNMEASURED", percent: null, completedWeight: null, totalWeight: null });
    expect(project.state).toBe("ACTIVE");
  });
});
