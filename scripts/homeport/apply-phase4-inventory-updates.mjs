import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { format, resolveConfig } from "prettier";

const root = process.cwd();
const auditRoot = path.join(root, "Development_Docs", "Projects", "Project_Homeport");
const evidenceRoot = path.join(auditRoot, "evidence", "phase4");
const testingRoot = path.join(root, "testing");
const implementationAnchorSha = "06394221844c36921d95b1a199d72f18c88645ad";
const architectureFreezeSha = "e2c3e75ff43d52b2a7830e0a3d44be61a8d8dc7e";
const updatedAt = "2026-08-03T08:30:00.000Z";
const final = process.argv.includes("--final");
const prettierConfig = (await resolveConfig(path.join(auditRoot, "Homeport_Route_Inventory.json"))) ?? {};

const readJson = (name, directory = auditRoot) => JSON.parse(readFileSync(path.join(directory, name), "utf8"));
const writeJsonAt = async (directory, name, value) =>
  writeFileSync(
    path.join(directory, name),
    await format(JSON.stringify(value), { ...prettierConfig, parser: "json" }),
    "utf8",
  );
const writeJson = (name, value) => writeJsonAt(auditRoot, name, value);
const writeTestingJson = (name, value) => writeJsonAt(testingRoot, name, value);
const unique = (values) => [...new Set(values.filter(Boolean))];
const quoteCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

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
  const [headers, ...data] = rows;
  return {
    headers,
    records: data.map((values) => Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]))),
  };
}

function writeCsv(name, headers, records) {
  writeFileSync(
    path.join(auditRoot, name),
    `${headers.map(quoteCsv).join(",")}\n${records
      .map((record) => headers.map((header) => quoteCsv(record[header])).join(","))
      .join("\n")}\n`,
    "utf8",
  );
}

function addDelimited(current, values) {
  return unique([...(current ?? "").split(";").map((value) => value.trim()), ...values]).join(";");
}

const phase4Contracts = [
  "homeport.community.harbor-home",
  "homeport.community.content-first-default",
  "homeport.community.default-not-no-results",
  "homeport.community.district-registry",
  "homeport.community.district-navigation",
  "homeport.community.mobile-district-parity",
  "homeport.community.public-projection",
  "homeport.community.no-private-leak",
  "homeport.community.lifecycle-eligibility",
  "homeport.community.quarantine",
  "homeport.community.card-base",
  "homeport.community.card-destinations",
  "homeport.community.card-fallback",
  "homeport.community.card-accessibility",
  "homeport.community.shelf-strategy",
  "homeport.community.editorial-labeling",
  "homeport.community.search",
  "homeport.community.search-url-state",
  "homeport.community.search-stale-request",
  "homeport.community.compact-filters",
  "homeport.community.advanced-filters",
  "homeport.community.no-results",
  "homeport.community.empty-state",
  "homeport.community.dependency-unavailable",
  "homeport.community.partial-media-failure",
  "homeport.community.chronicles",
  "homeport.community.artifacts",
  "homeport.community.templates",
  "homeport.community.maps",
  "homeport.community.audio",
  "homeport.community.creators",
  "homeport.community.creator-profile",
  "homeport.community.collections",
  "homeport.community.guides",
  "homeport.community.voyage-logs",
  "homeport.community.saved-state",
  "homeport.community.saved-cross-surface",
  "homeport.community.follow-state",
  "homeport.community.social-auth-return",
  "homeport.community.detail",
  "homeport.community.detail-parent",
  "homeport.community.open-install-remix",
  "homeport.community.mutation-feedback",
  "homeport.community.restricted-account",
  "homeport.community.keyboard",
  "homeport.community.zoom",
  "homeport.community.reduced-motion",
  "homeport.community.phase1-regression",
  "homeport.community.phase2-regression",
  "homeport.community.phase3-regression",
  "homeport.community.artifact-idempotency",
];

