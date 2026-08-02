import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const auditRoot = path.join(root, "Development_Docs", "Projects", "Project_Homeport");
const expectedSourceSha = "8d142227d712d27e363b15903dba9b0c99a04bc8";
const requireRawEvidence = process.env.HOMEPORT_PHASE0_REQUIRE_RAW === "1";
const evidenceRoot =
  process.env.HOMEPORT_PHASE0_EVIDENCE_ROOT ??
  path.join(
    process.env.LOCALAPPDATA ?? "",
    "ForeverTreasureCompanion",
    "homeport-phase0",
    "homeport-phase0-20260801T152828Z-8d142227",
    "screenshots",
  );

const readJson = (name) => JSON.parse(readFileSync(path.join(auditRoot, name), "utf8"));
const fail = (message) => assert.fail(message);
const requireKeys = (record, keys, context) => {
  for (const key of keys) {
    if (!(key in record)) fail(`${context} is missing ${key}`);
  }
};
const uniqueBy = (records, key, context) => {
  const values = records.map((record) => record[key]);
  assert.equal(new Set(values).size, values.length, `${context} ${key} values must be unique`);
};
const requireVocabulary = (value, vocabulary, context) =>
  assert.ok(vocabulary.includes(value), `${context} has unsupported value ${value}`);
const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/u, ""));
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  assert.equal(quoted, false, "CSV ended inside a quoted field");
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [headers, ...data] = rows;
  return data.map((values, index) => {
    assert.equal(values.length, headers.length, `CSV row ${index + 2} width differs from header`);
    return Object.fromEntries(headers.map((header, column) => [header, values[column]]));
  });
}

const schema = JSON.parse(readFileSync(path.join(root, "scripts", "homeport", "phase0-inventory-schema.json"), "utf8"));
assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");

const routes = readJson("Homeport_Route_Inventory.json");
const sessions = readJson("Homeport_Authentication_and_Session_Inventory.json");
const navigation = readJson("Homeport_Navigation_Map.json");
const screens = readJson("Homeport_Screen_Catalog.json");
const contracts = readJson("Homeport_Screen_Contract_Catalog.json");
const journeys = readJson("Homeport_Journey_Catalog.json");
const evidence = readJson("Homeport_Visual_Baseline_Manifest.json");
const controls = parseCsv(readFileSync(path.join(auditRoot, "Homeport_Control_Inventory.csv"), "utf8"));
const nonconformities = parseCsv(readFileSync(path.join(auditRoot, "Homeport_Nonconformity_Ledger.csv"), "utf8"));
const compatibility = parseCsv(
  readFileSync(path.join(auditRoot, "Project_Homeport_Phase_1_Compatibility_Cutover_Ledger.csv"), "utf8"),
);

for (const [name, envelope] of Object.entries({
  routes,
  sessions,
  navigation,
  screens,
  contracts,
  journeys,
  evidence,
})) {
  requireKeys(envelope, ["schemaVersion", "sourceSha", "generatedAt"], name);
  assert.equal(envelope.schemaVersion, "1.0.0", `${name} schema version drifted`);
  assert.equal(envelope.sourceSha, expectedSourceSha, `${name} source SHA drifted`);
  assert.ok(Number.isFinite(Date.parse(envelope.generatedAt)), `${name} generatedAt must be a timestamp`);
}

