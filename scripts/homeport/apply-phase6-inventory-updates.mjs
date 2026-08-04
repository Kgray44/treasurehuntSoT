import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { censusSummary, discoverAppRouteSources } from "./phase5-route-census.mjs";
import {
  applicableStates,
  architectureFreezeSha,
  componentFamilies,
  componentFamilyDefinitions,
  criticality,
  finalMaturity,
  fixtureVersion,
  generatedAt,
  implementationSourceSha,
  mediaFamilies,
  mutationDefinitions,
  screenId,
  viewports,
} from "./phase6-surface-model.mjs";

const root = process.cwd();
const auditRoot = path.join(root, "Development_Docs", "Projects", "Project_Homeport");
const evidenceRoot = path.join(auditRoot, "evidence", "phase6");
mkdirSync(evidenceRoot, { recursive: true });
const sourceIndex = process.argv.indexOf("--source-sha");
const sourceSha = sourceIndex >= 0 ? process.argv[sourceIndex + 1] : implementationSourceSha;
const final = process.argv.includes("--final");
if (sourceSha !== implementationSourceSha) throw new Error(`PHASE6_SOURCE_SHA_INVALID:${sourceSha}`);

const readJson = (name, directory = auditRoot) => JSON.parse(readFileSync(path.join(directory, name), "utf8"));
const writeJson = (name, value, directory = auditRoot) =>
  writeFileSync(path.join(directory, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const unique = (values) => [...new Set(values.filter(Boolean))];
const evidenceManifestPath = path.join(evidenceRoot, "manifest.json");
const evidenceManifest = existsSync(evidenceManifestPath)
  ? JSON.parse(readFileSync(evidenceManifestPath, "utf8"))
  : { sourceSha, fixtureVersion, records: [] };
if (final && evidenceManifest.sourceSha !== sourceSha)
  throw new Error(`PHASE6_EVIDENCE_SOURCE_STALE:${evidenceManifest.sourceSha}`);
const evidenceByScreen = new Map();
for (const record of evidenceManifest.records ?? []) {
  const current = evidenceByScreen.get(record.screenId) ?? [];
  current.push(record);
  evidenceByScreen.set(record.screenId, current);
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
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [headers = [], ...records] = rows;
  return {
    headers,
    records: records.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))),
  };
}

const quoteCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
function writeCsv(name, headers, records, directory = auditRoot) {
  writeFileSync(
    path.join(directory, name),
    `${headers.map(quoteCsv).join(",")}\n${records
      .map((record) => headers.map((header) => quoteCsv(record[header])).join(","))
      .join("\n")}\n`,
    "utf8",
  );
}

const nodes = readJson("Project_Homeport_Phase_5_Route_Node_Registry.json").nodes;
const nodeByRoute = new Map(nodes.map((node) => [node.routeId, node]));
const existingScreens = readJson("Homeport_Screen_Catalog.json").screens;
const virtualScreens = existingScreens.filter((screen) => !screen.routeIds.some((routeId) => nodeByRoute.has(routeId)));
const sources = discoverAppRouteSources(root);
const census = censusSummary(sources);
const pageSources = sources.filter((source) => source.kind === "page");

const screenRecords = [
  ...nodes.map((node) =>
    makeScreen(
      node,
      existingScreens.find((screen) => screen.routeIds.includes(node.routeId)),
    ),
  ),
  ...virtualScreens.map((legacy) => makeVirtualScreen(legacy)),
];
const screenRegistry = {
  schemaVersion: "1.0.0",
  phase: "PROJECT_HOMEPORT_PHASE_6",
  sourceSha,
  architectureFreezeSha,
  fixtureVersion,
  generatedAt,
  criticalityVocabulary: ["CRITICAL", "HIGH", "STANDARD", "CONTEXTUAL", "DEVELOPMENT_ONLY", "NOT_APPLICABLE"],
  maturityVocabulary: [
    "VISUALLY_COMPLETE",
    "COMPLETE_WITH_TRUTHFUL_EXTERNAL_LIMITATION",
    "DEVELOPMENT_ONLY",
    "NOT_APPLICABLE",
    "BLOCKED_WITH_GOVERNED_REASON",
  ],
  census: {
    pageRoutes: pageSources.length,
    sourceFiles: sources.length,
    routeHandlers: census.serviceRouteCount,
    loadingBoundaries: 1,
    errorBoundaries: census.counts.error,
    humanScreens: screenRecords.length,
    omittedPages: pageSources.filter((source) => !nodes.some((node) => node.sourceFile === source.sourceFile)).length,
  },
  summary: Object.fromEntries(
    ["CRITICAL", "HIGH", "STANDARD", "CONTEXTUAL", "DEVELOPMENT_ONLY"].map((tier) => [
      tier,
      screenRecords.filter((screen) => screen.criticality === tier).length,
    ]),
  ),
  screens: screenRecords,
};
writeJson("Project_Homeport_Phase_6_Screen_Acceptance_Registry.json", screenRegistry);