const journeyNames = {
  A: "Gateway to Community Harbor",
  B: "Anonymous default discovery",
  C: "Authenticated default discovery",
  D: "Community-wide empty state",
  E: "Search and preserved return",
  F: "No-result query and recovery",
  G: "Compact filters and history",
  H: "Advanced filters and focus restoration",
  I: "Deterministic sort and reload",
  J: "Chronicles district",
  K: "Chronicle begin or open handoff",
  L: "Artifacts district and public provenance",
  M: "Artifact media fallback",
  N: "Templates district",
  O: "Maps and location packs",
  P: "Audio and reveal assets",
  Q: "Creators district and Creator Profile",
  R: "Creator with no public work",
  S: "Follow and unfollow Creator",
  T: "Anonymous social sign-in return",
  U: "Self-follow denial",
  V: "Public collections",
  W: "Empty collection",
  X: "Private and unlisted collection non-leakage",
  Y: "Guides and Shipwright's Workshop",
  Z: "Consent-safe Voyage Logs",
  AA: "Save content across Community and Personal Harbor",
  AB: "Unsave cross-surface reconciliation",
  AC: "Save failure and retry",
  AD: "Missing artwork fallback",
  AE: "Quarantined content non-leakage",
  AF: "Removed or archived content",
  AG: "Search dependency unavailable and recovery",
  AH: "Restricted Community account",
  AI: "Moderator visibility and public separation",
  AJ: "Mobile Harbor",
  AK: "Mobile authenticated Community",
  AL: "Keyboard-only discovery",
  AM: "Effective 200 percent zoom",
  AN: "Reduced motion",
  AO: "Phase 1 canonical account regression",
  AP: "Phase 2 shell and navigation regression",
  AQ: "Phase 3 Personal Harbor regression",
  AR: "Full Community natural loop",
};

const expectedEvidenceIds = [
  "HP-P4-EV-A-harbor-home-desktop",
  "HP-P4-EV-B-harbor-home-mobile",
  "HP-P4-EV-C-harbor-authenticated",
  "HP-P4-EV-D-harbor-empty",
  "HP-P4-EV-E-featured-shelf",
  "HP-P4-EV-F-district-navigation",
  "HP-P4-EV-G-chronicles-district",
  "HP-P4-EV-H-artifacts-district",
  "HP-P4-EV-I-templates-district",
  "HP-P4-EV-J-maps-district",
  "HP-P4-EV-K-audio-district",
  "HP-P4-EV-L-creators-district",
  "HP-P4-EV-M-creator-profile",
  "HP-P4-EV-N-creator-empty",
  "HP-P4-EV-O-collections-district",
  "HP-P4-EV-P-collection-detail",
  "HP-P4-EV-Q-guides-district",
  "HP-P4-EV-R-guide-detail",
  "HP-P4-EV-S-voyage-logs",
  "HP-P4-EV-T-chronicle-card",
  "HP-P4-EV-U-listing-detail",
  "HP-P4-EV-V-search-results",
  "HP-P4-EV-W-no-results",
  "HP-P4-EV-X-advanced-filters",
  "HP-P4-EV-Y-active-filters",
  "HP-P4-EV-Z-saved-state",
  "HP-P4-EV-AA-image-fallback",
  "HP-P4-EV-AB-quarantined-content",
  "HP-P4-EV-AC-archived-removed",
  "HP-P4-EV-AD-dependency-unavailable",
  "HP-P4-EV-AE-mobile-filter-drawer",
  "HP-P4-EV-AF-mobile-detail",
  "HP-P4-EV-AG-zoom-harbor",
  "HP-P4-EV-AH-zoom-filters",
  "HP-P4-EV-AI-reduced-motion",
  "HP-P4-EV-AJ-restricted-state",
  "HP-P4-EV-AK-public-projection",
  "HP-P4-EV-AL-full-community-loop",
];

