import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDrydockPublishingEvidencePayload } from "@/drydock/publishing-evidence";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
const write = (name: string, value: unknown) => {
  const root = roots[0] ?? (roots[0] = mkdtempSync(join(tmpdir(), "drydock-cli-phase4-")));
  const file = join(root, name); writeFileSync(file, JSON.stringify(value)); return file;
};
const run = (...args: string[]) => execFileSync(process.execPath, ["--import", "tsx", "src/drydock/phase4-cli.ts", ...args], { cwd: resolve(__dirname, "../.."), encoding: "utf8" });

const snapshot = { schemaVersion: 1, tale: { id: "tale", slug: "tale", title: "Tale", subtitle: null, shortDescription: null, longDescription: null, coverAssetId: null, theme: "CARTOGRAPHERS_TABLE", visibility: "PRIVATE", playerCountMin: 1, playerCountMax: 1, estimatedDuration: null, contentWarnings: null }, chapters: [], assets: [], locations: [], artifacts: [], publishedAt: "2026-08-13T00:00:00.000Z" };

describe("Phase 4 Drydock CLI parity", () => {
  it("assesses compatibility using the canonical compatibility service", () => {
    const output = JSON.parse(run("compatibility", write("source.json", snapshot)));
    expect(output.status).toBe("COMPATIBLE");
  }, 20_000);
  it("evaluates a verified readiness input through the canonical evaluator", () => {
    const checksum = "a".repeat(64);
    const input = { sourceChecksum: checksum, report: { sourceChecksum: checksum, status: "VALID", proof: { completeness: "COMPLETE" }, issues: [], schemaRegistryVersion: 2, ruleCatalogVersion: 1, runId: "run" }, requirements: [], requiredSuites: [], compatibility: { sourceChecksum: checksum, policyVersion: "v", status: "COMPATIBLE", digest: "d", warnings: [] }, externalEvidence: [], activeWaiverIssueIds: [], activeWaiverIds: [] };
    expect(JSON.parse(run("readiness", write("readiness.json", input))).status).toBe("VERIFIED");
    expect(JSON.parse(run("publish-check", write("publish-check.json", input))).status).toBe("VERIFIED");
  });
  it("projects only safe immutable publishing evidence", () => {
    const draft = { schemaVersion: 1 as const, sourceChecksum: "a".repeat(64), schemaRegistryVersion: 2, ruleCatalogVersion: 1, validationRunId: "run", requiredSuitePolicyVersion: "suite", requiredScenarioSuiteIds: [], scenarioRunIds: [], coverageDigest: "b".repeat(64), compatibilityPolicyVersion: "compat", compatibilityDigest: "c".repeat(64), externalEvidenceDigest: "d".repeat(64), waiverIds: [], draftDigest: "e".repeat(64) };
    const evidence = createDrydockPublishingEvidencePayload({ draft, scenarioRunIds: [], coverageDigest: draft.coverageDigest, platformVersion: "test", createdAt: "2026-08-13T00:00:00.000Z" });
    expect(JSON.parse(run("evidence-inspect", write("evidence.json", evidence))).digest).toBe(evidence.digest);
  });
});