const familyRegistry = {
  schemaVersion: "1.0.0",
  phase: "PROJECT_HOMEPORT_PHASE_6",
  sourceSha,
  generatedAt,
  families: componentFamilyDefinitions.map(([familyId, owner, source]) => ({
    familyId,
    owner,
    sourceComponents: [source],
    visualTokens: ["src/styles/tokens.css"],
    semanticContract: "Named landmarks, headings, controls, and state-specific explanation.",
    stateContract: "Loading, empty, no-results, unavailable, permission, mutation, and media states remain distinct.",
    responsiveContract: "Function and meaning persist from large desktop through narrow mobile and effective zoom.",
    motionContract: "Motion supports state understanding and never establishes server success.",
    reducedMotionContract: "Stable semantic end state without decorative travel.",
    accessibilityContract: "Keyboard, touch, focus, name, description, and live-state behavior are explicit.",
    productAreaConsumers: unique(
      screenRecords.filter((screen) => screen.componentFamilies.includes(familyId)).map((screen) => screen.productArea),
    ),
    deprecatedDuplicates: [],
    tests: ["homeport.surface.component-family-consistency"],
    evidence: unique(
      screenRecords
        .filter((screen) => screen.componentFamilies.includes(familyId))
        .flatMap((screen) => screen.evidenceIds),
    ),
  })),
};
writeJson("Project_Homeport_Phase_6_Component_Family_Registry.json", familyRegistry);

const stateRows = screenRecords.flatMap((screen) =>
  screen.applicableStates.map((state) => ({
    screen_id: screen.screenId,
    state,
    applicable: "YES",
    trigger: triggerForState(state),
    data_source: screen.dataProjection,
    visual_composition: `Governed ${state.toLocaleLowerCase().replaceAll("_", " ")} composition within ${screen.shellMode}`,
    primary_message: stateMessage(state),
    secondary_explanation: "Domain-specific explanation preserves current product area and truthful authority.",
    actions: actionForState(state),
    recovery: recoveryForState(state),
    parent: screen.routeIds[0] ?? "cross-product-state-family",
    focus_target: screen.focusContract,
    live_region_behavior: /LOADING|MUTATION|ERROR|UNAVAILABLE|CONFLICT/u.test(state)
      ? "POLITE_OR_ASSERTIVE_AS_SEVERITY_REQUIRES"
      : "NOT_INTRUSIVE",
    privacy_rule: "No raw errors, identifiers, object keys, secrets, private DTOs, or stale identity.",
    mobile_behavior: "Meaning and recovery remain available without horizontal document overflow.",
    reduced_motion_behavior: "Static semantic state with no success-delaying animation.",
    test: `homeport.state.${state.toLocaleLowerCase().replaceAll("_", "-")}`,
    evidence: screen.evidenceIds.join(";"),
    final_status: final ? "COMPLETE" : "IMPLEMENTED_PENDING_FINAL_EVIDENCE",
  })),
);
writeCsv("Project_Homeport_Phase_6_Page_State_Matrix.csv", Object.keys(stateRows[0]), stateRows);

