"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { sha256, stableStringify } = require("../apps/companion/vision-engine-contract.cjs");
const {
  PACKAGE_COMPATIBILITY_STATUSES,
  RELEASE_STATUSES,
  UPDATE_ERROR_CODES,
} = require("../apps/companion/release-governance.cjs");

function read(relative) {
  return JSON.parse(fs.readFileSync(path.resolve(relative), "utf8"));
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const issues = read("release/vision-release-issues.json");
  const compatibility = read("release/compatibility-policy.json");
  const readiness = read("release/release-readiness.json");
  const dataset = read("release/datasets/synthetic-corpus-v1.json");
  const errors = read("release/error-catalog.json");
  const packageJson = read("package.json");
  const requiredIssueFields = [
    "id",
    "category",
    "severity",
    "affectedComponent",
    "title",
    "reproductionSteps",
    "affectedVersions",
    "owner",
    "status",
    "fixCommit",
    "regressionTest",
    "releaseBlocking",
  ];
  const issueIds = new Set();
  for (const issue of issues.issues) {
    invariant(
      requiredIssueFields.every((field) => Object.hasOwn(issue, field)),
      `Issue ${issue.id} is incomplete.`,
    );
    invariant(!issueIds.has(issue.id), `Issue ${issue.id} is duplicated.`);
    issueIds.add(issue.id);
    invariant(
      ["BLOCKER", "CRITICAL", "MAJOR", "MINOR", "DOCUMENTATION", "DEFERRED_NON_PHASE_B"].includes(issue.category),
      `Issue ${issue.id} has an invalid category.`,
    );
    invariant(
      Array.isArray(issue.reproductionSteps) && issue.reproductionSteps.length > 0,
      `Issue ${issue.id} has no reproduction.`,
    );
    if (issue.status === "CLOSED") {
      invariant(
        typeof issue.fixCommit === "string" && issue.fixCommit.length >= 7,
        `Closed issue ${issue.id} lacks a fix commit.`,
      );
      invariant(
        typeof issue.regressionTest === "string" && issue.regressionTest.length > 0,
        `Closed issue ${issue.id} lacks a regression test.`,
      );
    }
  }
  const openBlockers = issues.issues.filter(
    (issue) => issue.releaseBlocking && !["CLOSED", "RESOLVED"].includes(issue.status),
  );
  invariant(readiness.version === packageJson.version, "Readiness version differs from package.json.");
  invariant(readiness.releaseId === issues.releaseId, "Readiness and issue register release IDs differ.");
  invariant(RELEASE_STATUSES.includes(readiness.releaseStatus), "Readiness release status is invalid.");
  if (openBlockers.length) {
    invariant(readiness.readiness === "NO_GO", "Open blockers require NO_GO readiness.");
    invariant(readiness.releaseStatus !== "STABLE", "Open blockers forbid Stable feature status.");
  }
  const components = new Set();
  for (const rule of compatibility.components) {
    invariant(!components.has(rule.component), `Compatibility component ${rule.component} is duplicated.`);
    components.add(rule.component);
    invariant(RELEASE_STATUSES.includes(rule.status), `Compatibility status ${rule.status} is invalid.`);
  }
  for (const required of [
    "WEB_APPLICATION",
    "DESKTOP_APPLICATION",
    "COMPANION_SERVICE",
    "SERVER_API",
    "COMPANION_PROTOCOL",
    "WAYPOINT_BUILD_INPUT_SCHEMA",
    "RUNTIME_PACKAGE_SCHEMA",
    "STORY_PACKAGE_SCHEMA",
    "MODEL_BUNDLE",
    "VISION_ENGINE",
    "DATABASE_SCHEMA",
  ])
    invariant(components.has(required), `Compatibility component ${required} is missing.`);
  for (const feature of compatibility.featureStatuses)
    invariant(RELEASE_STATUSES.includes(feature.status), `Feature ${feature.feature} has an invalid status.`);
  invariant(
    PACKAGE_COMPATIBILITY_STATUSES.length === 6 &&
      PACKAGE_COMPATIBILITY_STATUSES.every((status) => compatibility.packageStatuses.includes(status)),
    "Package compatibility statuses are incomplete.",
  );

  const expectedManifestHash = `sha256:${sha256(stableStringify({ ...dataset, manifestHash: null }))}`;
  invariant(dataset.manifestHash === expectedManifestHash, "Dataset manifest hash is invalid.");
  invariant(new Set(dataset.partitions).size === dataset.partitions.length, "Dataset partitions are duplicated.");
  const caseIds = new Set();
  const hashesByPartition = new Map();
  for (const testCase of dataset.cases) {
    invariant(!caseIds.has(testCase.id), `Dataset case ${testCase.id} is duplicated.`);
    caseIds.add(testCase.id);
    invariant(dataset.partitions.includes(testCase.partition), `Dataset case ${testCase.id} has an unknown partition.`);
    invariant(/^sha256:[a-f0-9]{64}$/.test(testCase.assetHash), `Dataset case ${testCase.id} has no valid hash.`);
    invariant(testCase.truthLabel?.reviewed === true, `Dataset case ${testCase.id} has no reviewed truth label.`);
    const existingPartition = hashesByPartition.get(testCase.assetHash);
    invariant(
      !existingPartition || existingPartition === testCase.partition,
      `Dataset asset ${testCase.assetHash} leaks across ${existingPartition} and ${testCase.partition}.`,
    );
    hashesByPartition.set(testCase.assetHash, testCase.partition);
  }
  invariant(dataset.evidenceClass === "SYNTHETIC_MATHEMATICAL_FIXTURE", "Synthetic corpus evidence class changed.");

  const errorCodes = new Set();
  for (const error of errors.errors) {
    invariant(!errorCodes.has(error.code), `Error code ${error.code} is duplicated.`);
    errorCodes.add(error.code);
    invariant(
      ["code", "class", "userExplanation", "recommendedRecovery", "technicalContext", "privacy"].every(
        (field) => typeof error[field] === "string" && error[field].length > 0,
      ),
      `Error code ${error.code} is incomplete.`,
    );
  }
  for (const code of UPDATE_ERROR_CODES.filter((code) =>
    [
      "UPDATE_SIGNATURE_INVALID",
      "UPDATE_HASH_MISMATCH",
      "UPDATE_ACTIVE_SESSION",
      "UPDATE_HEALTH_CHECK_FAILED",
    ].includes(code),
  ))
    invariant(errorCodes.has(code), `Public update error ${code} is undocumented.`);
  for (const migration of [
    "prisma/migrations/20260719010000_vision_release_hardening_b6/migration.sql",
    "prisma/mysql-migrations/0010_vision_release_hardening_b6/migration.sql",
  ])
    invariant(fs.existsSync(path.resolve(migration)), `Required migration ${migration} is missing.`);

  const result = {
    verified: true,
    releaseId: readiness.releaseId,
    version: readiness.version,
    readiness: readiness.readiness,
    openBlockers: openBlockers.length,
    totalIssues: issues.issues.length,
    datasetCases: dataset.cases.length,
    datasetManifestHash: dataset.manifestHash,
    compatibilityComponents: components.size,
    errorCodes: errorCodes.size,
    stablePromotionAllowed: openBlockers.length === 0,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (process.argv.includes("--require-go") && !result.stablePromotionAllowed) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({ verified: false, code: "B6_RELEASE_STATE_INVALID", message: error.message }, null, 2)}\n`,
  );
  process.exitCode = 1;
}