assert.equal(routes.routes.length, routes.totals.routeFiles, "route total does not match route records");
assert.equal(routes.routes.filter((route) => route.kind === "page").length, routes.totals.pages);
assert.equal(routes.routes.filter((route) => route.kind === "route").length, routes.totals.services);
uniqueBy(routes.routes, "routeId", "route inventory");
uniqueBy(routes.routes, "implementationSource", "route inventory");
const routeIds = new Set(routes.routes.map((route) => route.routeId));
const routePatterns = new Set(routes.routes.map((route) => route.routePattern));
for (const route of routes.routes) {
  requireKeys(
    route,
    [
      "routeId",
      "routePattern",
      "implementationSource",
      "kind",
      "classification",
      "ownerProject",
      "productArea",
      "shellMode",
      "logicalParent",
      "currentVisibleEntries",
      "currentDesktopPath",
      "currentMobilePath",
      "authenticationRequirement",
      "capabilityRequirements",
      "returnOrBackRoute",
      "emptyStateAction",
      "dynamicSourceRouteOrContentSource",
      "compatibilityAliases",
      "redirects",
      "currentSupportedStates",
      "currentJourneys",
      "currentVisualEvidenceIds",
      "currentMaturity",
      "directUrlRequired",
      "orphanedOrdinaryRoute",
      "targetDisposition",
      "status",
      "notes",
    ],
    route.routeId,
  );
  requireVocabulary(route.classification, routes.classifications, route.routeId);
  requireVocabulary(route.ownerProject, routes.knownOwners, route.routeId);
  requireVocabulary(route.currentMaturity, routes.maturityVocabulary, route.routeId);
  assert.ok(existsSync(path.join(root, route.implementationSource)), `${route.routeId} source is missing`);
  if (route.classification === "USER_NAVIGABLE") {
    assert.ok(
      route.routePattern === "/" || route.logicalParent,
      `${route.routeId} needs a logical parent or gateway root`,
    );
    assert.ok(
      route.currentVisibleEntries.length > 0 || route.orphanedOrdinaryRoute,
      `${route.routeId} needs visible entry evidence or an orphan flag`,
    );
    assert.ok(
      route.currentDesktopPath.length > 0 && route.currentMobilePath.length > 0,
      `${route.routeId} needs desktop and mobile paths`,
    );
  }
  if (route.classification === "CONTEXTUAL_DYNAMIC" || route.classification === "TOKENIZED_DEEP_LINK") {
    assert.ok(route.dynamicSourceRouteOrContentSource, `${route.routeId} needs its dynamic source route`);
  }
  if (route.classification === "DEPRECATED") {
    assert.equal(route.currentVisibleEntries.length, 0, `${route.routeId} is deprecated but still visibly navigable`);
  }
}

uniqueBy(sessions.authorities, "authorityId", "session inventory");
const authorityIds = new Set(sessions.authorities.map((authority) => authority.authorityId));
for (const authority of sessions.authorities) {
  requireKeys(
    authority,
    [
      "authorityId",
      "authorityClassification",
      "sourceModel",
      "cookieOrStorageKey",
      "hashOrStorageFormat",
      "createdBy",
      "readBy",
      "refreshedBy",
      "revokedBy",
      "deletedBy",
      "lifetime",
      "cookieAttributes",
      "csrfRelationship",
      "accountStatusChecks",
      "capabilitySource",
      "clientProjection",
      "expiryBehavior",
      "multiTabBehavior",
      "failureBehavior",
      "compatibilityDependencies",
      "currentWrites",
      "currentReads",
      "targetDisposition",
      "migrationRisk",
      "retirementCriteria",
      "evidence",
    ],
    authority.authorityId,
  );
  requireVocabulary(authority.authorityClassification, sessions.authorityVocabulary, authority.authorityId);
}

uniqueBy(screens.screens, "screenId", "screen catalog");
uniqueBy(contracts.screens, "screenId", "screen contract catalog");
const screenIds = new Set(screens.screens.map((screen) => screen.screenId));
assert.deepEqual(
  [...screenIds].sort(),
  contracts.screens.map((screen) => screen.screenId).sort(),
  "screen and contract catalogs diverge",
);
for (const screen of screens.screens) {
  requireKeys(
    screen,
    [
      "screenId",
      "routeIds",
      "productArea",
      "owner",
      "shellMode",
      "primaryUserGoal",
      "logicalParent",
      "visibleEntryPoints",
      "authentication",
      "capabilities",
      "primaryHeading",
      "primaryAction",
      "secondaryActions",
      "dataProjection",
      "currentResponsiveComposition",
      "currentKeyboardOrder",
      "currentFocusBehavior",
      "currentMotionOwner",
      "currentReducedMotionBehavior",
      "applicableStates",
      "currentVisualMaturity",
      "missingStates",
      "knownDefects",
      "screenshotIds",
      "journeyIds",
      "targetHomeportPhase",
      "acceptanceContract",
      "status",
    ],
    screen.screenId,
  );
  requireVocabulary(screen.currentVisualMaturity, screens.maturityVocabulary, screen.screenId);
  for (const routeId of screen.routeIds)
    assert.ok(routeIds.has(routeId), `${screen.screenId} references unknown ${routeId}`);
}