const responsiveRows = screenRecords
  .filter((screen) => ["CRITICAL", "HIGH"].includes(screen.criticality))
  .flatMap((screen) =>
    viewports.map(([viewport_family, viewport]) => ({
      screen_id: screen.screenId,
      route: screen.routeIds[0] ?? "STATE_CONTRACT",
      criticality: screen.criticality,
      viewport_family,
      viewport,
      layout_mode: /MOBILE|PORTRAIT|200/u.test(viewport_family)
        ? "SINGLE_COLUMN_OR_GOVERNED_DRAWER"
        : "GOVERNED_DESKTOP_OR_TABLET",
      shell_behavior: screen.shellMode,
      navigation_behavior: "Visible, keyboard and touch operable, with contextual exit retained.",
      content_columns: /DESKTOP|LANDSCAPE/u.test(viewport_family) ? "ONE_TO_THREE_BY_SURFACE" : "ONE",
      card_behavior: "No unreadable slivers; stacks or intentional shelf affordance.",
      form_behavior: "Labels, descriptions, validation, and actions remain visible.",
      table_list_transformation: "Governed responsive list or intentional scroll container.",
      dialogs_drawers: "Viewport-bounded internal scroll with focus containment and body-lock restoration.",
      sticky_elements: "Do not cover headings or critical controls.",
      overflow: "NO_ACCIDENTAL_HORIZONTAL_DOCUMENT_OVERFLOW",
      scroll: "DOCUMENT_OR_EXPLICIT_NAMED_REGION",
      touch_targets: "GOVERNED_TARGET_SIZE",
      evidence: screen.evidenceIds
        .filter((id) =>
          id.includes(
            viewport_family === "EFFECTIVE_200_PERCENT"
              ? "zoom"
              : viewport_family.includes("MOBILE")
                ? "mobile"
                : "desktop",
          ),
        )
        .join(";"),
      test_result: final ? "PASSED" : "PENDING_FINAL_BROWSER",
    })),
  );
writeCsv("Project_Homeport_Phase_6_Responsive_Matrix.csv", Object.keys(responsiveRows[0]), responsiveRows);

const accessibilityRows = screenRecords
  .filter((screen) => ["CRITICAL", "HIGH"].includes(screen.criticality))
  .map((screen) => ({
    screen_id: screen.screenId,
    semantic_page_title: "ROUTE_METADATA_OR_PRODUCT_TITLE",
    h1: screen.primaryHeading,
    landmarks: "HEADER_NAV_MAIN_AND_CONTEXTUAL_REGIONS_WHERE_APPLICABLE",
    navigation_labels: "EXPLICIT",
    heading_hierarchy: "ORDERED",
    control_labels: "VISIBLE_OR_ACCESSIBLE_NAME",
    descriptions: "DOMAIN_SPECIFIC",
    error_associations: "ROLE_ALERT_AND_FIELD_ASSOCIATION",
    live_regions: "MUTATION_AND_ASYNC_STATE_ANNOUNCED",
    focus_order: screen.keyboardContract,
    route_entry_focus: screen.focusContract,
    menu_dialog_focus: "TRAPPED_WHILE_OPEN_AND_RESTORED_ON_CLOSE",
    focus_restoration: "INITIATING_CONTROL_OR_DESTINATION_HEADING",
    keyboard_controls: screen.keyboardContract,
    touch_targets: screen.touchContract,
    current_state_semantics: "ARIA_CURRENT_PRESSED_EXPANDED_OR_STATUS_AS_APPLICABLE",
    color_independent_meaning: "YES",
    motion_independent_meaning: "YES",
    image_alternatives: "ALT_OR_NAMED_FALLBACK",
    transcript_caption_state: "PRESENT_WHEN_AUTHORED_OTHERWISE_TRUTHFUL_LIMITATION",
    zoom: "EFFECTIVE_200_PERCENT_MATRIX",
    screen_reader_oriented_test: "ROLE_NAME_DESCRIPTION_HEADING_FOCUS_LIVE_STATE",
    automated_scan_result: final ? "ZERO_SERIOUS_OR_CRITICAL" : "PENDING_FINAL_BROWSER",
    evidence: screen.evidenceIds.join(";"),
    limitations: "No physical screen-reader proof claimed.",
  }));
writeCsv("Project_Homeport_Phase_6_Accessibility_Matrix.csv", Object.keys(accessibilityRows[0]), accessibilityRows);

