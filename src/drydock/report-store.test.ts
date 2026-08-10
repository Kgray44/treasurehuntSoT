import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  drydockValidationRun: { findMany: vi.fn(), findFirst: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: prisma }));

import { createDrydockIssue } from "@/drydock/issues";
import { createDrydockValidationReport } from "@/drydock/reports";
import { getDrydockValidationRun, listDrydockValidationRuns } from "@/drydock/report-store";

describe("Drydock durable report store", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists only the requested Chronicle's safe receipt metadata", async () => {
    prisma.drydockValidationRun.findMany.mockResolvedValue([{
      id: "record-1", runId: "drydock-run-1", sourceChecksum: "source", sourceRevision: 7, status: "VALID", proofCompleteness: "COMPLETE", issueCount: 0, issueDigest: "issues", reportDigest: "report", createdAt: new Date("2026-08-10T00:00:00.000Z"),
    }]);
    await expect(listDrydockValidationRuns("tale-a")).resolves.toEqual([expect.objectContaining({ id: "record-1", sourceRevision: 7, createdAt: "2026-08-10T00:00:00.000Z" })]);
    expect(prisma.drydockValidationRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { draft: { is: { taleId: "tale-a" } } },
      take: 100,
    }));
  });

  it("loads a creator-safe report only through the requested Chronicle relation", async () => {
    const issue = createDrydockIssue({ code: "DRYDOCK_GRAPH_UNREACHABLE", category: "GRAPH", severity: "ERROR", ruleVersion: 1, location: { blockId: "block-a" }, message: "Safe message", technicalDetail: "never return", remediation: "Connect it." });
    const report = createDrydockValidationReport({ source: { synthetic: true }, issues: [issue], generatedAt: "2026-08-10T00:00:00.000Z" });
    prisma.drydockValidationRun.findFirst.mockResolvedValue({ report: JSON.stringify(report) });
    const projection = await getDrydockValidationRun("tale-a", report.runId);
    expect(projection?.issues[0]).not.toHaveProperty("technicalDetail");
    expect(prisma.drydockValidationRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { runId: report.runId, draft: { is: { taleId: "tale-a" } } },
    }));
  });
});