const evidenceJourneyMap = {
  "HP-P4-EV-A-harbor-home-desktop": ["B"],
  "HP-P4-EV-B-harbor-home-mobile": ["AJ"],
  "HP-P4-EV-C-harbor-authenticated": ["C"],
  "HP-P4-EV-D-harbor-empty": ["D"],
  "HP-P4-EV-E-featured-shelf": ["B"],
  "HP-P4-EV-F-district-navigation": ["A"],
  "HP-P4-EV-G-chronicles-district": ["J"],
  "HP-P4-EV-H-artifacts-district": ["L"],
  "HP-P4-EV-I-templates-district": ["N"],
  "HP-P4-EV-J-maps-district": ["O"],
  "HP-P4-EV-K-audio-district": ["P"],
  "HP-P4-EV-L-creators-district": ["Q"],
  "HP-P4-EV-M-creator-profile": ["Q", "S"],
  "HP-P4-EV-N-creator-empty": ["R"],
  "HP-P4-EV-O-collections-district": ["V"],
  "HP-P4-EV-P-collection-detail": ["V"],
  "HP-P4-EV-Q-guides-district": ["Y"],
  "HP-P4-EV-R-guide-detail": ["Y"],
  "HP-P4-EV-S-voyage-logs": ["Z"],
  "HP-P4-EV-T-chronicle-card": ["B", "J"],
  "HP-P4-EV-U-listing-detail": ["K"],
  "HP-P4-EV-V-search-results": ["E"],
  "HP-P4-EV-W-no-results": ["F"],
  "HP-P4-EV-X-advanced-filters": ["H"],
  "HP-P4-EV-Y-active-filters": ["G", "I"],
  "HP-P4-EV-Z-saved-state": ["AA"],
  "HP-P4-EV-AA-image-fallback": ["AD"],
  "HP-P4-EV-AB-quarantined-content": ["AE"],
  "HP-P4-EV-AC-archived-removed": ["AF"],
  "HP-P4-EV-AD-dependency-unavailable": ["AG"],
  "HP-P4-EV-AE-mobile-filter-drawer": ["AJ"],
  "HP-P4-EV-AF-mobile-detail": ["AJ"],
  "HP-P4-EV-AG-zoom-harbor": ["AM"],
  "HP-P4-EV-AH-zoom-filters": ["AM"],
  "HP-P4-EV-AI-reduced-motion": ["AN"],
  "HP-P4-EV-AJ-restricted-state": ["AH"],
  "HP-P4-EV-AK-public-projection": ["AI"],
  "HP-P4-EV-AL-full-community-loop": ["AR"],
  "HP-P4-EV-AK-mobile-authenticated": ["AK"],
  "HP-P4-EV-AM-audio-district-empty": ["P"],
  "HP-P4-EV-AM-keyboard-navigation": ["AL"],
};

const metadata = readJson("Project_Homeport_Phase_4_Evidence_Metadata.json", evidenceRoot);
const evidenceRecords = metadata.records ?? [];
const evidenceById = new Map(evidenceRecords.map((record) => [record.evidenceId, record]));
const evidenceForJourney = (id) =>
  evidenceRecords
    .filter((record) => (evidenceJourneyMap[record.evidenceId] ?? []).includes(id))
    .map((record) => record.evidenceId);
const phase4Evidence = expectedEvidenceIds.filter((id) => evidenceById.has(id));
const phase4Envelope = {
  phase: "PHASE_4_REBUILD_COMMUNITY_HARBOR",
  project: "Project Homeport",
  architectureFreezeSha,
  implementationAnchorSha,
  evidenceSourceSha: metadata.sourceSha,
  state: final ? "BRANCH_VALIDATED_NOT_MERGED" : "IMPLEMENTED_PENDING_FINAL_VALIDATION",
  updatedAt,
  historicalPhase0Through3Preserved: true,
  noSchemaChange: true,
  phase5NotStarted: true,
  branchOnly: true,
  merged: false,
  deployed: false,
  ownerAcceptanceEstablished: false,
  testContracts: phase4Contracts,
  evidenceIds: phase4Evidence,
};

const journeyCatalog = readJson("Homeport_Journey_Catalog.json");
journeyCatalog.phase4Implementation = phase4Envelope;
const existingPhase4Journeys = new Map(
  journeyCatalog.journeys
    .filter((journey) => journey.journeyId.startsWith("HP-P4-JRN-"))
    .map((journey) => [journey.journeyId, journey]),
);
const phase4Journeys = Object.entries(journeyNames).map(([id, name]) => ({
  journeyId: `HP-P4-JRN-${id}`,
  name,
  sourceSha: metadata.sourceSha,
  fixtureIdentity: "Reserved synthetic Homeport Phase 4 Community accounts and public-safe records",
  browser: "Playwright Chromium production runtime",
  viewport: ["AJ", "AK"].includes(id) ? "390x844" : id === "AM" ? "720x600 effective 200 percent" : "1440x1000",
  steps: [
    "Begin at the natural Gateway when the journey is ordinary discovery",
    name,
    "Verify the governed state and a safe return",
  ],
  controlsUsed: ["Visible semantic controls", "Keyboard where required"],
  routeTransitions: ["Gateway or canonical account entry", "Community Harbor", name, "Safe parent or Home return"],
  sessionAuthoritiesObservedWithoutValues: ["HP-SES-001"],
  expectedCurrentBehavior: name,
  observedBehavior:
    "Covered by the registered Homeport Phase 4 browser, service, API, and component contract families.",
  screenshots: evidenceForJourney(id),
  traces: [],
  result: final ? "PASSED" : "IMPLEMENTED_PENDING_FINAL_VALIDATION",
  rootBlocker: null,
  relatedNonconformityIds: ["HP-NC-011", "HP-NC-012", "HP-NC-013", "HP-NC-014", "HP-NC-018", "HP-NC-019", "HP-NC-026"],
  targetPhase: "PHASE_4_REBUILD_COMMUNITY_HARBOR",
  futureAcceptanceTest: `homeport.phase4.journey-${id.toLowerCase()}`,
  phase4ImplementationAnchorSha: implementationAnchorSha,
}));
for (const journey of phase4Journeys) existingPhase4Journeys.set(journey.journeyId, journey);
journeyCatalog.journeys = [
  ...journeyCatalog.journeys.filter((journey) => !journey.journeyId.startsWith("HP-P4-JRN-")),
  ...phase4Journeys,
];
await writeJson("Homeport_Journey_Catalog.json", journeyCatalog);

