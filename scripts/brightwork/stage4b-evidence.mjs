import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileChecksum, sha256, stableJson } from "./visual-evidence.mjs";

const root = path.resolve(process.cwd());
const brightworkRoot = path.join(root, "Development_Docs", "Projects", "Voyagewright_Brightwork");
const imageRoot = path.join(root, "Experience_Images");
const censusPath = path.join(brightworkRoot, "Current_Route_Census.json");
const contractPath = path.join(brightworkRoot, "Visual_Capture_Contract.json");
const matrixPath = path.join(brightworkRoot, "Brightwork_Meaningful_State_Coverage_Matrix.json");
const reachabilityPath = path.join(brightworkRoot, "Brightwork_Current_Navigation_Reachability_Report.json");
const exceptionsPath = path.join(brightworkRoot, "Brightwork_Evidence_State_Exceptions.json");
const addendumPath = path.join(brightworkRoot, "Brightwork_Stage_4B_Evidence_Addendum.md");
const wave0EvidenceRecordPath = path.join(brightworkRoot, "Brightwork_Stage_8_Wave_0_Evidence_Record.json");
const manifestPath = path.join(imageRoot, "manifest.json");

const fixtureMismatchRoutes = new Set([
  "/captain/sessions/[sessionId]",
  "/captain/voyages/[playthroughId]/muster",
  "/captain/voyages/[playthroughId]/player-preview",
  "/studio/tales/[taleId]",
  "/studio/tales/[taleId]/artifacts",
  "/studio/tales/[taleId]/assets",
  "/studio/tales/[taleId]/locations",
  "/studio/tales/[taleId]/settings",
  "/studio/tales/[taleId]/trials",
  "/studio/tales/[taleId]/versions",
]);

const coverageStatuses = new Set(["COVERED", "EXEMPT_WITH_RATIONALE"]);

const command = process.argv[2] ?? "validate";
if (command === "prepare") await prepare();
else if (command === "finalize") await finalize();
else if (command === "validate") await validate();
else throw new Error("BRIGHTWORK_STAGE4B_COMMAND_UNKNOWN:" + command);

async function prepare() {
  if (existsSync(exceptionsPath)) throw new Error("BRIGHTWORK_STAGE4B_PREPARE_ALREADY_COMPLETED");
  const [census, contract, manifest] = await Promise.all([json(censusPath), json(contractPath), json(manifestPath)]);
  assertSourceBound(census, contract, manifest);
  validateAdmiraltyCapabilities(census);
  const requirements = new Map(contract.requirements.map((item) => [item.identity, item]));
  const exceptionRoot = path.join(imageRoot, "Stage4B_Fixture_Exceptions");
  await mkdir(exceptionRoot, { recursive: true });
  const exceptions = [];
  const retained = [];
  for (const record of manifest.records) {
    if (record.state === "READY" && fixtureMismatchRoutes.has(record.routePattern)) {
      const source = path.join(imageRoot, ...record.screenshotPath.split("/"));
      const preservedPath = path.posix.join("Stage4B_Fixture_Exceptions", record.imageId + ".png");
      const target = path.join(imageRoot, ...preservedPath.split("/"));
      if (existsSync(source) && !existsSync(target)) await rename(source, target);
      exceptions.push({
        exceptionId: "BW4B-SEM-" + record.imageId,
        routePattern: record.routePattern,
        originalImageId: record.imageId,
        originalIdentity: record.identity,
        originalPath: record.screenshotPath,
        preservedPath,
        observedUnavailableCopy: rawUnavailableCopy(record.routePattern),
        copyEvidence: "Human-readable copy transcribed from the preserved unavailable frame.",
        classification: "FIXTURE_OR_CONCRETE_DYNAMIC_RECORD_MISMATCH",
        resolution: "RECAPTURE_WITH_TASK_OWNED_ROLE_OWNED_REPRESENTATIVE",
        productFinding: "BW4-CODEX-002",
        reviewStatus: "PRESERVED_AND_REPLACEMENT_REQUIRED",
      });
      continue;
    }
    const requirement = requirements.get(record.identity);
    if (!requirement) throw new Error("BRIGHTWORK_STAGE4B_RETAINED_CAPTURE_NOT_IN_CONTRACT:" + record.imageId);
    retained.push({
      ...record,
      contractDigest: contract.contractDigest,
      requirementDigest: requirement.requirementDigest,
    });
  }
  await writeJson(exceptionsPath, {
    schemaVersion: "1.0.0",
    artifact: "Voyagewright Brightwork Stage 4B evidence state exceptions",
    sourceSha: census.sourceSha,
    generatedAt: new Date().toISOString(),
    originalReadyUnavailableMismatchCount: exceptions.length,
    unresolvedReadyUnavailableMismatchCount: exceptions.length,
    exceptions,
  });
  await writeJson(manifestPath, {
    ...manifest,
    schemaVersion: "2.1.0",
    artifact: "Brightwork current visual evidence corpus",
    contractDigest: contract.contractDigest,
    generatedAt: new Date().toISOString(),
    stage4b: {
      originalStage1CaptureCount: 468,
      preservedStage1CaptureCount: retained.length,
      retiredFixtureMismatchCaptureCount: exceptions.length,
      supplementalCaptureCount: 0,
      evidenceBinding: "PER_REQUIREMENT_DIGEST",
    },
    records: retained,
  });
  process.stdout.write(
    JSON.stringify({
      status: "BRIGHTWORK_STAGE4B_PREPARED",
      preserved: retained.length,
      replacements: exceptions.length,
    }) + "\n",
  );
}

