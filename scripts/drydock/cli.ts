import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import fixture from "../../tests/fixtures/drydock/current-authoring-v1.json";
import { parsePublishedSnapshot } from "../../src/chronicle/publishing";
import { assessDrydockCompatibility } from "../../src/drydock/compatibility";
import {
  assertSafeDrydockPublishingEvidencePayload,
  creatorPublishingEvidenceProjection,
  type DrydockPublishingEvidencePayload,
} from "../../src/drydock/publishing-evidence";
import { evaluateDrydockReadiness, type EvaluateDrydockReadinessInput } from "../../src/drydock/readiness";
import { canonicalChecksum } from "../../src/drydock/canonical";
import { parseDrydockBlock } from "../../src/drydock/contracts/parser";
import { serializeDrydockBlockContractRegistry } from "../../src/drydock/contracts/registry";
import type { DrydockAuthoredBlockInput } from "../../src/drydock/contracts/model";
import { sanitizedIssueProjection } from "../../src/drydock/issues";
import { validateDrydockDraftContracts, type DrydockDraftContractInput } from "../../src/drydock/incremental";
import { drydockProviderRegistry } from "../../src/drydock/providers";
import { createDrydockCoverageReport } from "../../src/drydock/simulation/coverage";
import { runDrydockScenario } from "../../src/drydock/simulation/engine";
import { exploreDrydockScenario } from "../../src/drydock/simulation/explore";
import { parseDrydockScenario } from "../../src/drydock/simulation/schema";
import { parseDrydockScenarioSuite } from "../../src/drydock/simulation/suite";
import {
  createDrydockValidationReport,
  diffDrydockReports,
  supportReportProjection,
  type DrydockValidationReport,
} from "../../src/drydock/reports";

const command = process.argv[2] ?? "help";