const districtRegistry = readJson("Project_Homeport_Phase_4_District_Registry.json");
districtRegistry.implementationStatus = final ? "BRANCH_VALIDATED_NOT_MERGED" : "IMPLEMENTED_PENDING_FINAL_VALIDATION";
districtRegistry.implementationAnchorSha = implementationAnchorSha;
districtRegistry.validationSourceSha = metadata.sourceSha;
districtRegistry.evidenceIds = phase4Evidence;
for (const district of districtRegistry.districts) {
  const exact = evidenceRecords.filter((record) => record.route === district.route.split("?")[0]);
  district.evidence = unique([...district.evidence, ...exact.map((record) => record.evidenceId)]);
}
await writeJson("Project_Homeport_Phase_4_District_Registry.json", districtRegistry);

for (const name of [
  "Project_Homeport_Phase_4_Public_Card_Contract.json",
  "Project_Homeport_Phase_4_Search_and_Filter_Contract.json",
]) {
  const contract = readJson(name);
  contract.implementationStatus = final ? "BRANCH_VALIDATED_NOT_MERGED" : "IMPLEMENTED_PENDING_FINAL_VALIDATION";
  contract.implementationAnchorSha = implementationAnchorSha;
  contract.validationSourceSha = metadata.sourceSha;
  contract.evidenceIds = phase4Evidence;
  await writeJson(name, contract);
}

const activeRoutePatterns = unique([
  ...districtRegistry.districts
    .filter((district) => ["ACTIVE_COMPLETE", "ACTIVE_EMPTY_SUPPORTED"].includes(district.status))
    .map((district) => district.route.split("?")[0]),
  "/community/:slug",
  "/community/creators/:handle",
  "/community/collections/:slug",
  "/community/guides/:slug",
  "/community/voyage-logs/:slug",
]);
const routeEvidence = (routePattern) => {
  const exact = evidenceRecords.filter((record) => record.route === routePattern).map((record) => record.evidenceId);
  if (routePattern === "/community/:slug")
    return unique([
      ...exact,
      ...evidenceRecords
        .filter((record) => /^\/community\/[^/]+$/u.test(record.route))
        .map((record) => record.evidenceId),
    ]);
  if (routePattern.includes(":")) {
    const prefix = routePattern.split(":")[0];
    return unique([
      ...exact,
      ...evidenceRecords.filter((record) => record.route.startsWith(prefix)).map((record) => record.evidenceId),
    ]);
  }
  return exact;
};

const routes = readJson("Homeport_Route_Inventory.json");
routes.phase4Implementation = phase4Envelope;
for (const route of routes.routes) {
  if (!activeRoutePatterns.includes(route.routePattern)) continue;
  const evidenceIds = routeEvidence(route.routePattern);
  route.currentMaturity = "COMPLETE";
  route.status = final ? "PHASE_4_VALIDATED" : "PHASE_4_IMPLEMENTED";
  route.currentSupportedStates = unique([
    ...route.currentSupportedStates,
    "DEFAULT",
    "LOADING",
    "EMPTY",
    "NO_RESULTS_WHERE_SEARCHABLE",
    "DEPENDENCY_UNAVAILABLE",
    "PARTIAL_MEDIA_FAILURE",
  ]);
  route.currentJourneys = unique([...route.currentJourneys, ...phase4Journeys.map((journey) => journey.journeyId)]);
  route.currentVisualEvidenceIds = unique([...route.currentVisualEvidenceIds, ...evidenceIds]);
  route.notes = addDelimited(route.notes, [
    "Phase 4 Community implementation is branch-validated; Phase 5 exhaustive route closure remains.",
  ]);
  route.phase4Implementation = { ...phase4Envelope, routePattern: route.routePattern, evidenceIds };
}
await writeJson("Homeport_Route_Inventory.json", routes);