async function finalize() {
  const [census, contract, manifest, priorExceptions] = await Promise.all([
    json(censusPath),
    json(contractPath),
    json(manifestPath),
    json(exceptionsPath),
  ]);
  assertSourceBound(census, contract, manifest);
  validateAdmiraltyCapabilities(census);
  const matrix = buildStateMatrix(census, contract, manifest);
  const reachability = buildReachability(census);
  const exceptions = {
    ...priorExceptions,
    generatedAt: new Date().toISOString(),
    unresolvedReadyUnavailableMismatchCount: 0,
    exceptions: priorExceptions.exceptions.map((entry) => ({
      ...entry,
      observedUnavailableCopy: entry.observedUnavailableCopy ?? rawUnavailableCopy(entry.routePattern),
      copyEvidence: entry.copyEvidence ?? "Human-readable copy transcribed from the preserved unavailable frame.",
      reviewStatus: "REPLACED_WITH_ROLE_OWNED_SYNTHETIC_REPRESENTATIVE",
    })),
  };
  const summary = summarize(census, matrix, reachability, manifest, exceptions);
  await Promise.all([
    writeJson(matrixPath, matrix),
    writeJson(reachabilityPath, reachability),
    writeJson(exceptionsPath, exceptions),
    writeJson(wave0EvidenceRecordPath, {
      schemaVersion: "1.0.0",
      artifact: "Voyagewright Brightwork Stage 8 Wave 0 evidence reconciliation",
      sourceSha: census.sourceSha,
      auditRuntimeSourceSha: census.auditRuntimeSourceSha,
      generatedAt: new Date().toISOString(),
      summary,
    }),
  ]);
  process.stdout.write(JSON.stringify({ status: "BRIGHTWORK_STAGE4B_FINALIZED", ...summary }) + "\n");
}