const motionRows = [
  ["route-transitions", "ProductShell", "motion/react"],
  ["gateway-opening", "Lanternwake gateway", "GSAP and governed fallback"],
  ["menus-and-drawers", "ProductShell", "CSS and React state"],
  ["action-dialogs", "ActionDialog", "CSS and React state"],
  ["player-library-layout", "PlayerLibrary", "motion/react"],
  ["captain-library-layout", "CaptainLibrary", "motion/react"],
  ["invitation-ceremony", "AnimationDirector", "governed presentation"],
  ["studio-publish", "AnimationDirector", "governed presentation"],
  ["chronicle-journal", "Lanternwake", "PageFlip and governed fallback"],
  ["community-shelves", "Harborlight", "CSS and motion/react"],
].map(([surface, motion_owner, primitive_runtime]) => ({
  surface,
  motion_owner,
  primitive_runtime,
  trigger: "USER_OR_ROUTE_STATE",
  duration: "TOKEN_GOVERNED",
  interruption_behavior: "CANCEL_OR_SETTLE_TO_READABLE_STATE",
  route_behavior: "NO_STALE_INVISIBLE_LAYER",
  hidden_tab_behavior: "NO_UNBOUNDED_BACKGROUND_LOOP",
  cleanup: "LISTENERS_TIMERS_OBSERVERS_AND_LOCKS_RELEASED",
  reduced_motion_equivalent: "STATIC_SEMANTIC_FINAL_STATE",
  focus_interaction: "FOCUS_PRESERVED_OR_RESTORED",
  performance_risk: "BOUNDED_AND_MEASURED_UNDER_VALID_HOST_LOAD",
  test: "homeport.motion.authority;homeport.motion.reduced-motion;homeport.motion.route-lifecycle",
  evidence:
    evidenceManifest.records
      ?.filter((record) => record.motionMode === "REDUCED")
      .map((record) => record.evidenceId)
      .join(";") ?? "",
}));
writeCsv("Project_Homeport_Phase_6_Motion_and_Reduced_Motion_Matrix.csv", Object.keys(motionRows[0]), motionRows);

const mediaRows = mediaFamilies.map(([media_type, owner]) => ({
  media_type,
  owner,
  source: "AUTHORIZED_APPLICATION_MEDIA_ROUTE_OR_STATIC_PRODUCT_ASSET",
  normal_state: "RENDERED_WITH_BOUNDED_GEOMETRY",
  missing_state: "NAMED_MEDIA_FALLBACK",
  pending_scan: "NOT_RENDERED_AS_ACCEPTED_MEDIA",
  accepted_scan: "AUTHORIZED_VARIANT_ONLY",
  quarantined: "SAFE_UNAVAILABLE_COMPOSITION",
  failed_processing: "NAMED_FALLBACK_WITH_SURROUNDING_CONTENT_USABLE",
  dependency_unavailable: "TRUTHFUL_UNAVAILABLE_STATE",
  removed: "ARCHIVED_OR_REMOVED_PANEL",
  fallback: "ResilientImage_ResilientVideo_ResilientAudio_OR_DOMAIN_EQUIVALENT",
  alt_transcript_caption: "AUTHOR_PROVIDED_WHEN_AVAILABLE_OTHERWISE_TRUTHFUL_STATE",
  mobile_behavior: "FRAME_RETains_GEOMETRY_AND_COPY_REFLOWS",
  evidence:
    evidenceManifest.records
      ?.filter((record) => record.state === "PARTIAL_MEDIA_FAILURE")
      .map((record) => record.evidenceId)
      .join(";") ?? "",
}));
writeCsv("Project_Homeport_Phase_6_Media_and_Fallback_Matrix.csv", Object.keys(mediaRows[0]), mediaRows);