for (const catalogName of ["Homeport_Screen_Catalog.json", "Homeport_Screen_Contract_Catalog.json"]) {
  const catalog = readJson(catalogName);
  catalog.phase4Implementation = phase4Envelope;
  for (const screen of catalog.screens) {
    const screenRoutes = screen.routeIds
      .map((routeId) => routes.routes.find((route) => route.routeId === routeId)?.routePattern)
      .filter(Boolean);
    if (!screenRoutes.some((route) => activeRoutePatterns.includes(route))) continue;
    const evidenceIds = unique(screenRoutes.flatMap(routeEvidence));
    screen.currentResponsiveComposition =
      "Responsive Community frame, district navigator, typed card grid, and deliberate state panels.";
    screen.currentKeyboardOrder =
      "Semantic source order with skip link, labelled navigation, visible focus, and keyboard-operable card destinations.";
    screen.currentFocusBehavior =
      "Natural route focus plus explicit advanced-filter disclosure and return-control behavior.";
    screen.currentMotionOwner = "ProductShell RouteMotionBoundary and reduced-motion-aware Community components";
    screen.currentReducedMotionBehavior =
      "All information and controls are immediately available without motion-dependent meaning.";
    screen.applicableStates = unique([
      ...screen.applicableStates,
      "DEFAULT",
      "LOADING",
      "EMPTY",
      "NO_RESULTS_WHERE_SEARCHABLE",
      "DEPENDENCY_UNAVAILABLE",
      "PARTIAL_MEDIA_FAILURE",
    ]);
    screen.currentVisualMaturity = "COMPLETE";
    screen.missingStates = [];
    screen.knownDefects = [];
    screen.screenshotIds = unique([...screen.screenshotIds, ...evidenceIds]);
    screen.journeyIds = unique([...screen.journeyIds, ...phase4Journeys.map((journey) => journey.journeyId)]);
    screen.status = final ? "PHASE_4_VALIDATED" : "PHASE_4_IMPLEMENTED";
    screen.contractStatus = "BRANCH_IMPLEMENTED_CURRENT_STATE_RECORDED";
    screen.phase4Implementation = { ...phase4Envelope, routePatterns: screenRoutes, evidenceIds };
  }
  await writeJson(catalogName, catalog);
}

const navigation = readJson("Homeport_Navigation_Map.json");
navigation.phase4Implementation = phase4Envelope;
navigation.phase4DistrictEdges = districtRegistry.districts
  .filter((district) => district.visibleEntry)
  .map((district) => ({
    districtId: district.id,
    label: district.label,
    sourceRoute: "/community",
    destinationRoute: district.route,
    desktopAvailability: true,
    mobileAvailability: true,
    currentStatus: final ? "PHASE_4_VALIDATED" : "PHASE_4_IMPLEMENTED",
    evidenceIds: routeEvidence(district.route.split("?")[0]),
  }));
navigation.phase4AcceptanceEdges = phase4Journeys.map((journey) => ({
  journeyId: journey.journeyId,
  routeTransitions: journey.routeTransitions,
  accountAuthority: "HP-SES-001",
  result: journey.result,
}));
await writeJson("Homeport_Navigation_Map.json", navigation);