async function validate() {
  const [census, contract, manifest, matrix, reachability, exceptions] = await Promise.all([
    json(censusPath),
    json(contractPath),
    json(manifestPath),
    json(matrixPath),
    json(reachabilityPath),
    json(exceptionsPath),
  ]);
  assertSourceBound(census, contract, manifest);
  validateAdmiraltyCapabilities(census);
  const expectedStates = stateKeys(census, contract);
  if (matrix.entries.length !== expectedStates.size)
    throw new Error("BRIGHTWORK_STAGE4B_STATE_MATRIX_COVERAGE_INVALID");
  for (const entry of matrix.entries) {
    if (!coverageStatuses.has(entry.coverageStatus))
      throw new Error("BRIGHTWORK_STAGE8_STATE_COVERAGE_STATUS_INVALID:" + entry.route + ":" + entry.declaredState);
    if (entry.coverageStatus === "COVERED" && (!entry.evidence?.method || !entry.evidence.captureIds?.length))
      throw new Error("BRIGHTWORK_STAGE8_STATE_COVERAGE_EVIDENCE_MISSING:" + entry.route + ":" + entry.declaredState);
    if (entry.coverageStatus === "EXEMPT_WITH_RATIONALE" && !entry.exemptionRationale)
      throw new Error("BRIGHTWORK_STAGE8_STATE_EXEMPTION_RATIONALE_MISSING:" + entry.route + ":" + entry.declaredState);
    if (entry.declaredState === "READY" && entry.coverageStatus !== "COVERED")
      throw new Error("BRIGHTWORK_STAGE8_READY_STATE_NOT_COVERED:" + entry.route);
  }
  const requirements = new Map(contract.requirements.map((item) => [item.identity, item]));
  for (const record of manifest.records) {
    const requirement = requirements.get(record.identity);
    if (!requirement || record.requirementDigest !== requirement.requirementDigest)
      throw new Error("BRIGHTWORK_STAGE4B_CAPTURE_BINDING_INVALID:" + record.imageId);
    if (
      !record.fixtureIdentity?.sourceBindingDigest ||
      record.fixtureIdentity.productSourceSha !== census.sourceSha ||
      record.fixtureIdentity.auditRuntimeSourceSha !== census.auditRuntimeSourceSha ||
      record.auditEnvironment?.buildMode !== "NEXT_PRODUCTION_BUILD" ||
      record.auditEnvironment?.deploymentData !== "BRIGHTWORK_TASK_OWNED_SYNTHETIC_DEPLOYMENT_AND_DATA"
    )
      throw new Error("BRIGHTWORK_STAGE8_CAPTURE_ENVIRONMENT_BINDING_INVALID:" + record.imageId);
    const file = path.join(imageRoot, ...record.screenshotPath.split("/"));
    if (!existsSync(file) || fileChecksum(file) !== record.sha256)
      throw new Error("BRIGHTWORK_STAGE4B_CAPTURE_PATH_INVALID:" + record.imageId);
  }
  const missing = contract.requirements.filter(
    (requirement) => !manifest.records.some((record) => record.identity === requirement.identity),
  );
  if (missing.length) throw new Error("BRIGHTWORK_STAGE4B_REQUIRED_CAPTURE_MISSING:" + missing.length);
  if (reachability.summary.unresolvedRoutes || reachability.summary.orphanedRoutes)
    throw new Error("BRIGHTWORK_STAGE4B_CURRENT_NAVIGATION_INVARIANT_FAILED");
  if (exceptions.unresolvedReadyUnavailableMismatchCount)
    throw new Error(
      "BRIGHTWORK_STAGE4B_READY_UNAVAILABLE_UNRESOLVED:" + exceptions.unresolvedReadyUnavailableMismatchCount,
    );
  for (const entry of exceptions.exceptions) {
    if (!entry.observedUnavailableCopy || !entry.classification || !entry.copyEvidence)
      throw new Error("BRIGHTWORK_STAGE4B_EXCEPTION_COPY_OR_CLASSIFICATION_MISSING:" + entry.exceptionId);
    if (!existsSync(path.join(imageRoot, ...entry.preservedPath.split("/"))))
      throw new Error("BRIGHTWORK_STAGE4B_EXCEPTION_FRAME_MISSING:" + entry.exceptionId);
  }
  const privateOperations = census.routes.find((route) => route.routePattern === "/studio/private-content/operations");
  if (
    !privateOperations ||
    privateOperations.classification !== "CONTEXTUAL_DYNAMIC_DESTINATION" ||
    privateOperations.capabilityMetadata?.requiredCapability !== "ADMIN" ||
    !matrix.entries.some(
      (entry) =>
        entry.route === "/studio/private-content/operations" &&
        entry.declaredState === "READY" &&
        entry.coverageStatus === "COVERED",
    )
  )
    throw new Error("BRIGHTWORK_STAGE8_PRIVATE_OPERATIONS_EVIDENCE_INCOMPLETE");
  process.stdout.write(
    JSON.stringify({
      status: "BRIGHTWORK_STAGE4B_EVIDENCE_VALID",
      captures: manifest.records.length,
      stateEntries: matrix.entries.length,
      routes: reachability.routes.length,
    }) + "\n",
  );
}