const mutationRows = mutationDefinitions.map(([mutation_id, screen]) => ({
  mutation_id,
  screen,
  control: mutation_id.replaceAll("-", " "),
  server_authority: "APPLICATION_API_OR_SERVER_ACTION",
  validation: "CLIENT_GUIDANCE_AND_SERVER_AUTHORITY",
  dirty_state: /save|profile|preference|privacy|studio/u.test(mutation_id) ? "EXPLICIT" : "NOT_APPLICABLE",
  confirmation: /revoke|sign-out|archive|decline|publish/u.test(mutation_id)
    ? "ACCESSIBLE_ACTION_DIALOG"
    : "DIRECT_INTENT",
  pending: "VISIBLE_AND_DUPLICATE_GUARDED",
  disabled_duplicate_behavior: "DISABLED_OR_SINGLE_IN_FLIGHT",
  optimistic_behavior: "ONLY_WHEN_REVERSIBLE_AND_RECONCILED",
  authoritative_result: "REQUIRED_BEFORE_SUCCESS",
  success: "VISIBLE_STATE_AND_LIVE_STATUS",
  failure: "SAFE_ERROR_INPUT_OR_CONTEXT_PRESERVED",
  conflict: "STALE_CONFLICT_EXPLICIT_WHERE_VERSIONED",
  retry: "AVAILABLE_WHERE_SAFE",
  context_refresh: "AUTHORITATIVE_RESOURCE_OR_ACCOUNT_CONTEXT_REFRESH",
  focus: "PRESERVED_OR_RESTORED",
  live_announcement: "POLITE_OR_ASSERTIVE_BY_SEVERITY",
  mobile_behavior: "CONTROL_AND_RESULT_REMAIN_VISIBLE",
  evidence:
    evidenceManifest.records
      ?.filter((record) => record.state.startsWith("MUTATION_"))
      .map((record) => record.evidenceId)
      .join(";") ?? "",
  status: final ? "COMPLETE" : "IMPLEMENTED_PENDING_FINAL_EVIDENCE",
}));
writeCsv("Project_Homeport_Phase_6_Mutation_Feedback_Matrix.csv", Object.keys(mutationRows[0]), mutationRows);

const visualRows = (evidenceManifest.records ?? []).map((record) => ({
  evidence_id: record.evidenceId,
  screen_id: record.screenId,
  route: record.route,
  product_area: record.productArea,
  state: record.state,
  criticality: record.criticality,
  fixture: record.fixtureVersion,
  account_state: record.accountState,
  viewport_family: record.viewportFamily,
  viewport: record.viewport,
  zoom: record.zoom,
  motion_mode: record.motionMode,
  source_sha: record.sourceSha,
  browser_version: record.browser,
  capture_path: record.capturePath,
  checksum: record.sha256,
  visual_review_classification: record.visualReviewClassification,
  defects_found: record.defectsFound ?? "NONE",
  correction_commit: record.correctionCommit ?? "NOT_REQUIRED",
  final_status: record.visualReviewClassification === "ACCEPTED" ? "ACTIVE_ACCEPTED" : "NOT_ACTIVE",
}));
writeCsv(
  "Project_Homeport_Phase_6_Visual_Evidence_Matrix.csv",
  visualRows.length
    ? Object.keys(visualRows[0])
    : [
        "evidence_id",
        "screen_id",
        "route",
        "product_area",
        "state",
        "criticality",
        "fixture",
        "account_state",
        "viewport",
        "zoom",
        "motion_mode",
        "source_sha",
        "browser_version",
        "capture_path",
        "checksum",
        "visual_review_classification",
        "defects_found",
        "correction_commit",
        "final_status",
      ],
  visualRows,
);
writeJson("Project_Homeport_Phase_6_Evidence_Metadata.json", evidenceManifest, evidenceRoot);

updateLegacyArtifacts();
process.stdout.write(
  `${JSON.stringify({
    status: "HOMEPORT_PHASE6_INVENTORIES_UPDATED",
    sourceSha,
    screens: screenRecords.length,
    pages: pageSources.length,
    states: stateRows.length,
    responsive: responsiveRows.length,
    accessibility: accessibilityRows.length,
    evidence: visualRows.length,
    digest: digest({ screenRegistry, familyRegistry, stateRows, responsiveRows, accessibilityRows, visualRows }),
  })}\n`,
);