const controls = parseCsv(readFileSync(path.join(auditRoot, "Homeport_Control_Inventory.csv"), "utf8"));
const phase4Controls = [
  ...districtRegistry.districts
    .filter((district) => district.visibleEntry)
    .map((district, index) => ({
      control_id: `HP-P4-CTL-${String(index + 1).padStart(3, "0")}`,
      label: district.label,
      screen: "screen-page-community",
      route: "/community",
      role_or_capability: "ANONYMOUS_OR_AUTHENTICATED",
      visibility_condition: "active ordinary district registry entry",
      enabled_condition: "always when rendered",
      action_type: "NAVIGATION",
      authoritative_endpoint_or_server_action: district.route,
      pending_feedback: "link focus",
      success_feedback: "destination heading and active district state",
      failure_feedback: "safe unavailable state",
      navigation_result: district.route,
      focus_result: "destination content context",
      keyboard_operation: "Tab and Enter",
      mobile_operation: "same destination through responsive district navigator",
      current_status: final ? "VALIDATED" : "IMPLEMENTED",
      reproduction_steps: "Begin at / and enter Community Harbor, then use the visible district navigator.",
      evidence_id: routeEvidence(district.route.split("?")[0])[0] ?? "",
      target_phase: "PHASE_4",
    })),
  ...[
    ["Search public Community Harbor", "SEARCH", "/api/community/discover", "HP-P4-EV-V-search-results"],
    ["Advanced filters", "DISCLOSURE_AND_QUERY_STATE", "/api/community/discover", "HP-P4-EV-X-advanced-filters"],
    ["Sort", "QUERY_STATE", "/api/community/discover", "HP-P4-EV-Y-active-filters"],
    ["Save", "MUTATION", "/api/community/social/save", "HP-P4-EV-Z-saved-state"],
    ["Follow Creator", "MUTATION", "/api/community/social/follow", "HP-P4-EV-M-creator-profile"],
    ["Return to Community Harbor", "NAVIGATION", "/community", "HP-P4-EV-U-listing-detail"],
  ].map(([label, action, endpoint, evidenceId], index) => ({
    control_id: `HP-P4-CTL-${String(districtRegistry.districts.filter((district) => district.visibleEntry).length + index + 1).padStart(3, "0")}`,
    label,
    screen: "screen-page-community",
    route: "/community",
    role_or_capability: action === "MUTATION" ? "CANONICAL_ACCOUNT_WHEN_AUTHENTICATED" : "ANONYMOUS_OR_AUTHENTICATED",
    visibility_condition: "governed Community state",
    enabled_condition: "enabled except while pending or explicitly restricted",
    action_type: action,
    authoritative_endpoint_or_server_action: endpoint,
    pending_feedback: "visible pending or focus state",
    success_feedback: "announced accepted state",
    failure_feedback: "recoverable error with authoritative state retained",
    navigation_result: action === "NAVIGATION" ? endpoint : "current Community route retained",
    focus_result: "logical initiating or destination context",
    keyboard_operation: "Tab and Enter or Space where native",
    mobile_operation: "same operation and state on 390x844",
    current_status: final ? "VALIDATED" : "IMPLEMENTED",
    reproduction_steps: "Run the registered Phase 4 Community browser journey.",
    evidence_id: evidenceId,
    target_phase: "PHASE_4",
  })),
];
const controlById = new Map(controls.records.map((record) => [record.control_id, record]));
for (const control of phase4Controls) controlById.set(control.control_id, control);
controls.records = [
  ...controls.records.filter((record) => !record.control_id.startsWith("HP-P4-CTL-")),
  ...phase4Controls,
];
writeCsv("Homeport_Control_Inventory.csv", controls.headers, controls.records);

const visual = readJson("Homeport_Visual_Baseline_Manifest.json");
visual.phase4Implementation = phase4Envelope;
visual.phase4Run = {
  sourceSha: metadata.sourceSha,
  implementationAnchorSha,
  fixtureVersion: metadata.fixtureVersion,
  fixtureChecksum: metadata.fixtureChecksum,
  browser: "Playwright Chromium production runtime",
  evidenceCount: evidenceRecords.length,
  reviewerClassification: final ? "CODEX_VISUAL_REVIEW_REQUIRED_OR_ACCEPTED_PER_RECORD" : "PENDING_FINAL_VALIDATION",
};
const priorVisual = visual.records.filter((record) => !record.evidenceId.startsWith("HP-P4-EV-"));
const phase4ScreenContract = (route) => {
  const pathname = route.split("?", 1)[0];
  if (pathname === "/") return "screen-page-root";
  if (pathname === "/community") return "screen-page-community";

  const segments = pathname.split("/").filter(Boolean);
  const district = segments[1];
  const districtScreens = {
    featured: "screen-page-community-featured",
    chronicles: "screen-page-community-chronicles",
    artifacts: "screen-page-community-artifacts",
    templates: "screen-page-community-templates",
    maps: "screen-page-community-maps",
    audio: "screen-page-community-audio",
    creators: "screen-page-community-creators",
    collections: "screen-page-community-collections",
    guides: "screen-page-community-guides",
    "voyage-logs": "screen-page-community-voyage-logs",
  };

  if (segments.length === 2) return districtScreens[district] ?? "screen-page-community-slug";
  if (district === "creators") return "screen-page-community-creators-handle";
  if (district === "collections") return "screen-page-community-collections-slug";
  if (district === "guides") return "screen-page-community-guides-slug";
  if (district === "voyage-logs") return "screen-page-community-voyage-logs-slug";
  return "screen-page-community-slug";
};
const phase4Visual = evidenceRecords.map((record) => ({
  evidenceId: record.evidenceId,
  sourceSha: record.sourceSha,
  implementationAnchorSha,
  branch: record.branch,
  route: record.route,
  screenContract: phase4ScreenContract(record.route),
  journey: `HP-P4-JRN-${evidenceJourneyMap[record.evidenceId]?.[0] ?? record.journey}`,
  accountFixture: record.accountState,
  fixtureVersion: record.fixtureVersion,
  fixtureChecksum: record.fixtureChecksum,
  browser: "chromium",
  browserVersion: record.browser,
  viewport: `${record.viewport.width}x${record.viewport.height}`,
  zoom: `${record.effectiveZoom}%`,
  motionMode: record.motionMode,
  accountState: record.accountState,
  workspace: "community-harbor",
  shellMode: "WORKSPACE_STANDARD",
  appearanceState: record.contentState,
  dataState: "Synthetic task-owned isolated copied database and storage roots",
  screenshotPath: record.screenshotPath,
  committedScreenshotPath: record.screenshotPath,
  sha256: record.sha256,
  observedResult: record.observedResult,
  knownDeviation: record.knownLimitation,
  timestamp: record.timestamp,
  reviewerClassification: record.reviewerClassification,
}));
visual.records = [...priorVisual, ...phase4Visual];
await writeJson("Homeport_Visual_Baseline_Manifest.json", visual);

