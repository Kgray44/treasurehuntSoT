import { describe, expect, it } from "vitest";
import { discoverObservations } from "../src/discovery.js";
import { reconcileProjectRecords } from "../src/reconciliation.js";
import { projectRegistry } from "../src/registry.js";

describe("project discovery reconciliation", () => {
  it("adds a discovered in-development version without rewriting accepted Bridgewatch phases", () => {
    const discovery = discoverObservations({
      observedAt: "2026-08-16T20:00:00.000Z",
      documents: [
        {
          path: "Development_Docs/Project_Bridgewatch_v1.2_Mission_Control_Realization_Design_Record.md",
          text: "# Project Bridgewatch v1.2\n\n## Phase 1: Raise the Board\n## Phase 2: Wire the Signals\n## Phase 3: Keep the Watch",
        },
      ],
      branches: [{ name: "codex/project-bridgewatch-v1.2-mission-control", headSha: "abcdef1" }],
      pullRequests: [],
    });

    const bridgewatch = reconcileProjectRecords(projectRegistry, discovery).find(
      (project) => project.id === "bridgewatch",
    );

    expect(bridgewatch).toMatchObject({
      state: "ACTIVE",
      finalMainSha: "dead22dc26aeec2b722625aa9a68dc5688111fca",
      declaredPhaseCount: 3,
    });
    expect(bridgewatch?.versions).toContainEqual(
      expect.objectContaining({ identity: "v1.2", lifecycle: "IN_DEVELOPMENT", confidence: "AUTHORITATIVE" }),
    );
    expect(bridgewatch?.phases).toContainEqual(
      expect.objectContaining({ ordinal: 3, name: "Keep the Watch", state: "COMPLETE" }),
    );
    expect(bridgewatch?.phases).toHaveLength(3);
  });

  it("keeps a provisional project truthful when only branch evidence is available", () => {
    const discovery = discoverObservations({
      observedAt: "2026-08-16T20:00:00.000Z",
      documents: [],
      branches: [{ name: "codex/project-new-harbor-phase1-survey", headSha: "abcdef1" }],
      pullRequests: [],
    });

    const project = reconcileProjectRecords([], discovery).find((entry) => entry.id === "new-harbor");

    expect(project).toMatchObject({ state: "ACTIVE", declaredPhaseCount: null, confidence: "LOW" });
    expect(project?.phases).toContainEqual(expect.objectContaining({ ordinal: 1, state: "ACTIVE" }));
    expect(project?.missingEvidence).toContain("No governing project record has been observed yet.");
  });
});
