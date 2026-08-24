import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { featureCatalogEntrySchema, type FeatureCatalogEntry } from "./catalog-schema";
import { renderFeatureCatalog } from "./build-feature-catalog";
import { loadFeatureCatalog, sortedEntries } from "./load-feature-catalog";
import { branchEvidenceResolves, validateFeatureCatalog } from "./validate-feature-catalog";

const entry = (overrides: Partial<FeatureCatalogEntry> = {}): FeatureCatalogEntry => ({
  id: "FT-900",
  title: "Catalog Test Capability",
  summary: "A completed capability used to validate the catalog contract.",
  status: "MAINLINE",
  surfaces: ["/test"],
  subfeatures: ["Meaningful behavior"],
  evidence: [{ kind: "path", value: "package.json" }],
  catalogVersion: 1,
  ...overrides,
});

describe("Feature Catalog", () => {
  it("loads the audited catalog with stable ordering", () => {
    const { entries } = loadFeatureCatalog();
    expect(entries).toHaveLength(49);
    expect(sortedEntries(entries).map((item) => item.id)).toEqual(
      [...sortedEntries(entries).map((item) => item.id)].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ),
    );
    expect(entries.find((item) => item.id === "FT-B009")?.program).toBe("Project Tideglass Phases 1-3");
    expect(entries.find((item) => item.id === "FT-036")?.program).toBe("Project Drydock Phase 3");
  });

  it("rejects duplicate and empty subfeatures", () => {
    expect(() => featureCatalogEntrySchema.parse(entry({ subfeatures: ["Repeated", "Repeated"] }))).toThrow(/unique/);
    expect(() => featureCatalogEntrySchema.parse(entry({ subfeatures: [""] }))).toThrow();
    expect(() => featureCatalogEntrySchema.parse({ ...entry(), metadata: { token: "nope" } })).toThrow();
  });

  it("rejects missing branch metadata", () => {
    expect(() => featureCatalogEntrySchema.parse(entry({ status: "BRANCH_COMPLETE_NOT_MERGED" }))).toThrow(
      /branch-complete/,
    );
  });

  it("detects cross-fragment duplicate IDs and titles", () => {
    expect(validateFeatureCatalog([entry(), entry({ title: "Different", id: "FT-900" })])).toContain(
      "Duplicate feature ID: FT-900",
    );
    expect(validateFeatureCatalog([entry(), entry({ id: "FT-901" })])).toContain(
      "Duplicate feature title: Catalog Test Capability",
    );
  });

  it("rejects missing mainline paths, secret-like evidence, and local paths", () => {
    expect(
      validateFeatureCatalog([entry({ evidence: [{ kind: "path", value: "missing-file.ts" }] })]).join(" "),
    ).toMatch(/does not exist/);
    expect(
      validateFeatureCatalog([entry({ evidence: [{ kind: "path", value: "C:\\Users\\secret-token.txt" }] })]).join(" "),
    ).toMatch(/absolute/);
    expect(
      validateFeatureCatalog([entry({ evidence: [{ kind: "path", value: "catalog-token-reference" }] })]).join(" "),
    ).toMatch(/secret-like/);
  });

  it("supports promotion by removing branch metadata for mainline", () => {
    expect(featureCatalogEntrySchema.parse(entry({ status: "MAINLINE" })).status).toBe("MAINLINE");
    expect(() =>
      featureCatalogEntrySchema.parse(entry({ status: "MAINLINE", branch: "codex/example", commit: "abcdef0" })),
    ).toThrow(/only branch-complete/);
  });

  it("accepts detached GitHub PR branch evidence only when the recorded commit is in HEAD", () => {
    const originalActions = process.env.GITHUB_ACTIONS;
    const originalHeadRef = process.env.GITHUB_HEAD_REF;
    const originalSha = process.env.GITHUB_SHA;
    // The trusted workflow dispatch SHA can differ from a governed worker's
    // sealed execution checkout. Branch evidence must bind to that checkout.
    const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    try {
      process.env.GITHUB_ACTIONS = "true";
      process.env.GITHUB_HEAD_REF = "codex/detached-ci-proof";
      process.env.GITHUB_SHA = "0".repeat(40);
      expect(branchEvidenceResolves("codex/detached-ci-proof", head)).toBe(true);
      expect(branchEvidenceResolves("codex/different-branch", head)).toBe(false);
    } finally {
      if (originalActions === undefined) delete process.env.GITHUB_ACTIONS;
      else process.env.GITHUB_ACTIONS = originalActions;
      if (originalHeadRef === undefined) delete process.env.GITHUB_HEAD_REF;
      else process.env.GITHUB_HEAD_REF = originalHeadRef;
      if (originalSha === undefined) delete process.env.GITHUB_SHA;
      else process.env.GITHUB_SHA = originalSha;
    }
  });

  it("rejects planned language and keeps output deterministic", () => {
    expect(validateFeatureCatalog([entry({ summary: "A planned capability." })]).join(" ")).toMatch(/planned/);
    const first = renderFeatureCatalog(
      [entry({ id: "FT-901", title: "Zed" }), entry({ id: "FT-900", title: "Aye" })],
      "abc1234",
    );
    const second = renderFeatureCatalog(
      [entry({ id: "FT-900", title: "Aye" }), entry({ id: "FT-901", title: "Zed" })],
      "abc1234",
    );
    expect(first).toBe(second);
  });

  it("makes stale generated output detectable", () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "feature-catalog-"));
    const output = path.join(temporary, "FEATURE_CATALOG.md");
    fs.writeFileSync(output, "stale\n");
    expect(fs.readFileSync(output, "utf8")).not.toBe(renderFeatureCatalog([entry()], "abc1234"));
  });
});
