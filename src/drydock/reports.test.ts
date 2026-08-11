import { describe, expect, it } from "vitest";
import { createDrydockIssue } from "@/drydock/issues";
import {
  createDrydockValidationReport,
  creatorReportProjection,
  diffDrydockReports,
  isDrydockReportPublicationEligible,
  supportReportProjection,
} from "@/drydock/reports";

describe("Drydock source-bound reports", () => {
  const issue = createDrydockIssue({
    code: "DRYDOCK_GRAPH_UNREACHABLE",
    category: "GRAPH",
    severity: "ERROR",
    ruleVersion: 1,
    location: { blockId: "b" },
    message: "Private answer must never appear here.",
    technicalDetail: "secret",
    remediation: "Connect it.",
  });
  it("binds a deterministic report to immutable source and stable issues", () => {
    const first = createDrydockValidationReport({
      source: { b: 1, a: 2 },
      issues: [issue],
      generatedAt: "2026-08-10T00:00:00.000Z",
    });
    const second = createDrydockValidationReport({
      source: { a: 2, b: 1 },
      issues: [issue],
      generatedAt: "2026-08-10T00:00:00.000Z",
    });
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      runId: expect.stringMatching(/^drydock-run-/),
      schemaRegistryVersion: 2,
      status: "INVALID",
      summary: { total: 1, errors: 1, warnings: 0, infos: 0 },
      proof: { completeness: "COMPLETE", limitsEncountered: [] },
    });
  });
  it("diffs by stable issue identity and redacts support detail", () => {
    const previous = createDrydockValidationReport({
      source: { v: 1 },
      issues: [],
      generatedAt: "2026-08-10T00:00:00.000Z",
    });
    const next = createDrydockValidationReport({
      source: { v: 2 },
      issues: [issue],
      generatedAt: "2026-08-10T00:00:00.000Z",
    });
    expect(diffDrydockReports(previous, next).introduced).toEqual([issue]);
    expect(creatorReportProjection(next).issues[0]).not.toHaveProperty("technicalDetail");
    expect(supportReportProjection(next).issues[0]).not.toHaveProperty("message");
  });
  it("classifies one unambiguous semantic rule move without comparing messages", () => {
    const before = createDrydockIssue({ ...issue, location: { blockId: "before" }, message: "Old private wording." });
    const after = createDrydockIssue({ ...issue, location: { blockId: "after" }, message: "New private wording." });
    const previous = createDrydockValidationReport({
      source: { v: 1 },
      issues: [before],
      generatedAt: "2026-08-10T00:00:00.000Z",
    });
    const next = createDrydockValidationReport({
      source: { v: 2 },
      issues: [after],
      generatedAt: "2026-08-10T00:00:00.000Z",
    });
    const diff = diffDrydockReports(previous, next);
    expect(diff.locationChanged).toEqual([{ before, after }]);
    expect(diff.introduced).toEqual([]);
    expect(diff.resolved).toEqual([]);
  });
  it("keeps bounded analysis explicitly incomplete instead of treating it as a clean receipt", () => {
    const report = createDrydockValidationReport({
      source: { v: 1 },
      issues: [],
      generatedAt: "2026-08-10T00:00:00.000Z",
      proofCompleteness: "INCOMPLETE_PROOF",
      analysisLimits: ["state-iterations:16"],
    });
    expect(report.status).toBe("INCOMPLETE_PROOF");
    expect(report.proof).toEqual({ completeness: "INCOMPLETE_PROOF", limitsEncountered: ["state-iterations:16"] });
    expect(isDrydockReportPublicationEligible(report)).toBe(false);
  });
  it("allows publication only from a complete error-free exact-source receipt", () => {
    const report = createDrydockValidationReport({
      source: { v: 1 },
      issues: [],
      generatedAt: "2026-08-10T00:00:00.000Z",
    });
    expect(isDrydockReportPublicationEligible(report)).toBe(true);
    expect(isDrydockReportPublicationEligible(undefined)).toBe(false);
  });
});