function print(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function inputBlocks(path: string): DrydockAuthoredBlockInput[] {
  const absolute = resolve(process.cwd(), path);
  const bytes = readFileSync(absolute);
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("DRYDOCK_INPUT_SIZE_LIMIT");
  const parsed: unknown = JSON.parse(bytes.toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("DRYDOCK_INPUT_INVALID");
  const candidate = parsed as { blocks?: unknown[] };
  return (candidate.blocks ?? [candidate]) as DrydockAuthoredBlockInput[];
}

function fullInput(path: string): DrydockDraftContractInput {
  const absolute = resolve(process.cwd(), path);
  const bytes = readFileSync(absolute);
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("DRYDOCK_INPUT_SIZE_LIMIT");
  const parsed: unknown = JSON.parse(bytes.toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("DRYDOCK_INPUT_INVALID");
  const candidate = parsed as DrydockDraftContractInput;
  if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.chapters))
    throw new Error("DRYDOCK_FULL_INPUT_INVALID");
  return { ...candidate, analysisMode: "FULL" };
}

function reportInput(path: string): DrydockValidationReport {
  const absolute = resolve(process.cwd(), path);
  const bytes = readFileSync(absolute);
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("DRYDOCK_INPUT_SIZE_LIMIT");
  const parsed: unknown = JSON.parse(bytes.toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("DRYDOCK_REPORT_INVALID");
  const report = parsed as Partial<DrydockValidationReport>;
  if (
    report.schemaVersion !== 1 ||
    !Array.isArray(report.issues) ||
    typeof report.sourceChecksum !== "string" ||
    typeof report.runId !== "string"
  )
    throw new Error("DRYDOCK_REPORT_INVALID");
  return report as DrydockValidationReport;
}

function jsonDocument(path: string, errorCode: string) {
  const absolute = resolve(process.cwd(), path);
  const bytes = readFileSync(absolute);
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
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("DRYDOCK_READINESS_INPUT_INVALID");
  const input = candidate as Partial<EvaluateDrydockReadinessInput>;
  if (
    typeof input.sourceChecksum !== "string" ||
    !Array.isArray(input.requirements) ||
    !Array.isArray(input.requiredSuites) ||
    !Array.isArray(input.externalEvidence) ||
    !Array.isArray(input.activeWaiverIssueIds) ||
    !Array.isArray(input.activeWaiverIds)
  ) throw new Error("DRYDOCK_READINESS_INPUT_INVALID");
  return input as EvaluateDrydockReadinessInput;
}

function evidenceInput(path: string): DrydockPublishingEvidencePayload {
  const candidate = jsonDocument(path, "DRYDOCK_EVIDENCE_INVALID");
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("DRYDOCK_EVIDENCE_INVALID");
  return candidate as DrydockPublishingEvidencePayload;
}

function simulationRun(sourcePath: string, scenarioPath: string) {
  const snapshot = sourceSnapshot(sourcePath);
  const scenario = parseDrydockScenario(jsonDocument(scenarioPath, "DRYDOCK_SCENARIO_INVALID"));
  const result = runDrydockScenario(snapshot, scenario);
  print({
    sourceChecksum: result.sourceChecksum,
    scenarioId: result.scenarioId,
    scenarioRevision: result.scenarioRevision,
    status: result.status,
    traceDigest: result.traceDigest,
    coverage: result.coverage,
    assertions: result.assertions,
    trace: result.trace,
  });
  if (result.assertions.some((assertion) => !assertion.passed)) process.exitCode = 1;
  return result;
}

function supportReportDiff(previous: DrydockValidationReport, next: DrydockValidationReport) {
  const diff = diffDrydockReports(previous, next);
  const safe = (issue: { id: string; code: string; category: string; severity: string; ruleVersion: number }) => ({
    id: issue.id,
    code: issue.code,
    category: issue.category,
    severity: issue.severity,
    ruleVersion: issue.ruleVersion,
  });
  return {
    sourceChanged: diff.sourceChanged,
    proofCompletenessChanged: diff.proofCompletenessChanged,
    compatibilityChanged: diff.compatibilityChanged,
    introduced: diff.introduced.map(safe),
    resolved: diff.resolved.map(safe),
    retained: diff.retained.map(safe),
    severityChanged: diff.severityChanged.map(({ before, after }) => ({ before: safe(before), after: safe(after) })),
    ruleVersionChanged: diff.ruleVersionChanged.map(({ before, after }) => ({
      before: safe(before),
      after: safe(after),
    })),
    locationChanged: diff.locationChanged.map(({ before, after }) => ({ before: safe(before), after: safe(after) })),
  };
}

function validate(blocks: readonly DrydockAuthoredBlockInput[]) {
  const results = blocks.map((block) => {
    const parsed = parseDrydockBlock(block);
    return {
      id: block.id,
      blockType: block.blockType,
      valid: parsed.success,
      migrationsApplied: parsed.migrationsApplied,
      compatibilityStatus: parsed.success ? "CURRENT" : parsed.compatibilityStatus,
      issues: parsed.issues.map(sanitizedIssueProjection),
      ...(parsed.success
        ? {
            schemaVersion: parsed.block.schemaVersion,
            checksum: canonicalChecksum(parsed.block),
          }
        : {}),
    };
  });
  print({ schemaVersion: 1, valid: results.every((result) => result.valid), checked: results.length, results });
  if (results.some((result) => !result.valid)) process.exitCode = 1;
}

if (command === "registry") print({ schemaVersion: 1, contracts: serializeDrydockBlockContractRegistry() });
else if (command === "migrations")
  print({
    schemaVersion: 1,
    migrations: serializeDrydockBlockContractRegistry().flatMap((contract) => contract.migrations),
  });
else if (command === "versions")
  print({
    schemaVersion: 1,
    versions: serializeDrydockBlockContractRegistry().map((contract) => ({
      blockType: contract.type,
      currentVersion: contract.currentVersion,
      minimumReaderVersion: contract.minimumReaderVersion,
    })),
  });
else if (command === "validate-registry") {
  const contracts = serializeDrydockBlockContractRegistry();
  const identities = contracts.map((contract) => `${contract.type}:${contract.currentVersion}`);
  const valid = contracts.length === 23 && new Set(identities).size === identities.length;
  print({ schemaVersion: 1, valid, contractCount: contracts.length, identities });
  if (!valid) process.exitCode = 1;
} else if (command === "verify-migrations") {
  const results = (fixture.blocks as DrydockAuthoredBlockInput[]).map((block) => {
    const parsed = parseDrydockBlock(block);
    const expected = `drydock.${block.blockType}.v1-to-v2`;
    return {
      fixtureId: block.id,
      blockType: block.blockType,
      valid: parsed.success && parsed.migrationsApplied.length === 1 && parsed.migrationsApplied[0] === expected,
      expectedMigrationId: expected,
      observedMigrationIds: parsed.migrationsApplied,
    };
  });
  const valid = results.every((result) => result.valid);
  print({ schemaVersion: 1, valid, checked: results.length, results });
  if (!valid) process.exitCode = 1;
} else if (command === "providers")
  print({
    schemaVersion: 1,
    providers: Object.values(drydockProviderRegistry).map((provider) => ({
      id: provider.id,
      version: provider.version,
      owner: provider.owner,
      state: provider.state,
      privacyClass: provider.privacyClass,
      requiresFallback: provider.requiresFallback,
      captainOverride: provider.captainOverride,
    })),
  });
else if (command === "validate-fixtures") validate(fixture.blocks as DrydockAuthoredBlockInput[]);
else if (command === "canonicalize-fixtures") {
  const results = (fixture.blocks as DrydockAuthoredBlockInput[]).map((block) => {
    const parsed = parseDrydockBlock(block);
    if (!parsed.success) throw new Error(`DRYDOCK_FIXTURE_INVALID:${block.blockType}`);
    return {
      fixtureId: block.id,
      blockType: block.blockType,
      schemaVersion: parsed.block.schemaVersion,
      canonicalBytes: Buffer.byteLength(JSON.stringify(parsed.block), "utf8"),
      checksum: canonicalChecksum(parsed.block),
    };
  });
  print({ schemaVersion: 1, classification: fixture.classification, results });
} else if (command === "validate") {
  const path = process.argv[3];
  if (!path) throw new Error("Usage: npm run drydock:cli -- validate <json-path>");
  validate(inputBlocks(path));
} else if (command === "full-validate") {
  const path = process.argv[3];
  if (!path) throw new Error("Usage: npm run drydock:cli -- full-validate <json-path>");
  const input = fullInput(path);
  const result = validateDrydockDraftContracts(input);
  const assetProofIncomplete = result.staticIssues.some((issue) => issue.code === "DRYDOCK_ASSET_PROOF_INCOMPLETE");
  const report = createDrydockValidationReport({
    source: input,
    issues: result.issues,
    proofCompleteness:
      result.stateAnalysis.status === "PROVEN" &&
      result.graphAnalysis.proofCompleteness === "COMPLETE" &&
      !assetProofIncomplete
        ? "COMPLETE"
        : "INCOMPLETE_PROOF",
    analysisLimits: [
      ...(result.stateAnalysis.status === "PROVEN" ? [] : [`state-iterations:${result.stateAnalysis.iterations}`]),
      ...(result.graphAnalysis.proofCompleteness === "COMPLETE" ? [] : ["legacy-edge-condition-adapter-unavailable"]),
      ...(assetProofIncomplete ? ["asset-snapshot-unavailable"] : []),
    ],
  });
  print({
    report,
    supportProjection: supportReportProjection(report),
    checkedBlockCount: result.checkedBlockCount,
    stateProof: result.stateAnalysis.status,
  });
  if (report.status !== "VALID") process.exitCode = 1;
} else if (command === "report-diff") {
  const previousPath = process.argv[3];
  const nextPath = process.argv[4];
  if (!previousPath || !nextPath)
    throw new Error("Usage: npm run drydock:cli -- report-diff <previous-report.json> <next-report.json>");
  print(supportReportDiff(reportInput(previousPath), reportInput(nextPath)));
} else if (command === "scenario-validate") {
  const scenarioPath = process.argv[3];
  if (!scenarioPath) throw new Error("Usage: npm run drydock:cli -- scenario-validate <scenario.json>");
  const scenario = parseDrydockScenario(jsonDocument(scenarioPath, "DRYDOCK_SCENARIO_INVALID"));
  print({ valid: true, scenarioId: scenario.id, revision: scenario.revision, sourceChecksum: scenario.sourceChecksum });
} else if (command === "scenario-run" || command === "trace-replay") {
  const sourcePath = process.argv[3];
  const scenarioPath = process.argv[4];
  if (!sourcePath || !scenarioPath)
    throw new Error(`Usage: npm run drydock:cli -- ${command} <source.json> <scenario.json>`);
  simulationRun(sourcePath, scenarioPath);
} else if (command === "suite-run") {
  const sourcePath = process.argv[3];
  const suitePath = process.argv[4];
  const scenarioPaths = process.argv.slice(5);
  if (!sourcePath || !suitePath || !scenarioPaths.length)
    throw new Error("Usage: npm run drydock:cli -- suite-run <source.json> <suite.json> <scenario.json> [...]");
  const snapshot = sourceSnapshot(sourcePath);
  const suite = parseDrydockScenarioSuite(jsonDocument(suitePath, "DRYDOCK_SUITE_INVALID"));
  const scenarios = scenarioPaths.map((path) => parseDrydockScenario(jsonDocument(path, "DRYDOCK_SCENARIO_INVALID")));
  const ordered = suite.members.map((member) => {
    const scenario = scenarios.find(
      (candidate) => candidate.id === member.scenarioId && candidate.revision === member.revision,
    );
    if (!scenario) throw new Error(`DRYDOCK_SUITE_MEMBER_MISSING:${member.scenarioId}:${member.revision}`);
    return runDrydockScenario(snapshot, scenario);
  });
  const coverage = createDrydockCoverageReport(snapshot, ordered);
  print({
    suiteId: suite.id,
    sourceChecksum: suite.sourceChecksum,
    results: ordered.map((result) => ({
      scenarioId: result.scenarioId,
      status: result.status,
      traceDigest: result.traceDigest,
      assertions: result.assertions,
    })),
    coverage,
  });
  if (ordered.some((result) => result.assertions.some((assertion) => !assertion.passed))) process.exitCode = 1;
} else if (command === "coverage-report") {
  const sourcePath = process.argv[3];
  const scenarioPaths = process.argv.slice(4);
  if (!sourcePath || !scenarioPaths.length)
    throw new Error("Usage: npm run drydock:cli -- coverage-report <source.json> <scenario.json> [...]");
  const snapshot = sourceSnapshot(sourcePath);
  const results = scenarioPaths.map((path) =>
    runDrydockScenario(snapshot, parseDrydockScenario(jsonDocument(path, "DRYDOCK_SCENARIO_INVALID"))),
  );
  print(createDrydockCoverageReport(snapshot, results));
} else if (command === "compatibility") {
  const sourcePath = process.argv[3];
  if (!sourcePath) throw new Error("Usage: npm run drydock:cli -- compatibility <published-source.json>");
  const assessment = assessDrydockCompatibility(sourceSnapshot(sourcePath));
  print(assessment);
  if (!["COMPATIBLE", "COMPATIBLE_WITH_UPCAST", "COMPATIBLE_WITH_WARNINGS"].includes(assessment.status)) process.exitCode = 1;
} else if (command === "readiness") {
  const inputPath = process.argv[3];
  if (!inputPath) throw new Error("Usage: npm run drydock:cli -- readiness <readiness-input.json>");
  const decision = evaluateDrydockReadiness(readinessInput(inputPath));
  print(decision);
  if (decision.status !== "VERIFIED" && decision.status !== "PUBLISHED") process.exitCode = 1;
} else if (command === "evidence-inspect") {
  const evidencePath = process.argv[3];
  if (!evidencePath) throw new Error("Usage: npm run drydock:cli -- evidence-inspect <publishing-evidence.json>");
  const evidence = evidenceInput(evidencePath);
  assertSafeDrydockPublishingEvidencePayload(evidence);
  print(creatorPublishingEvidenceProjection(evidence));
} else if (command === "explore") {
  const sourcePath = process.argv[3];
  const scenarioPath = process.argv[4];
  const profilePath = process.argv[5];
  if (!sourcePath || !scenarioPath || !profilePath)
    throw new Error("Usage: npm run drydock:cli -- explore <source.json> <scenario.json> <finite-profile.json>");
  const profile = jsonDocument(profilePath, "DRYDOCK_EXPLORATION_PROFILE_INVALID") as {
    inputs?: unknown;
    maxDepth?: unknown;
    maxStates?: unknown;
    maxTransitions?: unknown;
  };
  if (
    !Array.isArray(profile.inputs) ||
    !Number.isSafeInteger(profile.maxDepth) ||
    !Number.isSafeInteger(profile.maxStates) ||
    !Number.isSafeInteger(profile.maxTransitions)
  )
    throw new Error("DRYDOCK_EXPLORATION_PROFILE_INVALID");
  print(
    exploreDrydockScenario(
      sourceSnapshot(sourcePath),
      parseDrydockScenario(jsonDocument(scenarioPath, "DRYDOCK_SCENARIO_INVALID")),
      profile as Parameters<typeof exploreDrydockScenario>[2],
    ),
  );
} else
  print({
    commands: [
      "registry",
      "validate-registry",
      "versions",
      "migrations",
      "verify-migrations",
      "providers",
      "validate-fixtures",
      "canonicalize-fixtures",
      "validate <json-path>",
      "full-validate <json-path>",
      "report-diff <previous-report.json> <next-report.json>",
      "scenario-validate <scenario.json>",
      "scenario-run <source.json> <scenario.json>",
      "suite-run <source.json> <suite.json> <scenario.json> [... ]",
      "trace-replay <source.json> <scenario.json>",
      "coverage-report <source.json> <scenario.json> [... ]",
      "compatibility <published-source.json>",
      "readiness <readiness-input.json>",
      "evidence-inspect <publishing-evidence.json>",
      "explore <source.json> <scenario.json> <finite-profile.json>",
    ],
    privacy: "Diagnostics contain contract metadata and sanitized issues only.",
  });