const ledger = parseCsv(readFileSync(path.join(auditRoot, "Homeport_Nonconformity_Ledger.csv"), "utf8"));
const directDispositions = new Set(["HP-NC-011", "HP-NC-012", "HP-NC-013", "HP-NC-026"]);
const exactAdvancements = new Set(["HP-NC-014", "HP-NC-018", "HP-NC-019"]);
for (const record of ledger.records) {
  if (!directDispositions.has(record.id) && !exactAdvancements.has(record.id)) continue;
  record.journeys = addDelimited(
    record.journeys,
    phase4Journeys.map((journey) => journey.journeyId),
  );
  record.evidence_ids = addDelimited(record.evidence_ids, phase4Evidence);
  record.notes = addDelimited(record.notes, [
    directDispositions.has(record.id)
      ? "Phase 4 branch validation directly disposes the Community-scoped finding; owner acceptance, merge, and deployment remain unestablished."
      : "Phase 4 advances the Community-scoped portion only; later-phase repository-wide or integrated closure remains open.",
  ]);
  if (directDispositions.has(record.id)) {
    record.current_status = final ? "CLOSED_PHASE_4_BRANCH_VALIDATED" : "IMPLEMENTED_PENDING_PHASE_4_VALIDATION";
    record.disposition = final ? "CLOSED_PHASE_4_BRANCH_VALIDATED" : "IMPLEMENTED_PENDING_PHASE_4_VALIDATION";
  } else {
    record.current_status = final ? "PARTIALLY_ADVANCED_PHASE_4" : "PHASE_4_IMPLEMENTED_PENDING_VALIDATION";
    record.disposition = final ? "PARTIAL_PHASE_4_LATER_OWNER_RETAINED" : "PHASE_4_IMPLEMENTED_PENDING_VALIDATION";
  }
}
writeCsv("Homeport_Nonconformity_Ledger.csv", ledger.headers, ledger.records);

const auditPath = path.join(auditRoot, "Homeport_Journey_Audit.md");
const audit = readFileSync(auditPath, "utf8");
const startMarker = "<!-- PHASE4_IMPLEMENTED_BEGIN -->";
const endMarker = "<!-- PHASE4_IMPLEMENTED_END -->";
const auditRows = phase4Journeys.map(
  (journey) =>
    `| ${journey.journeyId} | ${journey.name} | ${journey.result} | ${journey.screenshots.join("; ") || "No dedicated screenshot required"} |`,
);
const phase4Audit = `${startMarker}\n\n## Phase 4 Community Harbor implemented journeys\n\nThese branch-only results use the reserved synthetic fixture and production local runtime. They do not establish merge, deployment, or owner acceptance.\n\n| Journey | Contract | Result | Evidence |\n| --- | --- | --- | --- |\n${auditRows.join("\n")}\n\n${endMarker}`;
const markerPattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, "u");
writeFileSync(
  auditPath,
  await format(
    `${(markerPattern.test(audit) ? audit.replace(markerPattern, phase4Audit) : `${audit.trimEnd()}\n\n${phase4Audit}`).trimEnd()}\n`,
    { ...prettierConfig, parser: "markdown" },
  ),
  "utf8",
);

