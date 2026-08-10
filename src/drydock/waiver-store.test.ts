import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  drydockValidationRun: { findFirst: vi.fn() },
  drydockRuleWaiver: { findMany: vi.fn(), create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: prisma }));

import { createDrydockIssue } from "@/drydock/issues";
import { createDrydockValidationReport } from "@/drydock/reports";
import { createDrydockWaiverFromRun, listDrydockWaivers } from "@/drydock/waiver-store";

describe("Drydock durable waiver store", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists only the requested Chronicle's waiver receipt metadata", async () => {
    prisma.drydockRuleWaiver.findMany.mockResolvedValue([
      {
        id: "waiver-1",
        issueId: "issue",
        ruleCode: "DRYDOCK_CONTROL_FLOW_EDGE_CONDITION_UNPROVEN",
        ruleVersion: 1,
        sourceChecksum: "checksum",
        sourceRevision: 4,
        scope: "CHRONICLE",
        authorizedRole: "ADMINISTRATOR",
        createdAt: new Date("2026-08-10T00:00:00.000Z"),
        expiresAt: null,
        revokedAt: null,
        auditReference: null,
      },
    ]);
    await expect(listDrydockWaivers("tale-a")).resolves.toEqual([
      expect.objectContaining({ id: "waiver-1", sourceRevision: 4 }),
    ]);
    expect(prisma.drydockRuleWaiver.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { draft: { is: { taleId: "tale-a" } } } }),
    );
  });

  it("creates an administrator waiver only for a reviewable receipt issue", async () => {
    const issue = createDrydockIssue({
      code: "DRYDOCK_CONTROL_FLOW_EDGE_CONDITION_UNPROVEN",
      category: "CONTROL_FLOW",
      severity: "WARNING",
      ruleVersion: 1,
      location: { blockId: "block-a" },
      message: "safe",
      remediation: "safe",
    });
    const report = createDrydockValidationReport({
      source: { fixture: true },
      sourceRevision: 6,
      issues: [issue],
      generatedAt: "2026-08-10T00:00:00.000Z",
    });
    prisma.drydockValidationRun.findFirst.mockResolvedValue({
      draftId: "draft-a",
      sourceChecksum: report.sourceChecksum,
      sourceRevision: 6,
      report: JSON.stringify(report),
    });
    prisma.drydockRuleWaiver.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...data,
      createdAt: new Date("2026-08-10T00:01:00.000Z"),
      expiresAt: null,
      revokedAt: null,
      auditReference: null,
    }));
    await expect(
      createDrydockWaiverFromRun({
        taleId: "tale-a",
        runId: report.runId,
        issueId: issue.id,
        rationale: "Reviewed static legacy transition.",
        scope: "CHRONICLE",
        authorizedByAccountId: "admin-a",
        authorizedRole: "ADMINISTRATOR",
      }),
    ).resolves.toEqual(expect.objectContaining({ issueId: issue.id, sourceRevision: 6 }));
    expect(prisma.drydockValidationRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { runId: report.runId, draft: { is: { taleId: "tale-a" } } } }),
    );
  });
});
