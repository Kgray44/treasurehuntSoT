import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverAppRouteSources } from "./phase5-route-census.mjs";
import { criticality, implementationSourceSha, stateVocabulary, viewports } from "./phase6-surface-model.mjs";

const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const auditRoot = path.join(moduleRoot, "Development_Docs", "Projects", "Project_Homeport");
const allowedMaturity = new Set([
  "VISUALLY_COMPLETE",
  "COMPLETE_WITH_TRUTHFUL_EXTERNAL_LIMITATION",
  "DEVELOPMENT_ONLY",
  "NOT_APPLICABLE",
  "BLOCKED_WITH_GOVERNED_REASON",
]);
const zoomRequired = new Set([
  "screen-page-root",
  "screen-page-sign-in",
  "screen-page-player-library",
  "screen-page-captain-library",
  "screen-page-studio-library",
  "screen-page-account",
  "screen-page-account-profile",
  "screen-page-passport",
  "screen-page-community",
  "screen-page-player-playthroughs-playthroughid",
  "screen-page-captain-sessions-sessionid",
  "screen-page-studio-tales-taleid",
]);

function readJson(name, directory = auditRoot) {
  return JSON.parse(readFileSync(path.join(directory, name), "utf8"));
}

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
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  const [headers = [], ...records] = rows;
  return records.map((values) => Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""])));
}

function readCsv(name) {
  return parseCsv(readFileSync(path.join(auditRoot, name), "utf8"));
}

function walk(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target, files);
    else files.push(target);
  }
  return files;
}