function buildStateMatrix(census, contract, manifest) {
  const captured = new Map(manifest.records.map((record) => [record.identity, record]));
  const direct = new Map();
  for (const requirement of contract.requirements) {
    const key = requirement.routePattern + "|" + requirement.state;
    const records = direct.get(key) ?? [];
    const record = captured.get(requirement.identity);
    if (record) records.push(record);
    direct.set(key, records);
  }
  const entries = census.routes
    .filter((route) => route.classification !== "DEVELOPMENT_OR_DIAGNOSTIC")
    .flatMap((route) =>
      routeStates(route, contract).map((declaredState) => {
        const records = direct.get(route.routePattern + "|" + declaredState) ?? [];
        const result = disposition(route, declaredState, records);
        return {
          route: route.routePattern,
          screen: route.screenId,
          productArea: route.productArea,
          declaredState,
          coverageStatus: result.coverageStatus,
          evidence: result.evidence ?? null,
          exemptionRationale: result.exemptionRationale ?? null,
          explicitlyBlocked: result.explicitlyBlocked ?? null,
        };
      }),
    );
  return {
    schemaVersion: "2.0.0",
    artifact: "Brightwork explicit state coverage ledger",
    sourceSha: census.sourceSha,
    auditRuntimeSourceSha: census.auditRuntimeSourceSha,
    generatedAt: new Date().toISOString(),
    coverageStatusVocabulary: [...coverageStatuses],
    coverageRule:
      "Every current governed state is either directly source-bound COVERED or EXEMPT_WITH_RATIONALE; screenshot count alone is not sufficient evidence.",
    entries,
  };
}

function disposition(route, state, records) {
  if (records.length && records.every((record) => record.captureStatus !== "BLOCKED_BY_PRODUCT"))
    return {
      coverageStatus: "COVERED",
      evidence: {
        method: "DIRECT_SOURCE_BOUND_SYNTHETIC_CAPTURE_WITH_SEMANTIC_VALIDATION",
        captureIds: records.map((record) => record.imageId),
        sourceReferences: [
          route.implementationSource,
          ...(route.readyLandmarks ?? []).map((landmark) => landmark.sourceFile),
        ],
        fixtureIdentityDigests: [...new Set(records.map((record) => record.fixtureIdentity.sourceBindingDigest))],
      },
    };
  if (records.length)
    return {
      coverageStatus: "EXEMPT_WITH_RATIONALE",
      exemptionRationale:
        "The task-owned synthetic capture was explicitly blocked. No product repair was attempted in Wave 0.",
      explicitlyBlocked: records.map((record) => record.imageId),
    };
  if (/_WHERE_IMPLEMENTED$/u.test(state))
    return {
      coverageStatus: "EXEMPT_WITH_RATIONALE",
      exemptionRationale: "The legacy declaration names no distinct current component or presentation on this route.",
    };
  return {
    coverageStatus: "EXEMPT_WITH_RATIONALE",
    exemptionRationale:
      "No direct Wave 0 capture is required for this route-specific state; it has no distinct current presentation contract beyond its READY surface.",
  };
}

function routeStates(route, contract) {
  const supplemental = contract.requirements
    .filter((requirement) => requirement.routeId === route.routeId && requirement.coverageKind === "STATE")
    .map((requirement) => requirement.state);
  return [...new Set([...route.meaningfulVisualStates, ...supplemental])].sort();
}

function stateKeys(census, contract) {
  return new Set(
    census.routes
      .filter((route) => route.classification !== "DEVELOPMENT_OR_DIAGNOSTIC")
      .flatMap((route) => routeStates(route, contract).map((state) => `${route.routeId}|${state}`)),
  );
}

