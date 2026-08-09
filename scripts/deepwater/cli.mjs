#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  buildArtifacts,
  compareArtifacts,
  semanticDigest,
  validateEvidencePaths,
  validateModel,
  validatePhase2Model,
  validatePhase3Model,
  writeArtifacts,
} from "./lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const command = process.argv[2] ?? "validate";
const artifacts = await buildArtifacts(root);

if (command === "audit") {
  await writeArtifacts(root, artifacts);
  process.stdout.write(
    `${JSON.stringify({
      decision: "DEEPWATER_AUDIT_GENERATED",
      sourceSha: artifacts.ledger.auditedSourceSha,
      capabilities: artifacts.ledger.capabilities.length,
      findings: artifacts.findingsDocument.findings.length,
      prioritizedTraces: artifacts.tracesDocument.traceCount,
      phase2QueueItems: artifacts.tracesDocument.queueItemCount,
      remediationPackets: artifacts.remediationDocument.packages.length,
      phase3QueueItems: artifacts.phase3Queue.queue.length,
      utilizationReviews: artifacts.utilizationDocument.reviewedCapabilityCount,
      utilizationStatusCounts: artifacts.utilizationDocument.statusCounts,
      registeredSlices: artifacts.slicesDocument.slices.length,
      semanticDigest: semanticDigest(artifacts),
    })}\n`,
  );
} else if (command === "report") {
  await writeArtifacts(root, artifacts);
  process.stdout.write(
    `${JSON.stringify({
      decision: "DEEPWATER_REPORTS_GENERATED",
      utilizationReport: "Development_Docs/Programs/Deepwater/reports/Project_Deepwater_Phase_3_Utilization_Report.md",
      remediationReport: "Development_Docs/Programs/Deepwater/reports/Project_Deepwater_Phase_3_Remediation_Report.md",
      deltaReport: "Development_Docs/Programs/Deepwater/reports/Project_Deepwater_Phase_2_to_Phase_3_Delta_Report.md",
      phase3Queue: artifacts.phase3Queue.queue.length,
    })}\n`,
  );
} else if (command === "validate") {
  const errors = [
    ...validateModel(artifacts),
    ...validatePhase2Model(artifacts.phase2),
    ...validatePhase3Model(artifacts),
    ...(await validateEvidencePaths(root, artifacts)),
    ...(await compareArtifacts(root, artifacts)),
  ];
  if (errors.length) {
    process.stderr.write(`${JSON.stringify({ decision: "DEEPWATER_VALIDATION_FAILED", errors }, null, 2)}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `${JSON.stringify({
        decision: "DEEPWATER_VALIDATION_PASSED",
        sourceSha: artifacts.ledger.auditedSourceSha,
        capabilities: artifacts.ledger.capabilities.length,
        prioritizedTraces: artifacts.tracesDocument.traceCount,
        phase2QueueItems: artifacts.tracesDocument.queueItemCount,
        findings: artifacts.findingsDocument.findings.length,
        remediationPackets: artifacts.remediationDocument.packages.length,
        phase3QueueItems: artifacts.phase3Queue.queue.length,
        utilizationReviews: artifacts.utilizationDocument.reviewedCapabilityCount,
        utilizationStatusCounts: artifacts.utilizationDocument.statusCounts,
        registeredSlices: artifacts.slicesDocument.slices.length,
        semanticDigest: semanticDigest(artifacts),
      })}\n`,
    );
  }
} else {
  throw new Error(`UNKNOWN_DEEPWATER_COMMAND:${command}`);
}