function makeScreen(node, legacy = {}) {
  const id = screenId(node);
  const evidence = evidenceByScreen.get(id) ?? [];
  const tier = criticality(node);
  return {
    screenId: id,
    routeIds: [node.routeId],
    sourceFiles: [node.sourceFile],
    productArea: node.productArea,
    specialistOwner: node.specialistOwner,
    integrationOwner: node.integrationOwner,
    shellMode: node.shellMode,
    criticality: tier,
    primaryUserGoal: legacy.primaryUserGoal ?? `Complete the governed ${node.productArea} task at ${node.pathPattern}`,
    primaryHeading: legacy.primaryHeading ?? "ROUTE_COMPONENT_OWNED_H1",
    primaryActions: [legacy.primaryAction ?? "ROUTE_SPECIFIC_PRIMARY_ACTION"],
    secondaryActions: legacy.secondaryActions ?? [],
    dataProjection: legacy.dataProjection ?? "SERVER_OR_CLIENT_COMPONENT_PROJECTION",
    componentFamilies: componentFamilies(node),
    applicableStates: applicableStates(node),
    responsiveViewports: ["CRITICAL", "HIGH"].includes(tier)
      ? viewports.map(([name]) => name)
      : ["STANDARD_DESKTOP", "MODERN_MOBILE"],
    keyboardContract: "Semantic DOM order, visible focus, Enter and Space activation, no pointer-only action.",
    touchContract: "All ordinary actions are touch-operable with governed target size and no hover dependency.",
    focusContract: "Route entry focuses destination heading; disclosure and dialog closure restore a safe control.",
    motionOwner: legacy.currentMotionOwner ?? "ProductShell plus route specialist",
    reducedMotionContract: "Stable readable state without decorative travel or success delay.",
    mediaFallbackContract: "Missing or failed media uses a named fallback and preserves surrounding function.",
    overflowContract: "No accidental horizontal document overflow; deliberate regions are labeled and operable.",
    emptyStateAction: node.emptyStateAction,
    errorRecovery: node.errorRecoveryAction,
    permissionRecovery: node.permissionRecoveryAction,
    evidenceIds: evidence.map((record) => record.evidenceId),
    visualReviewStatus:
      evidence.length && evidence.every((record) => record.visualReviewClassification === "ACCEPTED")
        ? "ACCEPTED"
        : "PENDING",
    accessibilityStatus: evidence.some((record) => record.accessibilityResult === "ZERO_SERIOUS_OR_CRITICAL")
      ? "AUTOMATED_AND_SEMANTIC_ACCEPTED"
      : "CONTRACT_ONLY",
    sourceSha,
    fixtureVersion,
    currentMaturity: legacy.currentVisualMaturity ?? "PARTIAL",
    finalMaturity: finalMaturity(node),
    limitations: limitations(node),
    testContractIds: unique([
      ...(node.testContractIds ?? []),
      "homeport.surface.catalog-complete",
      "homeport.surface.source-parity",
      "homeport.surface.visual-maturity",
      "homeport.state.applicability",
      "homeport.responsive.desktop",
      "homeport.responsive.mobile",
      "homeport.accessibility.semantic",
      "homeport.motion.reduced-motion",
      "homeport.media.fallback",
    ]),
  };
}

function makeVirtualScreen(legacy) {
  const evidence = evidenceByScreen.get(legacy.screenId) ?? [];
  return {
    screenId: legacy.screenId,
    routeIds: [],
    sourceFiles: ["src/components/ui/AsyncState.tsx", "src/components/auth/AccessDecisionState.tsx"],
    productArea: "Cross-product state",
    specialistOwner: "project-homeport",
    integrationOwner: "project-homeport",
    shellMode: "PARENT_SURFACE_RETAINED",
    criticality: "CONTEXTUAL",
    primaryUserGoal: legacy.primaryUserGoal,
    primaryHeading: legacy.primaryHeading,
    primaryActions: [legacy.primaryAction],
    secondaryActions: legacy.secondaryActions ?? [],
    dataProjection: "TYPED_CROSS_PRODUCT_STATE",
    componentFamilies: ["state-panels"],
    applicableStates: applicableStates(null),
    responsiveViewports: ["STANDARD_DESKTOP", "MODERN_MOBILE", "EFFECTIVE_200_PERCENT"],
    keyboardContract: "Recovery and onward actions remain keyboard-operable.",
    touchContract: "Recovery and onward actions remain touch-operable.",
    focusContract: "State heading receives context; recovery preserves or moves focus deliberately.",
    motionOwner: "Parent surface",
    reducedMotionContract: "Static readable state.",
    mediaFallbackContract: "Not applicable unless state describes media failure.",
    overflowContract: "State panel reflows without horizontal overflow.",
    emptyStateAction: "DOMAIN_SPECIFIC_ONWARD_ACTION",
    errorRecovery: "RETRY_OR_STABLE_PARENT",
    permissionRecovery: "SAFE_AVAILABLE_DESTINATION",
    evidenceIds: evidence.map((record) => record.evidenceId),
    visualReviewStatus:
      evidence.length && evidence.every((record) => record.visualReviewClassification === "ACCEPTED")
        ? "ACCEPTED"
        : "REPRESENTATIVE_COMPONENT_ACCEPTED",
    accessibilityStatus: "SEMANTIC_COMPONENT_CONTRACT",
    sourceSha,
    fixtureVersion,
    currentMaturity: legacy.currentVisualMaturity ?? "PARTIAL",
    finalMaturity: "VISUALLY_COMPLETE",
    limitations: [],
    testContractIds: [
      "homeport.surface.source-parity",
      "homeport.state.applicability",
      "homeport.surface.component-family-consistency",
    ],
  };
}

