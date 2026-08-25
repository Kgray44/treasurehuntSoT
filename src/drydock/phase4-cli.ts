import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parsePublishedSnapshot } from "@/chronicle/publishing";
import { assessDrydockCompatibility } from "@/drydock/compatibility";
import {
  assertSafeDrydockPublishingEvidencePayload,
  creatorPublishingEvidenceProjection,
  type DrydockPublishingEvidencePayload,
} from "@/drydock/publishing-evidence";
import { evaluateDrydockReadiness, type EvaluateDrydockReadinessInput } from "@/drydock/readiness";

const command = process.argv[2] ?? "help";
const phase4Commands = new Set(["compatibility", "readiness", "publish-check", "evidence-inspect"]);

if (!phase4Commands.has(command)) {
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/drydock/cli.ts", ...process.argv.slice(2)], {
    cwd: resolve(process.cwd()),
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} else if (command === "compatibility") {
  const sourcePath = process.argv[3];
  if (!sourcePath) throw new Error("Usage: npm run drydock:cli -- compatibility <published-source.json>");
  const assessment = assessDrydockCompatibility(sourceSnapshot(sourcePath));
  print(assessment);
  if (!["COMPATIBLE", "COMPATIBLE_WITH_UPCAST", "COMPATIBLE_WITH_WARNINGS"].includes(assessment.status))
    process.exitCode = 1;
} else if (command === "readiness" || command === "publish-check") {
  const inputPath = process.argv[3];
  if (!inputPath) throw new Error(`Usage: npm run drydock:cli -- ${command} <readiness-input.json>`);
  const decision = evaluateDrydockReadiness(readinessInput(inputPath));
  print(decision);
  if (decision.status !== "VERIFIED" && decision.status !== "PUBLISHED") process.exitCode = 1;
} else {
  const evidencePath = process.argv[3];
  if (!evidencePath) throw new Error("Usage: npm run drydock:cli -- evidence-inspect <publishing-evidence.json>");
  const evidence = evidenceInput(evidencePath);
  assertSafeDrydockPublishingEvidencePayload(evidence);
  print(creatorPublishingEvidenceProjection(evidence));
}

function print(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function jsonDocument(path: string, errorCode: string) {
  const bytes = readFileSync(resolve(process.cwd(), path));
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("DRYDOCK_INPUT_SIZE_LIMIT");
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new Error(errorCode);
  }
}

function sourceSnapshot(path: string) {
  return parsePublishedSnapshot(JSON.stringify(jsonDocument(path, "DRYDOCK_SOURCE_INVALID")));
}

function readinessInput(path: string): EvaluateDrydockReadinessInput {
  const candidate = jsonDocument(path, "DRYDOCK_READINESS_INPUT_INVALID");
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
    throw new Error("DRYDOCK_READINESS_INPUT_INVALID");
  const input = candidate as Partial<EvaluateDrydockReadinessInput>;
  if (
    typeof input.sourceChecksum !== "string" ||
    !Array.isArray(input.requirements) ||
    !Array.isArray(input.requiredSuites) ||
    !Array.isArray(input.externalEvidence) ||
    !Array.isArray(input.activeWaiverIssueIds) ||
    !Array.isArray(input.activeWaiverIds)
  )
    throw new Error("DRYDOCK_READINESS_INPUT_INVALID");
  return input as EvaluateDrydockReadinessInput;
}

function evidenceInput(path: string): DrydockPublishingEvidencePayload {
  const candidate = jsonDocument(path, "DRYDOCK_EVIDENCE_INVALID");
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
    throw new Error("DRYDOCK_EVIDENCE_INVALID");
  return candidate as DrydockPublishingEvidencePayload;
}