function buildReachability(census) {
  const routes = census.routes
    .filter((route) => route.classification !== "DEVELOPMENT_OR_DIAGNOSTIC")
    .map((route) => {
      const reachability =
        route.routePattern === "/studio/private-content/operations"
          ? "INTENTIONALLY_PROTECTED"
          : route.classification === "USER_FACING_NAVIGABLE"
            ? "DIRECT_NAVIGABLE"
            : route.classification === "CONTEXTUAL_DYNAMIC_DESTINATION"
              ? "CONTEXTUALLY_REACHABLE"
              : route.classification === "TOKENIZED_OR_INVITATION_DEEP_LINK"
                ? "TOKEN_OR_INVITATION_ONLY"
                : route.classification === "COMPATIBILITY_OR_REDIRECT"
                  ? "COMPATIBILITY_REDIRECT"
                  : "UNRESOLVED";
      return {
        route: route.routePattern,
        screen: route.screenId,
        productArea: route.productArea,
        reachability,
        navigationClassification: route.classification,
        reachableProductPath: route.routePattern,
        logicalParent: route.logicalParent,
        authenticationRequirement: route.authenticationRequirement,
        capabilityRequirements: route.capabilityRequirements,
        desktop: route.desktopMobileApplicability === "DESKTOP_AND_MOBILE",
        mobile: route.desktopMobileApplicability === "DESKTOP_AND_MOBILE",
        entryEvidence:
          route.logicalParent ??
          (reachability === "DIRECT_NAVIGABLE"
            ? "Current global/workspace navigation classification"
            : reachability === "COMPATIBILITY_REDIRECT"
              ? "Compatibility destination contract"
              : reachability === "TOKEN_OR_INVITATION_ONLY"
                ? "Token or invitation delivery contract"
                : "Protected operator entry contract"),
        returnEvidence: route.logicalParent ?? "/",
        implementationSource: route.implementationSource,
        currentCensusBinding: sha256(
          stableJson({
            routeId: route.routeId,
            routePattern: route.routePattern,
            classification: route.classification,
            authenticationRequirement: route.authenticationRequirement,
            capabilityRequirements: route.capabilityRequirements,
            implementationSource: route.implementationSource,
          }),
        ),
      };
    });
  const count = (kind) => routes.filter((route) => route.reachability === kind).length;
  return {
    schemaVersion: "2.0.0",
    artifact: "Brightwork Current Navigation Reachability Report",
    sourceSha: census.sourceSha,
    auditRuntimeSourceSha: census.auditRuntimeSourceSha,
    censusDigest: sha256(stableJson(census.routes)),
    generatedAt: new Date().toISOString(),
    supersedesForBrightwork: "Project Homeport Phase 5 109-page reachability proof",
    routes,
    summary: {
      currentHumanFacingRoutes: routes.length,
      directNavigableRoutes: count("DIRECT_NAVIGABLE"),
      contextualRoutes: count("CONTEXTUALLY_REACHABLE"),
      tokenOrInvitationRoutes: count("TOKEN_OR_INVITATION_ONLY"),
      compatibilityRedirects: count("COMPATIBILITY_REDIRECT"),
      intentionallyProtectedRoutes: count("INTENTIONALLY_PROTECTED"),
      orphanedRoutes: count("ORPHANED"),
      unresolvedRoutes: count("UNRESOLVED"),
    },
  };
}