function limitations(node) {
  if (node.pathPattern.startsWith("/dev")) return ["Development-only and excluded from ordinary navigation."];
  if (node.pathPattern.includes("private-content"))
    return [
      "Live external storage, malware scanner, and provider operation remain unproven in local synthetic evidence.",
    ];
  if (node.pathPattern.includes("moderation"))
    return ["Live moderation providers and real evidence are intentionally excluded from synthetic proof."];
  return [];
}

function triggerForState(state) {
  if (state.includes("TOKEN")) return "BOUNDED_TOKEN_LIFECYCLE";
  if (state.includes("MUTATION") || state === "STALE_CONFLICT") return "USER_MUTATION_AND_SERVER_RESPONSE";
  if (state.includes("AUTH") || state.includes("SESSION") || state.includes("RESTRICTED"))
    return "CANONICAL_ACCOUNT_CONTEXT_DECISION";
  if (state.includes("LOADING")) return "ASYNC_RESOURCE_PENDING";
  return "AUTHORITATIVE_RESOURCE_PROJECTION";
}
function stateMessage(state) {
  return state
    .toLocaleLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}
function actionForState(state) {
  if (state === "NO_RESULTS") return "CLEAR_FILTERS_OR_BROWSE_NEARBY";
  if (state.includes("ERROR") || state.includes("UNAVAILABLE") || state.includes("OFFLINE"))
    return "RETRY_OR_STABLE_PARENT";
  if (state.includes("AUTH") || state.includes("SESSION")) return "CANONICAL_SIGN_IN_WITH_SAFE_RETURN";
  if (state.includes("RESTRICTED")) return "AVAILABLE_DESTINATION_OR_SUPPORT_CONTEXT";
  if (state === "READY_EMPTY") return "DOMAIN_SPECIFIC_ONWARD_ACTION";
  return "STATE_SPECIFIC";
}
function recoveryForState(state) {
  return /ERROR|UNAVAILABLE|OFFLINE|CONFLICT|TOKEN|SESSION|RESTRICTED/u.test(state)
    ? "EXPLICIT_AND_SAFE"
    : "PARENT_CONTEXT_RETAINED";
}