export function validatePhase6Surfaces(root = moduleRoot) {
  if (path.resolve(root) !== moduleRoot) throw new Error("PHASE6_VALIDATOR_MUST_RUN_FROM_ITS_OWN_REPOSITORY");
  const errors = [];
  const outcomes = new Set();
  const registry = readJson("Project_Homeport_Phase_6_Screen_Acceptance_Registry.json");
  const families = readJson("Project_Homeport_Phase_6_Component_Family_Registry.json");
  const stateRows = readCsv("Project_Homeport_Phase_6_Page_State_Matrix.csv");
  const responsiveRows = readCsv("Project_Homeport_Phase_6_Responsive_Matrix.csv");
  const accessRows = readCsv("Project_Homeport_Phase_6_Accessibility_Matrix.csv");
  const motionRows = readCsv("Project_Homeport_Phase_6_Motion_and_Reduced_Motion_Matrix.csv");
  const mediaRows = readCsv("Project_Homeport_Phase_6_Media_and_Fallback_Matrix.csv");
  const mutationRows = readCsv("Project_Homeport_Phase_6_Mutation_Feedback_Matrix.csv");
  const visualRows = readCsv("Project_Homeport_Phase_6_Visual_Evidence_Matrix.csv");
  const nodes = readJson("Project_Homeport_Phase_5_Route_Node_Registry.json").nodes;
  const sources = discoverAppRouteSources(root).filter((source) => source.kind === "page");
  const nodeByRoute = new Map(nodes.map((node) => [node.routeId, node]));
  const screenByEvidence = new Map(
    registry.screens.flatMap((screen) => screen.evidenceIds.map((evidenceId) => [evidenceId, screen.screenId])),
  );
  const visualByScreen = new Map();
  for (const row of visualRows) {
    const screenId = screenByEvidence.get(row.evidence_id) ?? row.screen_id;
    const records = visualByScreen.get(screenId) ?? [];
    records.push(row);
    visualByScreen.set(screenId, records);
  }

  if (registry.sourceSha !== implementationSourceSha) errors.push("SCREEN_REGISTRY_SOURCE_SHA_STALE");
  if (registry.screens.length !== nodes.length + 7)
    errors.push(`SCREEN_RECORD_COUNT_INVALID:${registry.screens.length}`);
  const screenIds = registry.screens.map((screen) => screen.screenId);
  if (new Set(screenIds).size !== screenIds.length) errors.push("SCREEN_ID_DUPLICATE");
  const mappedSources = new Set(registry.screens.flatMap((screen) => screen.sourceFiles));
  for (const source of sources)
    if (!mappedSources.has(source.sourceFile)) errors.push(`ORDINARY_PAGE_OMITTED:${source.sourceFile}`);
  for (const screen of registry.screens) {
    for (const routeId of screen.routeIds)
      if (!nodeByRoute.has(routeId)) errors.push(`SCREEN_ROUTE_INVALID:${screen.screenId}:${routeId}`);
    if (!screen.sourceFiles.length) errors.push(`SCREEN_SOURCE_MISSING:${screen.screenId}`);
    for (const source of screen.sourceFiles)
      if (!existsSync(path.join(root, source))) errors.push(`SCREEN_SOURCE_FILE_MISSING:${screen.screenId}:${source}`);
    if (!screen.keyboardContract || !screen.touchContract || !screen.focusContract)
      errors.push(`SCREEN_INPUT_CONTRACT_MISSING:${screen.screenId}`);
    if (!screen.reducedMotionContract) errors.push(`SCREEN_REDUCED_MOTION_MISSING:${screen.screenId}`);
    if (!screen.mediaFallbackContract) errors.push(`SCREEN_MEDIA_FALLBACK_MISSING:${screen.screenId}`);
    if (!allowedMaturity.has(screen.finalMaturity)) errors.push(`SCREEN_MATURITY_INVALID:${screen.screenId}`);
    if (
      ["CRITICAL", "HIGH"].includes(screen.criticality) &&
      screen.finalMaturity !== "VISUALLY_COMPLETE" &&
      !screen.limitations.length
    )
      errors.push(`HIGH_RISK_MATURITY_INCOMPLETE:${screen.screenId}`);
    const node = screen.routeIds.length ? nodeByRoute.get(screen.routeIds[0]) : null;
    if (node && criticality(node) !== screen.criticality) errors.push(`SCREEN_CRITICALITY_DRIFT:${screen.screenId}`);
    for (const state of screen.applicableStates)
      if (!stateVocabulary.includes(state)) errors.push(`SCREEN_STATE_INVALID:${screen.screenId}:${state}`);
  }
  outcomes.add("SCREEN_CATALOG_SCHEMA_VALID");
  outcomes.add("SCREEN_SOURCE_PARITY_VALID");

  for (const screen of registry.screens.filter((item) => ["CRITICAL", "HIGH"].includes(item.criticality))) {
    const records = visualByScreen.get(screen.screenId) ?? [];
    if (!records.some((record) => record.viewport_family === "STANDARD_DESKTOP"))
      errors.push(`DESKTOP_EVIDENCE_MISSING:${screen.screenId}`);
    if (!records.some((record) => record.viewport_family === "MODERN_MOBILE"))
      errors.push(`MOBILE_EVIDENCE_MISSING:${screen.screenId}`);
    if (screen.criticality === "CRITICAL" && !records.length)
      errors.push(`CRITICAL_EVIDENCE_MISSING:${screen.screenId}`);
  }
  for (const id of zoomRequired) {
    const records = visualByScreen.get(id) ?? [];
    if (!records.some((record) => record.viewport_family === "EFFECTIVE_200_PERCENT"))
      errors.push(`ZOOM_EVIDENCE_MISSING:${id}`);
  }
  outcomes.add("CRITICAL_VISUAL_EVIDENCE_COMPLETE");

  for (const screen of registry.screens) {
    const states = new Set(
      stateRows.filter((row) => row.screen_id === screen.screenId && row.applicable === "YES").map((row) => row.state),
    );
    for (const state of screen.applicableStates)
      if (!states.has(state)) errors.push(`STATE_CONTRACT_MISSING:${screen.screenId}:${state}`);
  }
  if (stateRows.some((row) => !stateVocabulary.includes(row.state))) errors.push("STATE_MATRIX_VOCABULARY_INVALID");
  outcomes.add("PAGE_STATE_CONTRACTS_COMPLETE");

  for (const screen of registry.screens.filter((item) => ["CRITICAL", "HIGH"].includes(item.criticality))) {
    const familiesPresent = new Set(
      responsiveRows.filter((row) => row.screen_id === screen.screenId).map((row) => row.viewport_family),
    );
    for (const [viewport] of viewports)
      if (!familiesPresent.has(viewport)) errors.push(`RESPONSIVE_VIEWPORT_MISSING:${screen.screenId}:${viewport}`);
    if (!accessRows.some((row) => row.screen_id === screen.screenId))
      errors.push(`ACCESSIBILITY_SCREEN_MISSING:${screen.screenId}`);
  }
  if (responsiveRows.some((row) => row.overflow !== "NO_ACCIDENTAL_HORIZONTAL_DOCUMENT_OVERFLOW"))
    errors.push("RESPONSIVE_OVERFLOW_CONTRACT_INVALID");
  outcomes.add("RESPONSIVE_MATRIX_COMPLETE");
  outcomes.add("ACCESSIBILITY_MATRIX_COMPLETE");
  if (motionRows.length < 10 || motionRows.some((row) => !row.cleanup || !row.reduced_motion_equivalent))
    errors.push("MOTION_MATRIX_INCOMPLETE");
  else outcomes.add("MOTION_MATRIX_COMPLETE");
  if (mediaRows.length < 12 || mediaRows.some((row) => !row.fallback || !row.quarantined))
    errors.push("MEDIA_MATRIX_INCOMPLETE");
  else outcomes.add("MEDIA_FALLBACK_MATRIX_COMPLETE");
  if (mutationRows.length < 20 || mutationRows.some((row) => !row.pending || !row.success || !row.failure))
    errors.push("MUTATION_MATRIX_INCOMPLETE");
  else outcomes.add("MUTATION_FEEDBACK_COMPLETE");

  const familyIds = families.families.map((family) => family.familyId);
  if (new Set(familyIds).size !== familyIds.length) errors.push("COMPONENT_FAMILY_DUPLICATE");
  for (const family of families.families)
    for (const source of family.sourceComponents)
      if (!existsSync(path.join(root, source)))
        errors.push(`COMPONENT_FAMILY_SOURCE_MISSING:${family.familyId}:${source}`);

  for (const row of visualRows) {
    if (row.source_sha !== implementationSourceSha) errors.push(`EVIDENCE_SOURCE_STALE:${row.evidence_id}`);
    if (row.visual_review_classification !== "ACCEPTED") errors.push(`EVIDENCE_NOT_ACCEPTED:${row.evidence_id}`);
    const capture = path.join(root, row.capture_path);
    if (!existsSync(capture)) errors.push(`EVIDENCE_FILE_MISSING:${row.evidence_id}`);
    else {
      const checksum = createHash("sha256").update(readFileSync(capture)).digest("hex");
      if (checksum !== row.checksum) errors.push(`EVIDENCE_CHECKSUM_MISMATCH:${row.evidence_id}`);
    }
  }
  if (!visualRows.length) errors.push("VISUAL_EVIDENCE_EMPTY");

  const componentSources = walk(path.join(root, "src", "components")).filter((file) => /\.(?:ts|tsx)$/u.test(file));
  const prohibited = [
    [/\bwindow\.(?:alert|confirm|prompt)\s*\(/u, "NATIVE_DIALOG"],
    [/<pre[^>]*>\s*\{JSON\.stringify/u, "RAW_JSON_PRE"],
    [/Version checksum:/u, "RAW_CHECKSUM_LABEL"],
    [/edition checksum/u, "RAW_EDITION_CHECKSUM"],
  ];
  for (const source of componentSources) {
    const text = readFileSync(source, "utf8");
    for (const [pattern, label] of prohibited)
      if (pattern.test(text)) errors.push(`RAW_IMPLEMENTATION_PATTERN:${label}:${path.relative(root, source)}`);
  }
  outcomes.add("RAW_IMPLEMENTATION_GATE_CLEAR");

  const ledger = readCsv("Homeport_Nonconformity_Ledger.csv");
  const nc18 = ledger.find((record) => record.id === "HP-NC-018");
  if (nc18?.current_status !== "CLOSED_PHASE_6_BRANCH_VALIDATED") errors.push("HP_NC_018_NOT_CLOSED");
  const phase7Expected = new Map([
    ["HP-NC-015", "CLOSED_PHASE_7_WALKTHROUGH_READY"],
    ["HP-NC-019", "CLOSED_PHASE_7_FIXTURE_VALIDATED"],
    ["HP-NC-020", "WAITING_FOR_OWNER_DECISION"],
  ]);
  for (const [id, expected] of phase7Expected)
    if (ledger.find((record) => record.id === id)?.current_status !== expected)
      errors.push(`PHASE7_NONCONFORMITY_STATE_INVALID:${id}`);
  outcomes.add("PRODUCT_NONCONFORMITIES_REMAIN");

  if (errors.length) return { ok: false, errors: [...new Set(errors)], outcomes: [...outcomes] };
  outcomes.add("PHASE_6_SURFACES_VISUALLY_COMPLETE");
  return {
    ok: true,
    errors: [],
    outcomes: [...outcomes],
    summary: {
      screens: registry.screens.length,
      pages: sources.length,
      critical: registry.screens.filter((screen) => screen.criticality === "CRITICAL").length,
      high: registry.screens.filter((screen) => screen.criticality === "HIGH").length,
      statePairs: stateRows.length,
      responsiveCases: responsiveRows.length,
      accessibilityCases: accessRows.length,
      evidence: visualRows.length,
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validatePhase6Surfaces();
  for (const outcome of result.outcomes) process.stdout.write(`${outcome}\n`);
  if (!result.ok) {
    for (const error of result.errors) process.stderr.write(`${error}\n`);
    process.exitCode = 1;
  } else process.stdout.write(`${JSON.stringify(result.summary)}\n`);
}