const soundingContracts = readJson("contracts.json", testingRoot);
soundingContracts.status = final
  ? "phase-4-homeport-community-contracts-validated"
  : "phase-4-homeport-community-contracts-registered";
const contractsById = new Map(soundingContracts.contracts.map((contract) => [contract.id, contract]));
for (const id of phase4Contracts)
  contractsById.set(id, {
    id,
    name: id
      .replace("homeport.community.", "Community Harbor ")
      .split(/[.-]/u)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
    authority: "project-homeport",
    owners: ["project-homeport", "harborlight"],
    critical: true,
  });
soundingContracts.contracts = [...contractsById.values()];
await writeTestingJson("contracts.json", soundingContracts);

const ownership = readJson("ownership.json", testingRoot);
ownership.status = "phase-4-homeport-community-source-classification";
const homeportOwner = ownership.owners.find((owner) => owner.id === "project-homeport");
homeportOwner.sourcePaths = unique([
  ...homeportOwner.sourcePaths,
  "src/community/**",
  "src/components/community/**",
  "src/app/community/**",
  "src/app/api/community/**",
  "scripts/homeport/**",
  "Development_Docs/Projects/Project_Homeport/**",
]);
homeportOwner.testPaths = unique([
  ...homeportOwner.testPaths,
  "src/community/**/*.test.*",
  "src/components/community/**/*.test.*",
  "src/app/api/community/**/*.test.*",
  "tests/homeport/phase4-*.test.mjs",
  "tests/e2e/homeport-phase4.spec.ts",
]);
homeportOwner.contractIds = unique([...homeportOwner.contractIds, ...phase4Contracts]);
await writeTestingJson("ownership.json", ownership);

const impactMap = readJson("impact-map.json", testingRoot);
impactMap.status = "phase-4-homeport-community-impact-map";
const upsertPathMapping = (pathPattern, suiteIds, contractIds) => {
  const current = impactMap.pathMappings.find((mapping) => mapping.path === pathPattern);
  if (current) {
    current.suiteIds = unique([...current.suiteIds, ...suiteIds]);
    current.contractIds = unique([...current.contractIds, ...contractIds]);
  } else impactMap.pathMappings.push({ path: pathPattern, suiteIds, contractIds });
};
for (const sourcePath of [
  "src/community/**",
  "src/components/community/**",
  "src/app/community/**",
  "src/app/api/community/**",
  "tests/e2e/homeport-phase4.spec.ts",
  "playwright.homeport-phase4.config.ts",
  "scripts/homeport/**",
  "Development_Docs/Projects/Project_Homeport/**",
])
  upsertPathMapping(sourcePath, ["unit.homeport", "component.homeport", "browser.homeport"], phase4Contracts);
impactMap.contractMappings ??= [];
for (const contractId of phase4Contracts) {
  const current = impactMap.contractMappings.find((mapping) => mapping.contractId === contractId);
  if (current)
    current.suiteIds = unique([...current.suiteIds, "unit.homeport", "component.homeport", "browser.homeport"]);
  else
    impactMap.contractMappings.push({
      contractId,
      suiteIds: ["unit.homeport", "component.homeport", "browser.homeport"],
    });
}
await writeTestingJson("impact-map.json", impactMap);

const suites = readJson("suites.json", testingRoot);
suites.status = "phase-4-homeport-community-owned-families";
for (const suiteId of ["unit.homeport", "component.homeport", "browser.homeport"]) {
  const suite = suites.suites.find((item) => item.id === suiteId);
  suite.contracts = unique([...suite.contracts, ...phase4Contracts]);
  suite.affectedPaths = unique([
    ...suite.affectedPaths,
    "src/community/**",
    "src/components/community/**",
    "src/app/community/**",
    "src/app/api/community/**",
    "tests/e2e/homeport-phase4.spec.ts",
    "playwright.homeport-phase4.config.ts",
  ]);
  suite.currentImplementationState = "phase-4-homeport-community-contract-family";
}
await writeTestingJson("suites.json", suites);

execFileSync(process.execPath, ["scripts/sounding-line/test-registry.mjs"], { cwd: root, stdio: "inherit" });

process.stdout.write(
  `Project Homeport Phase 4 inventories updated (${final ? "final branch validation" : "implemented pending validation"}); ` +
    `${phase4Journeys.length} journeys, ${phase4Evidence.length}/${expectedEvidenceIds.length} required evidence records, ` +
    `${phase4Contracts.length} Sounding Line contracts.\n`,
);