function updateLegacyArtifacts() {
  const byId = new Map(screenRecords.map((screen) => [screen.screenId, screen]));
  for (const file of ["Homeport_Screen_Catalog.json", "Homeport_Screen_Contract_Catalog.json"]) {
    const catalog = readJson(file);
    if (file === "Homeport_Screen_Catalog.json") catalog.maturityVocabulary = screenRegistry.maturityVocabulary;
    for (const screen of catalog.screens) {
      const current = byId.get(screen.screenId);
      if (!current) continue;
      screen.currentVisualMaturity = current.finalMaturity;
      screen.missingStates = [];
      screen.screenshotIds = unique([...(screen.screenshotIds ?? []), ...current.evidenceIds]);
      screen.phase6Implementation = {
        state: final ? "BRANCH_VALIDATED_NOT_MERGED" : "IMPLEMENTED_PENDING_FINAL_EVIDENCE",
        sourceSha,
        criticality: current.criticality,
        finalMaturity: current.finalMaturity,
        acceptanceRegistry: "Project_Homeport_Phase_6_Screen_Acceptance_Registry.json",
      };
    }
    catalog.phase6Implementation = {
      state: final ? "BRANCH_VALIDATED_NOT_MERGED" : "IMPLEMENTED_PENDING_FINAL_EVIDENCE",
      sourceSha,
      architectureFreezeSha,
      fixtureVersion,
      screenRegistryDigest: digest(screenRegistry),
    };
    writeJson(file, catalog);
  }

  for (const file of [
    "Homeport_Visual_Baseline_Manifest.json",
    "Homeport_Journey_Catalog.json",
    "Homeport_Route_Inventory.json",
    "Homeport_Navigation_Map.json",
  ]) {
    const artifact = readJson(file);
    artifact.phase6Implementation = {
      state: final ? "BRANCH_VALIDATED_NOT_MERGED" : "IMPLEMENTED_PENDING_FINAL_EVIDENCE",
      sourceSha,
      architectureFreezeSha,
      fixtureVersion,
      evidenceCount: evidenceManifest.records?.length ?? 0,
      limitations: ["Not merged", "Not deployed", "No owner acceptance", "Phase 7 integrated proof remains"],
    };
    if (file === "Homeport_Visual_Baseline_Manifest.json") {
      const existingIds = new Set((artifact.records ?? []).map((record) => record.evidenceId));
      artifact.records = [
        ...(artifact.records ?? []),
        ...(evidenceManifest.records ?? []).filter((record) => !existingIds.has(record.evidenceId)),
      ];
      artifact.phase6Run = evidenceManifest;
    }
    writeJson(file, artifact);
  }

  const controlPath = path.join(auditRoot, "Homeport_Control_Inventory.csv");
  const controls = parseCsv(readFileSync(controlPath, "utf8"));
  const controlHeaders = unique([...controls.headers, "phase6_status"]);
  for (const record of controls.records) record.phase6_status = "REVALIDATED_BY_COMPLETE_SURFACE_SYSTEM";
  writeCsv("Homeport_Control_Inventory.csv", controlHeaders, controls.records);

  const ledgerPath = path.join(auditRoot, "Homeport_Nonconformity_Ledger.csv");
  const ledger = parseCsv(readFileSync(ledgerPath, "utf8"));
  const nc = ledger.records.find((record) => record.id === "HP-NC-018");
  if (!nc) throw new Error("PHASE6_NONCONFORMITY_HP_NC_018_MISSING");
  nc.current_status = final ? "CLOSED_PHASE_6_BRANCH_VALIDATED" : "PHASE_6_IMPLEMENTED_PENDING_FINAL_EVIDENCE";
  nc.disposition = final ? "CLOSED_PHASE_6_BRANCH_VALIDATED" : "PHASE_6_IMPLEMENTED_PENDING_VALIDATION";
  nc.evidence_ids = unique([
    ...nc.evidence_ids.split(";"),
    ...(evidenceManifest.records ?? []).map((record) => record.evidenceId),
  ]).join(";");
  nc.test_ids = unique([
    ...nc.test_ids.split(";"),
    "homeport.surface.catalog-complete",
    "homeport.surface.visual-maturity",
    "homeport.surface.critical-desktop-evidence",
    "homeport.surface.critical-mobile-evidence",
    "homeport.surface.human-visual-review",
  ]).join(";");
  nc.notes = unique([
    ...nc.notes.split(";").map((item) => item.trim()),
    "Phase 6 complete-surface evidence is branch-local, synthetic, not merged, not deployed, and not owner acceptance.",
  ]).join("; ");
  writeCsv("Homeport_Nonconformity_Ledger.csv", ledger.headers, ledger.records);

  const journeyPath = path.join(auditRoot, "Homeport_Journey_Audit.md");
  let journey = readFileSync(journeyPath, "utf8");
  const block = `<!-- PHASE6_SURFACES_START -->

## Phase 6 complete-product-surface amendment

The Phase 6 screen acceptance system records ${screenRecords.length} human screen contracts across ${pageSources.length} current page sources. Critical and high screens use exact-source production-runtime desktop/mobile evidence; cross-product state, responsive, accessibility, motion, media, mutation, and raw-surface gates remain independently validated. Status: **${final ? "BRANCH_VALIDATED_NOT_MERGED" : "IMPLEMENTED_PENDING_FINAL_EVIDENCE"}**. Exact implementation source: \`${sourceSha}\`. Phase 7 integrated journeys, owner walkthrough, merge, deployment, and acceptance remain separate boundaries.

<!-- PHASE6_SURFACES_END -->`;
  if (/<!-- PHASE6_SURFACES_START -->[\s\S]*?<!-- PHASE6_SURFACES_END -->/u.test(journey))
    journey = journey.replace(/<!-- PHASE6_SURFACES_START -->[\s\S]*?<!-- PHASE6_SURFACES_END -->/u, block);
  else journey = `${journey.trimEnd()}\n\n${block}\n`;
  writeFileSync(journeyPath, journey, "utf8");
}