uniqueBy(journeys.journeys, "journeyId", "journey catalog");
const journeyIds = new Set(journeys.journeys.map((journey) => journey.journeyId));
for (const journey of journeys.journeys) {
  requireKeys(
    journey,
    [
      "journeyId",
      "name",
      "sourceSha",
      "fixtureIdentity",
      "browser",
      "viewport",
      "steps",
      "controlsUsed",
      "routeTransitions",
      "sessionAuthoritiesObservedWithoutValues",
      "expectedCurrentBehavior",
      "observedBehavior",
      "screenshots",
      "traces",
      "result",
      "rootBlocker",
      "relatedNonconformityIds",
      "targetPhase",
      "futureAcceptanceTest",
    ],
    journey.journeyId,
  );
  requireVocabulary(journey.result, journeys.resultVocabulary, journey.journeyId);
  for (const authorityId of journey.sessionAuthoritiesObservedWithoutValues) {
    assert.ok(authorityIds.has(authorityId), `${journey.journeyId} references unknown ${authorityId}`);
  }
}

uniqueBy(evidence.records, "evidenceId", "evidence manifest");
const evidenceIds = new Set(evidence.records.map((record) => record.evidenceId));
for (const record of evidence.records) {
  requireKeys(
    record,
    [
      "evidenceId",
      "sourceSha",
      "branch",
      "route",
      "screenContract",
      "journey",
      "accountFixture",
      "fixtureVersion",
      "fixtureChecksum",
      "browser",
      "viewport",
      "zoom",
      "motionMode",
      "appearanceState",
      "dataState",
      "screenshotPath",
      "committedScreenshotPath",
      "sha256",
      "observedResult",
      "knownDeviation",
      "timestamp",
      "reviewerClassification",
    ],
    record.evidenceId,
  );
  assert.equal(record.sourceSha, expectedSourceSha, `${record.evidenceId} source SHA drifted`);
  assert.ok(screenIds.has(record.screenContract), `${record.evidenceId} references unknown screen contract`);
  assert.ok(journeyIds.has(record.journey), `${record.evidenceId} references unknown journey`);
  const committedPhaseRecord = /^HP-P[12]-EV-/u.test(record.evidenceId);
  const screenshot = committedPhaseRecord
    ? path.join(root, record.committedScreenshotPath)
    : path.join(evidenceRoot, path.basename(record.screenshotPath));
  if (committedPhaseRecord || existsSync(evidenceRoot) || requireRawEvidence) {
    assert.ok(existsSync(screenshot), `${record.evidenceId} screenshot is missing at ${screenshot}`);
    assert.equal(sha256(screenshot), record.sha256, `${record.evidenceId} screenshot checksum drifted`);
  }
  const committedScreenshot = path.join(root, record.committedScreenshotPath);
  assert.ok(existsSync(committedScreenshot), `${record.evidenceId} committed screenshot is missing`);
  assert.equal(
    sha256(committedScreenshot),
    record.sha256,
    `${record.evidenceId} committed screenshot checksum drifted`,
  );
}

const controlRequired = [
  "control_id",
  "label",
  "screen",
  "route",
  "role_or_capability",
  "visibility_condition",
  "enabled_condition",
  "action_type",
  "authoritative_endpoint_or_server_action",
  "pending_feedback",
  "success_feedback",
  "failure_feedback",
  "navigation_result",
  "focus_result",
  "keyboard_operation",
  "mobile_operation",
  "current_status",
  "reproduction_steps",
  "evidence_id",
  "target_phase",
];
uniqueBy(controls, "control_id", "control inventory");
for (const control of controls) {
  requireKeys(control, controlRequired, control.control_id);
  assert.ok(screenIds.has(control.screen), `${control.control_id} references unknown screen`);
  assert.ok(routePatterns.has(control.route.split("?")[0]), `${control.control_id} references unknown route`);
  assert.ok(
    [
      "WORKING",
      "WORKING_WITH_WEAK_FEEDBACK",
      "DECEPTIVE",
      "NO_VISIBLE_FEEDBACK",
      "PARTIAL",
      "BROKEN",
      "UNREACHABLE",
      "NOT_APPLICABLE",
      "VALIDATED",
    ].includes(control.current_status),
    `${control.control_id} status is invalid`,
  );
  assert.ok(control.reproduction_steps, `${control.control_id} needs reproduction steps`);
  if (control.evidence_id)
    assert.ok(evidenceIds.has(control.evidence_id), `${control.control_id} references unknown evidence`);
}

