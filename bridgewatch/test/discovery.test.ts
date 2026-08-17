import { describe, expect, it } from "vitest";
import { discoverObservations } from "../src/discovery.js";

describe("repository discovery", () => {
  it("discovers a governed project, version, and phase denominator from a project-bound record", () => {
    const result = discoverObservations({
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

    const bridgewatch = result.projects.find((project) => project.id === "bridgewatch");
    expect(bridgewatch).toMatchObject({ name: "Project Bridgewatch", confidence: "AUTHORITATIVE" });
    expect(bridgewatch?.phaseCount).toBe(3);
    expect(bridgewatch?.versions).toContainEqual(
      expect.objectContaining({ identity: "v1.2", confidence: "AUTHORITATIVE", lifecycle: "IN_DEVELOPMENT" }),
    );
  });

  it("uses project-bound branch and pull-request evidence but leaves ambiguous activity unclassified", () => {
    const result = discoverObservations({
      observedAt: "2026-08-16T20:00:00.000Z",
      documents: [],
      branches: [
        { name: "codex/project-deepwater-phase5-keep-the-soundings", headSha: "aaaaaaa" },
        { name: "codex/chore-dependency-v1.2", headSha: "bbbbbbb" },
      ],
      pullRequests: [
        {
          number: 198,
          title: "Project Tideglass v1.4 — Read the Wake",
          state: "OPEN",
          headRef: "codex/project-tideglass-v1.4-read-the-wake",
        },
      ],
    });

    expect(result.projects.find((project) => project.id === "deepwater")?.phases).toContainEqual(
      expect.objectContaining({ ordinal: 5, confidence: "PROVISIONAL" }),
    );
    expect(result.projects.find((project) => project.id === "tideglass")?.versions).toContainEqual(
      expect.objectContaining({ identity: "v1.4", lifecycle: "CANDIDATE" }),
    );
    expect(result.projects.some((project) => project.name.includes("Dependency"))).toBe(false);
    expect(result.unclassified).toContainEqual(expect.objectContaining({ reference: "codex/chore-dependency-v1.2" }));
  });

  it("does not mistake a document revision or dependency number for a project version", () => {
    const result = discoverObservations({
      observedAt: "2026-08-16T20:00:00.000Z",
      documents: [
        {
          path: "Development_Docs/Project_Deepwater_Governing_Document.md",
          text: "# Project Deepwater Governing Document\n\nRevision v1.4\n\nUpdate dependency to v1.2.",
        },
      ],
      branches: [],
      pullRequests: [],
    });

    expect(result.projects.find((project) => project.id === "deepwater")?.versions).toEqual([]);
  });

  it("retains a historical phase document as project evidence without turning its phase number into a version", () => {
    const result = discoverObservations({
      observedAt: "2026-08-16T20:00:00.000Z",
      documents: [
        {
          path: "Development_Docs/Project_Bridgewatch_Phase_3_Keep_the_Watch.md",
          text: "# Project Bridgewatch Phase 3 - Keep the Watch\n\nHistorical acceptance record.",
        },
      ],
      branches: [],
      pullRequests: [],
    });

    expect(result.projects).toContainEqual(
      expect.objectContaining({
        id: "bridgewatch",
        phases: [expect.objectContaining({ ordinal: 3, name: "Keep the Watch" })],
        versions: [],
      }),
    );
  });

  it("does not treat phase references inside a phase-specific record as new declared phases", () => {
    const result = discoverObservations({
      observedAt: "2026-08-16T20:00:00.000Z",
      documents: [
        {
          path: "Development_Docs/Project_Admiralty_Phase_1_Design_Record.md",
          text: "# Project Admiralty Phase 1 - Raise the Colors\n\n## Phase 3: Future work mentioned only as context.",
        },
      ],
      branches: [],
      pullRequests: [],
    });

    expect(result.projects[0]?.phases).toEqual([expect.objectContaining({ ordinal: 1 })]);
  });

  it("does not promote generic completion and audit record titles into invented projects", () => {
    const result = discoverObservations({
      observedAt: "2026-08-16T20:00:00.000Z",
      documents: [
        {
          path: "Development_Docs/Project_Bridgewatch_Completion_Receipt.md",
          text: "# Project Bridgewatch Completion Receipt\n\nHistorical receipt evidence.",
        },
        {
          path: "Development_Docs/Project_Bridgewatch_v1.2_Mission_Control_Realization_Design_Record.md",
          text: "# Project Bridgewatch v1.2 — Mission Control\n\nCurrent version evidence.",
        },
      ],
      branches: [],
      pullRequests: [],
    });

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]).toMatchObject({ id: "bridgewatch", name: "Project Bridgewatch" });
  });

  it("uses a declared title instead of arbitrary catalog prose", () => {
    const result = discoverObservations({
      observedAt: "2026-08-16T20:00:00.000Z",
      documents: [
        {
          path: "Development_Docs/Features/FEATURE_CATALOG.md",
          text: "# Feature Catalog\n\nProject Homeport now includes the integrated Whole Voyage plus Owner Correction Rounds 1-3.",
        },
        {
          path: "Development_Docs/Project_Bridgewatch_v1.2.md",
          text: "---\ntitle: Project Bridgewatch v1.2 — Mission Control\n---\n\n# Implementation notes\n\nProject Homeport is historical context.",
        },
      ],
      branches: [],
      pullRequests: [],
    });

    expect(result.projects).toEqual([expect.objectContaining({ id: "bridgewatch", name: "Project Bridgewatch" })]);
  });

  it("uses retained project identities as a cross-check for a longer governing-document title", () => {
    const result = discoverObservations({
      observedAt: "2026-08-16T20:00:00.000Z",
      knownProjects: [{ id: "admiralty", name: "Project Admiralty" }],
      documents: [
        {
          path: "Development_Docs/Project_Admiralty_Governing_Document.md",
          text: "# Project Admiralty Platform Administration Governing Document\n\nGoverned project evidence.",
        },
      ],
      branches: [],
      pullRequests: [],
    });

    expect(result.projects).toEqual([expect.objectContaining({ id: "admiralty", name: "Project Admiralty" })]);
  });
});
