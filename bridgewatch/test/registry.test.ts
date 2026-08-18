import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { projectProgress } from "../src/domain.js";
import { projectRegistry, registryForRepository } from "../src/registry.js";

describe("source-indexed Project Registry", () => {
  it("binds retained project evidence to the exact configured repository", () => {
    expect(registryForRepository("Kgray44/treasurehuntSoT")).toEqual(
      expect.arrayContaining([expect.objectContaining({ repository: "Kgray44/treasurehuntSoT" })]),
    );
    expect(registryForRepository("Kgray44/treasurehuntSoT").every((project) => project.repository === "Kgray44/treasurehuntSoT")).toBe(true);
  });

  it("keeps every discovered project durable and does not turn evidence records into progress", () => {
    expect(projectRegistry.map((project) => project.id)).toContain("bridgewatch");
    expect(projectRegistry.map((project) => project.id)).toContain("sounding-line");
    expect(new Set(projectRegistry.map((project) => project.id)).size).toBe(projectRegistry.length);
    expect(projectProgress(projectRegistry.find((project) => project.id === "bridgewatch")!)).toMatchObject({
      state: "UNMEASURED",
      percent: null,
    });
  });

  it("links every backfilled source to a repository record", () => {
    for (const project of projectRegistry)
      for (const source of project.sourcePaths)
        expect(existsSync(resolve(process.cwd(), "..", source)), `${project.id}: ${source}`).toBe(true);
  });

  it("retains the accepted three-phase Bridgewatch completion record", () => {
    const project = projectRegistry.find((entry) => entry.id === "bridgewatch");
    const phase = project?.phases.find((entry) => entry.ordinal === 3);

    expect(project?.state).toBe("COMPLETE");
    expect(project?.completionReceipt).toBe("Development_Docs/Project_Bridgewatch_Completion_Receipt.md");
    expect(project?.finalMainSha).toBe("dead22dc26aeec2b722625aa9a68dc5688111fca");
    expect(phase).toMatchObject({
      name: "Keep the Watch",
      state: "COMPLETE",
      branch: "codex/project-bridgewatch-phase3-keep-the-watch-6",
      pullRequest: 83,
      acceptedHeadSha: "5bae2e4d2d0aee6993f8e619cc8c79ef99235ff6",
      integratedMainSha: "dead22dc26aeec2b722625aa9a68dc5688111fca",
      finalDecision: "RELEASE_GO",
    });
  });
});
