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
  validatePhase4Model,
  writeArtifacts,
} from "./lib.mjs";
import {
  buildPhase5Governance,
  comparePhase5Artifacts,
  phase5SemanticDigest,
  validatePhase5Governance,
  writePhase5Artifacts,
} from "./phase5.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const command = process.argv[2] ?? "validate";
const artifacts = await buildArtifacts(root);
const phase5 = await buildPhase5Governance(root, artifacts);

if (command === "audit") {
  await writeArtifacts(root, artifacts);
  await writePhase5Artifacts(root, phase5);
  const settledPhase5 = await buildPhase5Governance(root, artifacts);
  await writePhase5Artifacts(root, settledPhase5);
  process.stdout.write(
    `${JSON.stringify({
      decision: "DEEPWATER_AUDIT_GENERATED",
      sourceSha: artifacts.phase4ProofMatrix.sourceSha,
      capabilities: artifacts.phase4ProofMatrix.capabilities.length,
      findings: artifacts.findingsDocument.findings.length,
      prioritizedTraces: artifacts.tracesDocument.traceCount,
      phase2QueueItems: artifacts.tracesDocument.queueItemCount,
      remediationPackets: artifacts.remediationDocument.packages.length,
      phase3QueueItems: artifacts.phase3Queue.queue.length,
      utilizationReviews: artifacts.utilizationDocument.reviewedCapabilityCount,
      utilizationStatusCounts: artifacts.utilizationDocument.statusCounts,
      registeredSlices: artifacts.slicesDocument.slices.length,
      phase4ProofCapabilities: artifacts.phase4ProofMatrix.capabilities.length,
      phase4RuntimeEvidenceStatus: artifacts.phase4ProofMatrix.runtimeEvidenceStatus,
      phase5DeltaCount: settledPhase5.delta.deltas.length,
      phase5SemanticDigest: phase5SemanticDigest(settledPhase5),
      semanticDigest: semanticDigest(artifacts),
    })}\n`,
  );
} else if (command === "report") {
  await writeArtifacts(root, artifacts);
  await writePhase5Artifacts(root, phase5);
  const settledPhase5 = await buildPhase5Governance(root, artifacts);
  await writePhase5Artifacts(root, settledPhase5);
  process.stdout.write(
    `${JSON.stringify({
      decision: "DEEPWATER_REPORTS_GENERATED",
      utilizationReport: "Development_Docs/Programs/Deepwater/reports/Project_Deepwater_Phase_3_Utilization_Report.md",
      remediationReport: "Development_Docs/Programs/Deepwater/reports/Project_Deepwater_Phase_3_Remediation_Report.md",
      deltaReport: "Development_Docs/Programs/Deepwater/reports/Project_Deepwater_Phase_2_to_Phase_3_Delta_Report.md",
      finalReport: "Development_Docs/Programs/Deepwater/reports/Project_Deepwater_Phase_3_Final_Report.md",
      phase4ProofReport: "Development_Docs/Programs/Deepwater/reports/Project_Deepwater_Phase_4_Proof_Report.md",
      phase4OwnerWalkthroughPacket:
        "Development_Docs/Programs/Deepwater/reports/Project_Deepwater_Phase_4_Owner_Walkthrough_Packet.md",
      phase3Queue: artifacts.phase3Queue.queue.length,
      phase5GovernanceReport:
        "Development_Docs/Programs/Deepwater/reports/Project_Deepwater_Phase_5_Governance_Report.md",
    })}\n`,
  );
} else if (command === "validate") {
  const errors = [
    ...validateModel(artifacts),
    ...validatePhase2Model(artifacts.phase2),
    ...validatePhase3Model(artifacts),
    ...validatePhase4Model(artifacts),
    ...validatePhase5Governance(phase5),
    ...(await validateEvidencePaths(root, artifacts)),
    ...(await compareArtifacts(root, artifacts)),
    ...(await comparePhase5Artifacts(root, phase5)),
  ];
  if (errors.length) {
    process.stderr.write(`${JSON.stringify({ decision: "DEEPWATER_VALIDATION_FAILED", errors }, null, 2)}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `${JSON.stringify({
        decision: "DEEPWATER_VALIDATION_PASSED",
        sourceSha: artifacts.phase4ProofMatrix.sourceSha,
        capabilities: artifacts.phase4ProofMatrix.capabilities.length,
        prioritizedTraces: artifacts.tracesDocument.traceCount,
        phase2QueueItems: artifacts.tracesDocument.queueItemCount,
        findings: artifacts.findingsDocument.findings.length,
        remediationPackets: artifacts.remediationDocument.packages.length,
        phase3QueueItems: artifacts.phase3Queue.queue.length,
        utilizationReviews: artifacts.utilizationDocument.reviewedCapabilityCount,
        utilizationStatusCounts: artifacts.utilizationDocument.statusCounts,
        registeredSlices: artifacts.slicesDocument.slices.length,
        phase4ProofCapabilities: artifacts.phase4ProofMatrix.capabilities.length,
        phase4RuntimeEvidenceStatus: artifacts.phase4ProofMatrix.runtimeEvidenceStatus,
        phase5DeltaCount: phase5.delta.deltas.length,
        phase5SemanticDigest: phase5SemanticDigest(phase5),
        semanticDigest: semanticDigest(artifacts),
      })}\n`,
    );
  }
} else if (command === "drift") {
  process.stdout.write(
    `${JSON.stringify({ decision: "DEEPWATER_DRIFT_REPORTED", ...phase5.delta, semanticDigest: phase5SemanticDigest(phase5) })}\n`,
  );
} else {
  throw new Error(`UNKNOWN_DEEPWATER_COMMAND:${command}`);
}
