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
      phase2Queue: artifacts.queueDocument.queue.length,
      semanticDigest: semanticDigest(artifacts),
    })}\n`,
  );
} else if (command === "report") {
  await writeArtifacts(root, artifacts);
  process.stdout.write(
    `${JSON.stringify({
      decision: "DEEPWATER_REPORTS_GENERATED",
      auditReport: "Development_Docs/Programs/Deepwater/reports/Project_Deepwater_Phase_1_Audit_Report.md",
      capabilitySummary: "Development_Docs/Programs/Deepwater/reports/Project_Deepwater_Phase_1_Capability_Summary.md",
      phase2Queue: artifacts.queueDocument.queue.length,
    })}\n`,
  );
} else if (command === "validate") {
  const errors = [
    ...validateModel(artifacts),
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
        catalogMapped: artifacts.status.metrics.featureCatalogMappedCount,
        uncataloged: artifacts.status.metrics.uncatalogedMeaningfulCapabilityCount,
        findings: artifacts.findingsDocument.findings.length,
        phase2Queue: artifacts.queueDocument.queue.length,
        semanticDigest: semanticDigest(artifacts),
      })}\n`,
    );
  }
} else {
  throw new Error(`UNKNOWN_DEEPWATER_COMMAND:${command}`);
}