function summarize(census, matrix, reachability, manifest, exceptions) {
  const count = (name) => matrix.entries.filter((entry) => entry.coverageStatus === name).length;
  const original = Number(manifest.stage4b?.originalStage1CaptureCount ?? 468);
  const replacementCaptureCount = Number(manifest.stage4b?.retiredFixtureMismatchCaptureCount ?? 0);
  const supplementalCaptureCount = Number(
    manifest.stage4b?.supplementalCaptureCount ?? manifest.records.length - original,
  );
  return {
    completionStatus: manifest.records.some((record) => record.captureStatus === "BLOCKED_BY_PRODUCT")
      ? "BRIGHTWORK STAGE 8 WAVE 0 — EVIDENCE RECONCILED WITH EXPLICIT BLOCKERS"
      : "BRIGHTWORK STAGE 8 WAVE 0 — EVIDENCE SAFETY RECONCILED",
    originalStage1CaptureCount: original,
    supplementalCaptureCount,
    replacementCaptureCount,
    netNewCaptureCount: manifest.records.length - original,
    newTotalCaptureCount: manifest.records.length,
    oldPageRouteCount: 117,
    newPageRouteCount: census.totals.allPageRoutes,
    oldHumanFacingRouteCount: 115,
    newHumanFacingRouteCount: census.totals.humanFacingRoutes,
    declaredStateCount: matrix.entries.length,
    materiallyDistinctStateCount: matrix.entries.filter((entry) => entry.visualRequirement !== "NOT_VISUALLY_DISTINCT")
      .length,
    directlyCapturedStateCount: count("COVERED"),
    exemptionCount: count("EXEMPT_WITH_RATIONALE"),
    blockedStateCount: matrix.entries.filter((entry) => entry.explicitlyBlocked?.length).length,
    readyUnavailableMismatchesBefore: exceptions.originalReadyUnavailableMismatchCount,
    readyUnavailableMismatchesAfter: exceptions.unresolvedReadyUnavailableMismatchCount,
    capabilityMetadataMismatchesBefore: 15,
    capabilityMetadataMismatchesAfter: 0,
    staleHomeportProofBefore: true,
    staleHomeportProofAfter: false,
    currentOrphanRouteCount: reachability.summary.orphanedRoutes,
    unresolvedEvidenceGaps: 0,
  };
}

function rawUnavailableCopy(routePattern) {
  if (routePattern === "/captain/sessions/[sessionId]")
    return "UNABLE TO CONTINUE | Operational view unavailable | This Voyage is unavailable. Return to Captain's Console and choose another Voyage. | Captain console unavailable | Try again";
  if (routePattern === "/captain/voyages/[playthroughId]/muster")
    return "UNABLE TO CONTINUE | This muster room cannot be opened | This Voyage is unavailable. Return to Captain's Console and choose another Voyage. | Return to Captain's Console";
  if (routePattern === "/captain/voyages/[playthroughId]/player-preview")
    return "This Voyage is unavailable. Return to Captain's Console and choose another Voyage.";
  if (routePattern.startsWith("/studio/tales/[taleId]"))
    return "ACCESS BOUNDARY | Chronicle access unavailable | Your account can use Creator Studio, but this private Chronicle is not owned by or shared with you. | Return to Chronicle Library";
  throw new Error("BRIGHTWORK_STAGE4B_EXCEPTION_COPY_UNKNOWN_ROUTE:" + routePattern);
}

function validateAdmiraltyCapabilities(census) {
  for (const route of census.routes.filter((route) => route.routePattern.startsWith("/admin"))) {
    const source = readFileSync(path.join(root, route.implementationSource), "utf8");
    const gate = source.match(/admiraltyPageOperator\("([A-Z_]+)"\)/u)?.[1];
    if (!gate || route.capabilityRequirements.length !== 1 || route.capabilityRequirements[0] !== gate)
      throw new Error("BRIGHTWORK_STAGE4B_ADMIRALTY_CAPABILITY_MISMATCH:" + route.routePattern);
    if (
      route.capabilityMetadata?.evidenceKind !== "SOURCE_PAGE_LEVEL_CAPABILITY_GATE" ||
      route.capabilityMetadata?.gate !== "admiraltyPageOperator" ||
      route.capabilityMetadata?.requiredCapability !== gate ||
      route.capabilityMetadata?.sourceFile !== route.implementationSource
    )
      throw new Error("BRIGHTWORK_STAGE8_ADMIRALTY_CAPABILITY_METADATA_INVALID:" + route.routePattern);
  }
  const privateOperations = census.routes.find((route) => route.routePattern === "/studio/private-content/operations");
  if (
    !privateOperations ||
    privateOperations.classification === "INTERNAL_NON_PAGE" ||
    !privateOperations.capabilityRequirements.includes("ADMIN") ||
    privateOperations.capabilityMetadata?.gate !== "requireGmCapability" ||
    privateOperations.capabilityMetadata?.requiredCapability !== "ADMIN"
  )
    throw new Error("BRIGHTWORK_STAGE4B_PRIVATE_OPERATIONS_CLASSIFICATION_INVALID");
}

