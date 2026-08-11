import { db } from "@/lib/db";
import { creatorReportProjection, type DrydockValidationReport } from "@/drydock/reports";

function parseStoredReport(raw: string): DrydockValidationReport {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("DRYDOCK_STORED_REPORT_INVALID");
  const report = parsed as Partial<DrydockValidationReport>;
  if (
    report.schemaVersion !== 1 ||
    typeof report.runId !== "string" ||
    typeof report.sourceChecksum !== "string" ||
    !Array.isArray(report.issues)
  )
    throw new Error("DRYDOCK_STORED_REPORT_INVALID");
  return report as DrydockValidationReport;
}

/** Creator-authorized callers receive receipt metadata only; authored source is never stored or returned. */
export async function listDrydockValidationRuns(taleId: string) {
  const runs = await db.drydockValidationRun.findMany({
    where: { draft: { is: { taleId } } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      runId: true,
      sourceChecksum: true,
      sourceRevision: true,
      status: true,
      proofCompleteness: true,
      issueCount: true,
      issueDigest: true,
      reportDigest: true,
      createdAt: true,
    },
  });
  return runs.map((run) => ({ ...run, createdAt: run.createdAt.toISOString() }));
}

export async function getDrydockValidationRun(taleId: string, runId: string) {
  const run = await db.drydockValidationRun.findFirst({
    where: { runId, draft: { is: { taleId } } },
    select: { report: true },
  });
  return run ? creatorReportProjection(parseStoredReport(run.report)) : null;
}