const compatibilityRequired = [
  "authority_id",
  "cookie_or_token",
  "source_model",
  "classification",
  "current_reads",
  "current_writes",
  "canonical_mapping",
  "phase_1_action",
  "new_writes_after_phase_1",
  "fallback_reads_after_phase_1",
  "telemetry",
  "retirement_criteria",
  "rollback",
  "security_risk",
  "test_ids",
  "evidence_ids",
  "final_status",
  "notes",
];
const compatibilityStatuses = [
  "CANONICAL_ACTIVE",
  "BOUNDED_COMPATIBILITY",
  "CONTEXTUAL_RETAINED",
  "TOKENIZED_RETAINED",
  "CLIENT_HINT_ONLY",
  "NO_NEW_WRITES",
  "OBSERVATION_REQUIRED",
  "READY_FOR_RETIREMENT",
  "BLOCKED",
];
uniqueBy(compatibility, "authority_id", "Phase 1 compatibility ledger");
for (let number = 1; number <= 10; number += 1)
  assert.ok(
    compatibility.some((record) => record.authority_id === `HP-SES-${String(number).padStart(3, "0")}`),
    `Phase 1 compatibility authority ${number} is missing`,
  );
for (const record of compatibility) {
  requireKeys(record, compatibilityRequired, record.authority_id);
  assert.ok(authorityIds.has(record.authority_id), `${record.authority_id} is absent from the session inventory`);
  requireVocabulary(record.final_status, compatibilityStatuses, record.authority_id);
  for (const evidenceId of record.evidence_ids.split(";").filter(Boolean))
    assert.ok(evidenceIds.has(evidenceId), `${record.authority_id} references unknown ${evidenceId}`);
}

const requiredPhase1Documents = [
  "Project_Homeport_Phase_1_Identity_and_Session_Architecture.md",
  "Project_Homeport_Phase_1_Compatibility_Cutover_Ledger.csv",
  "Project_Homeport_Phase_1_Test_Plan.md",
  "Project_Homeport_Phase_1_Implementation_Report.md",
  "Project_Homeport_Phase_1_Validation_Record.md",
  "Project_Homeport_Phase_1_Integration_Manifest.md",
];
for (const name of requiredPhase1Documents)
  assert.ok(existsSync(path.join(auditRoot, name)), `Phase 1 required document is missing: ${name}`);

for (const letter of "ABCDEFGHIJKLMNOPQ")
  assert.ok(journeyIds.has(`HP-P1-JRN-${letter}`), `Phase 1 journey ${letter} is missing`);
assert.equal(
  evidence.records.filter((record) => record.evidenceId.startsWith("HP-P1-EV-")).length,
  15,
  "Phase 1 visual baseline must contain 15 after-state records",
);

const phase2ImplementationAnchorSha = "ce9fd8e70f0e906416cf41cd508ec5f2063570cc";
for (const [name, envelope] of Object.entries({
  routes,
  navigation,
  screens,
  contracts,
  journeys,
  evidence,
})) {
  requireKeys(envelope, ["phase2Implementation"], name);
  assert.equal(envelope.phase2Implementation.state, "VALIDATED", `${name} Phase 2 state is not validated`);
  assert.equal(
    envelope.phase2Implementation.implementationAnchorSha,
    phase2ImplementationAnchorSha,
    `${name} Phase 2 implementation anchor drifted`,
  );
  assert.equal(envelope.phase2Implementation.historicalPhase0Preserved, true, `${name} lost Phase 0 history`);
}

const requiredPhase2Documents = [
  "Project_Homeport_Phase_2_Global_Shell_and_Wayfinding_Architecture.md",
  "Project_Homeport_Phase_2_Shell_Mode_Registry.json",
  "Project_Homeport_Phase_2_Navigation_Projection_Contract.json",
  "Project_Homeport_Phase_2_Desktop_Mobile_Parity_Matrix.csv",
  "Project_Homeport_Phase_2_Contextual_Exit_Matrix.csv",
  "Project_Homeport_Phase_2_Test_Plan.md",
  "Project_Homeport_Phase_2_Implementation_Report.md",
  "Project_Homeport_Phase_2_Validation_Record.md",
  "Project_Homeport_Phase_2_Integration_Manifest.md",
  "evidence/phase2/README.md",
];
for (const name of requiredPhase2Documents)
  assert.ok(existsSync(path.join(auditRoot, name)), `Phase 2 required document is missing: ${name}`);

for (const letter of "ABCDEFGHIJKLMNOPQRSTU")
  assert.ok(journeyIds.has(`HP-P2-JRN-${letter}`), `Phase 2 journey ${letter} is missing`);
assert.equal(
  evidence.records.filter((record) => record.evidenceId.startsWith("HP-P2-EV-")).length,
  20,
  "Phase 2 visual baseline must contain 20 after-state records",
);
assert.equal(
  routes.routes.filter((route) => route.kind === "page" && route.phase2Implementation).length,
  routes.totals.pages,
  "Every page must have one Phase 2 shell implementation record",
);

