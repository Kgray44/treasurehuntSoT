import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { projectProgress } from "../src/domain.js";
import { projectRegistry } from "../src/registry.js";

describe("source-indexed Project Registry", () => {
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
});