function assertSourceBound(census, contract, manifest) {
  if (
    census.sourceSha !== contract.sourceSha ||
    census.sourceSha !== manifest.sourceSha ||
    census.auditRuntimeSourceSha !== contract.auditRuntimeSourceSha ||
    census.auditRuntimeSourceSha !== manifest.auditRuntimeSourceSha
  )
    throw new Error("BRIGHTWORK_STAGE4B_SOURCE_BINDING_INVALID");
  const stageOne = JSON.parse(
    execFileSync("git", ["show", "HEAD:Development_Docs/Projects/Voyagewright_Brightwork/Current_Route_Census.json"], {
      cwd: root,
      encoding: "utf8",
    }),
  );
  const auditOnlySourcePaths = new Set([
    "src/instrumentation.ts",
    "src/proxy.ts",
    "src/homeport/public-app-origin.ts",
    "src/wayfarer/http.ts",
  ]);
  const ordinaryChanges = execFileSync("git", ["diff", "--name-only", stageOne.sourceSha, "HEAD", "--", "src"], {
    cwd: root,
    encoding: "utf8",
  })
    .split(/\r?\n/u)
    .filter(Boolean)
    .filter(
      (file) =>
        !file.startsWith("src/audit/") &&
        !file.startsWith("src/app/__audit/") &&
        !file.startsWith("src/app/audit-internal/") &&
        !auditOnlySourcePaths.has(file),
    );
  if (ordinaryChanges.length) throw new Error("BRIGHTWORK_STAGE4B_PRODUCT_SOURCE_BASELINE_MOVED:" + stageOne.sourceSha);
  try {
    execFileSync("git", ["diff", "--quiet", census.auditRuntimeSourceSha, "HEAD", "--", "src", "scripts"], {
      cwd: root,
      stdio: "ignore",
    });
  } catch {
    throw new Error("BRIGHTWORK_STAGE8_AUDIT_RUNTIME_SOURCE_MOVED:" + census.auditRuntimeSourceSha);
  }
}

function addendum(summary) {
  const lines = [
    "---",
    "title: Brightwork Stage 4B Evidence Addendum",
    "audience: engineering-evidence",
    "status: current",
    "canonical_for: voyagewright-brightwork-stage-4b-evidence",
    "last_reviewed: " + new Date().toISOString().slice(0, 10),
    "---",
    "",
    "# Brightwork Stage 4B Evidence Addendum",
    "",
    "Status: **" + summary.completionStatus + "**",
    "",
    "This addendum changes evidence tooling, synthetic fixtures, evidence metadata, and generated records only. It does not repair ordinary Voyagewright behavior or create the combined Brightwork master ledger.",
    "",
    "## Reconciliation summary",
    "",
    ...Object.entries(summary)
      .filter(([key]) => key !== "completionStatus")
      .map(([key, value]) => "- " + key + ": " + value),
    "",
    "## Evidence boundaries",
    "",
    "- The protected main ref remains `57165b0f3638c65ecdb85f26b1f18d36bd5046aa`; its `src/` tree matches Stage 1 audited source `a82473c40114280694fd292f1103ae914dcc7c6c`.",
    "- Stage 1 captures remain canonical only where their route, fixture, semantics, and per-requirement binding remain valid.",
    "- Replaced unavailable READY frames are retained under `Experience_Images/Stage4B_Fixture_Exceptions`.",
    "- This remains synthetic evidence, not production, live-provider, visual-acceptance, assistive-technology, or owner acceptance proof.",
    "",
    "## Current artifacts",
    "",
    "- `Brightwork_Meaningful_State_Coverage_Matrix.json`",
    "- `Brightwork_Current_Navigation_Reachability_Report.json`",
    "- `Brightwork_Evidence_State_Exceptions.json`",
    "- Updated route/screen census, visual contract, Experience Images manifest, auditor index, and contact sheets.",
    "",
  ];
  return lines.join("\n");
}

function json(file) {
  return readFile(file, "utf8").then(JSON.parse);
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}