const ncRequired = [
  "id",
  "parent_id",
  "severity",
  "product_area",
  "title",
  "description",
  "current_status",
  "source_routes",
  "source_screens",
  "journeys",
  "reproduction_steps",
  "observed_result",
  "expected_governing_result",
  "evidence_ids",
  "root_cause_hypothesis",
  "canonical_owner",
  "integration_owner",
  "target_phase",
  "acceptance_contract",
  "test_ids",
  "security_or_privacy_impact",
  "mobile_impact",
  "accessibility_impact",
  "dependencies",
  "disposition",
  "notes",
];
uniqueBy(nonconformities, "id", "nonconformity ledger");
const ncIds = new Set(nonconformities.map((record) => record.id));
for (let number = 1; number <= 20; number += 1) {
  assert.ok(ncIds.has(`HP-NC-${String(number).padStart(3, "0")}`), `initial nonconformity ${number} was lost`);
}
for (const record of nonconformities) {
  requireKeys(record, ncRequired, record.id);
  assert.match(record.id, /^HP-NC-\d{3}$/u);
  requireVocabulary(record.severity, ["CRITICAL", "HIGH", "MODERATE", "LOW"], record.id);
  if (record.parent_id) assert.ok(ncIds.has(record.parent_id), `${record.id} references unknown parent`);
  for (const journeyId of record.journeys.split(";").filter(Boolean))
    assert.ok(journeyIds.has(journeyId), `${record.id} references unknown ${journeyId}`);
  for (const evidenceId of record.evidence_ids.split(";").filter(Boolean))
    assert.ok(evidenceIds.has(evidenceId), `${record.id} references unknown ${evidenceId}`);
}

for (const id of ["HP-NC-001", "HP-NC-006", "HP-NC-010", "HP-NC-016"]) {
  const record = nonconformities.find((candidate) => candidate.id === id);
  assert.equal(record?.current_status, "CLOSED", `${id} must be closed by validated Phase 2 evidence`);
  assert.equal(record?.disposition, "CLOSED_PHASE_2_VALIDATED", `${id} has the wrong Phase 2 disposition`);
}
for (const id of ["HP-NC-008", "HP-NC-014", "HP-NC-026"]) {
  const record = nonconformities.find((candidate) => candidate.id === id);
  assert.equal(record?.current_status, "PARTIALLY_ADVANCED_PHASE_2", `${id} must remain a partial Phase 2 advance`);
  assert.equal(
    record?.disposition,
    "PARTIAL_PHASE_2_LATER_OWNER_RETAINED",
    `${id} lost its later-phase owner boundary`,
  );
}

for (const screen of screens.screens) {
  for (const screenshotId of screen.screenshotIds)
    assert.ok(evidenceIds.has(screenshotId), `${screen.screenId} references unknown ${screenshotId}`);
  for (const journeyId of screen.journeyIds)
    assert.ok(journeyIds.has(journeyId), `${screen.screenId} references unknown ${journeyId}`);
}
for (const route of routes.routes) {
  for (const screenshotId of route.currentVisualEvidenceIds)
    assert.ok(evidenceIds.has(screenshotId), `${route.routeId} references unknown ${screenshotId}`);
  for (const journeyId of route.currentJourneys)
    assert.ok(journeyIds.has(journeyId), `${route.routeId} references unknown ${journeyId}`);
}

console.log("ARTIFACT_SCHEMA_VALID");
console.log("PRODUCT_NONCONFORMITIES_PRESENT");
console.log(
  JSON.stringify({
    routes: routes.routes.length,
    sessions: sessions.authorities.length,
    screens: screens.screens.length,
    controls: controls.length,
    journeys: journeys.journeys.length,
    evidence: evidence.records.length,
    rawEvidenceVerified: existsSync(evidenceRoot),
    nonconformities: nonconformities.length,
    phase1CompatibilityAuthorities: compatibility.length,
    phase1Journeys: journeys.journeys.filter((journey) => journey.journeyId.startsWith("HP-P1-JRN-")).length,
    phase1Evidence: evidence.records.filter((record) => record.evidenceId.startsWith("HP-P1-EV-")).length,
    phase2Journeys: journeys.journeys.filter((journey) => journey.journeyId.startsWith("HP-P2-JRN-")).length,
    phase2Evidence: evidence.records.filter((record) => record.evidenceId.startsWith("HP-P2-EV-")).length,
    phase2ShellPages: routes.routes.filter((route) => route.kind === "page" && route.phase2Implementation).length,
  }),
);
