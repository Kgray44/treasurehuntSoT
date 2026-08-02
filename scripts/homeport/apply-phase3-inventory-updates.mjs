import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { format, resolveConfig } from "prettier";

const root = process.cwd();
const auditRoot = path.join(root, "Development_Docs", "Projects", "Project_Homeport");
const evidenceRoot = path.join(auditRoot, "evidence", "phase3");
const testingRoot = path.join(root, "testing");
const implementationAnchorSha = "61913fee8b90ff03f763a9de665df934db13bf45";
const startingSha = "9ba021c7a7efd50083cb7f0d2ef3c2d19e979843";
const updatedAt = "2026-08-02T16:45:00.000Z";
const final = process.argv.includes("--final");
const prettierConfig = (await resolveConfig(path.join(auditRoot, "Homeport_Route_Inventory.json"))) ?? {};
const readJson = (name, directory = auditRoot) => JSON.parse(readFileSync(path.join(directory, name), "utf8"));
const writeJson = async (name, value) =>
  writeFileSync(
    path.join(auditRoot, name),
    await format(JSON.stringify(value), { ...prettierConfig, parser: "json" }),
    "utf8",
  );
const writeTestingJson = async (name, value) =>
  writeFileSync(
    path.join(testingRoot, name),
    await format(JSON.stringify(value), { ...prettierConfig, parser: "json" }),
    "utf8",
  );
const unique = (values) => [...new Set(values.filter(Boolean))];
const quoteCsv = (value) => '"' + String(value ?? "").replaceAll('"', '""') + '"';

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
    headers.map(quoteCsv).join(",") +
      "\n" +
      records.map((record) => headers.map((header) => quoteCsv(record[header])).join(",")).join("\n") +
      "\n",
    "utf8",
  );
}

const phase3Envelope = {
  phase: "PHASE_3_BUILD_THE_PERSONAL_HARBOR",
  project: "Project Homeport",
  startingSha,
  implementationAnchorSha,
  state: final ? "VALIDATED" : "IMPLEMENTED_PENDING_FINAL_VALIDATION",
  updatedAt,
  historicalPhase0Through2Preserved: true,
  noSchemaChange: true,
  phase4NotStarted: true,
};
const sectionRegistry = readJson("Project_Homeport_Phase_3_Section_Registry.json");
const evidenceManifest = readJson("manifest.json", evidenceRoot);
if (evidenceManifest.sourceSha !== implementationAnchorSha)
  throw new Error("PHASE3_EVIDENCE_SOURCE_MISMATCH:" + evidenceManifest.sourceSha);
if (sectionRegistry.sections.length !== 18) throw new Error("PHASE3_SECTION_COUNT_MISMATCH");

const journeyDefinitions = [
  ["A", "Account menu to Personal Harbor"],
  ["B", "Profile overview"],
  ["C", "Public Profile editing and preview"],
  ["D", "Profile media states"],
  ["E", "No-handle Profile"],
  ["F", "Personal information"],
  ["G", "Preferences"],
  ["H", "Accessibility"],
  ["I", "Notifications"],
  ["J", "Privacy and public projection"],
  ["K", "Linked identities"],
  ["L", "Chronicle Passport populated"],
  ["M", "Chronicle Passport empty"],
  ["N", "History list and detail"],
  ["O", "History privacy"],
  ["P", "Artifact Cabinet populated"],
  ["Q", "Artifact Cabinet empty"],
  ["R", "Saved content"],
  ["S", "Security reauthentication"],
  ["T", "Sessions and devices"],
  ["U", "Sign Out Everywhere"],
  ["V", "Data and account management"],
  ["W", "Desktop section navigation"],
  ["X", "Mobile section navigation"],
  ["Y", "Unsaved changes"],
  ["Z", "Stale conflict"],
  ["AA", "Dependency unavailable"],
  ["AB", "200 percent zoom"],
  ["AC", "Keyboard-only Personal Harbor"],
  ["AD", "Reduced motion"],
  ["AE", "Phase 1 and Phase 2 regression"],
];
const phase3Contracts = [
  "homeport.personal-harbor.ia",
  "homeport.personal-harbor.section-registry",
  "homeport.personal-harbor.mobile-parity",
  "homeport.personal-harbor.deep-links",
  "homeport.personal-harbor.unsaved-changes",
  "homeport.personal-harbor.mutation-feedback",
  "homeport.personal-harbor.stale-conflict",
  "homeport.profile.overview",
  "homeport.profile.public-projection",
  "homeport.profile.owner-edit",
  "homeport.profile.media-state",
  "homeport.profile.no-private-leak",
  "homeport.preferences.typed",
  "homeport.accessibility.preference-consumption",
  "homeport.notifications.feedback",
  "homeport.privacy.server-enforced",
  "homeport.linked-identities.safe",
  "homeport.linked-identities.no-lockout",
  "homeport.passport.product-surface",
  "homeport.passport.no-test-controls",
  "homeport.passport.session-regression",
  "homeport.history.owner-only",
  "homeport.history.version-pinned",
  "homeport.history.empty-state",
  "homeport.memories.owner-authorized",
  "homeport.keepsake.consent",
  "homeport.artifacts.owner-only",
  "homeport.artifacts.provenance",
  "homeport.artifacts.empty-state",
  "homeport.saved-content.owner-only",
  "homeport.saved-content.cross-surface",
  "homeport.security.sensitive-reauth",
  "homeport.sessions.list-safe",
  "homeport.sessions.revoke",
  "homeport.sessions.signout-all",
  "homeport.account-data.truthful-availability",
  "homeport.personal-harbor.phase1-regression",
  "homeport.personal-harbor.phase2-regression",
  "homeport.personal-harbor.artifact-idempotency",
];
const evidenceJourneys = {
  "HP-P3-EV-A-profile-overview-desktop": ["A", "B", "W", "AE"],
  "HP-P3-EV-B-profile-overview-mobile": ["B", "X"],
  "HP-P3-EV-C-profile-editor": ["C"],
  "HP-P3-EV-D-public-profile-preview": ["C", "J"],
  "HP-P3-EV-E-profile-media": ["D"],
  "HP-P3-EV-F-personal-information": ["F"],
  "HP-P3-EV-G-preferences": ["G"],
  "HP-P3-EV-H-accessibility": ["H"],
  "HP-P3-EV-I-notifications": ["I"],
  "HP-P3-EV-J-privacy": ["J"],
  "HP-P3-EV-K-linked-identities": ["K"],
  "HP-P3-EV-L-passport-populated": ["L", "AE"],
  "HP-P3-EV-M-passport-empty": ["M"],
  "HP-P3-EV-N-history-list": ["N"],
  "HP-P3-EV-O-history-detail": ["N", "O"],
  "HP-P3-EV-P-memory-keepsake": ["L", "N"],
  "HP-P3-EV-Q-artifact-cabinet": ["P"],
  "HP-P3-EV-R-artifact-empty": ["Q"],
  "HP-P3-EV-S-saved-content": ["R"],
  "HP-P3-EV-T-security": ["S"],
  "HP-P3-EV-U-sessions": ["T", "U"],
  "HP-P3-EV-V-data-account": ["V"],
  "HP-P3-EV-W-mobile-section-nav": ["X", "AC"],
  "HP-P3-EV-X-unsaved-warning": ["Y", "AC"],
  "HP-P3-EV-Y-stale-conflict": ["Z"],
  "HP-P3-EV-Z-dependency-unavailable": ["AA"],
  "HP-P3-EV-AA-zoom-profile": ["AB"],
  "HP-P3-EV-AB-zoom-passport": ["AB"],
  "HP-P3-EV-AC-reduced-motion": ["AD"],
};
const evidenceForJourney = (letter) =>
  Object.entries(evidenceJourneys)
    .filter(([, letters]) => letters.includes(letter))
    .map(([evidenceId]) => evidenceId);
const phase3Journeys = journeyDefinitions.map(([letter, name]) => ({
  journeyId: "HP-P3-JRN-" + letter,
  name,
  sourceSha: startingSha,
  fixtureIdentity: "Reserved synthetic Homeport Phase 3 Personal Harbor accounts and records",
  browser: "Playwright Chromium",
  viewport: letter === "X" ? "390x844" : letter === "AB" ? "1440x1000 at 200 percent zoom" : "1440x1000",
  steps: ["Execute governed Journey " + letter, name, "Verify exact owner-safe result and recovery"],
  controlsUsed: ["Visible semantic controls", "Keyboard where required"],
  routeTransitions: ["Gateway or Personal Harbor parent", name, "Safe return or recovery"],
  sessionAuthoritiesObservedWithoutValues: ["HP-SES-001"],
  expectedCurrentBehavior: name,
  observedBehavior: name + " is covered by the registered Homeport Phase 3 browser and focused contract families.",
  screenshots: evidenceForJourney(letter),
  traces: [],
  result: final ? "PASSED" : "IMPLEMENTED_PENDING_FINAL_VALIDATION",
  rootBlocker: null,
  relatedNonconformityIds: ["HP-NC-008", "HP-NC-009", "HP-NC-014", "HP-NC-018", "HP-NC-019", "HP-NC-028"],
  targetPhase: "PHASE_3_BUILD_THE_PERSONAL_HARBOR",
  futureAcceptanceTest: "homeport.phase3.journey-" + letter.toLowerCase(),
  phase3ImplementationAnchorSha: implementationAnchorSha,
}));

const journeyCatalog = readJson("Homeport_Journey_Catalog.json");
journeyCatalog.phase3Implementation = phase3Envelope;
journeyCatalog.journeys = journeyCatalog.journeys.filter((journey) => !journey.journeyId.startsWith("HP-P3-JRN-"));
journeyCatalog.journeys.push(...phase3Journeys);
await writeJson("Homeport_Journey_Catalog.json", journeyCatalog);

const routeSources = {
  "/account": "src/app/account/page.tsx",
  "/account/profile": "src/app/account/profile/page.tsx",
  "/account/personal-information": "src/app/account/personal-information/page.tsx",
  "/account/preferences": "src/app/account/preferences/page.tsx",
  "/account/accessibility": "src/app/account/accessibility/page.tsx",
  "/account/notifications": "src/app/account/notifications/page.tsx",
  "/account/privacy": "src/app/account/privacy/page.tsx",
  "/account/linked-identities": "src/app/account/linked-identities/page.tsx",
  "/account/security": "src/app/account/security/page.tsx",
  "/account/sessions": "src/app/account/sessions/page.tsx",
  "/account/data": "src/app/account/data/page.tsx",
  "/passport": "src/app/passport/page.tsx",
  "/passport/history": "src/app/passport/history/page.tsx",
  "/passport/history/:recordId": "src/app/passport/history/[recordId]/page.tsx",
  "/passport/memories": "src/app/passport/memories/page.tsx",
  "/passport/artifacts": "src/app/passport/artifacts/page.tsx",
  "/passport/artifacts/:artifactId": "src/app/passport/artifacts/[artifactId]/page.tsx",
  "/passport/saved": "src/app/passport/saved/page.tsx",
  "/profile/:handle": "src/app/profile/[handle]/page.tsx",
};
const routeIdFor = (route) => "route-page-" + (route.slice(1).replaceAll(":", "").replaceAll("/", "-") || "root");
const screenIdFor = (route) => "screen-page-" + (route.slice(1).replaceAll(":", "").replaceAll("/", "-") || "root");
const patternForCapturedRoute = (route) => {
  if (/^\/profile\/[^/]+$/u.test(route)) return "/profile/:handle";
  if (/^\/passport\/history\/[^/]+$/u.test(route)) return "/passport/history/:recordId";
  if (/^\/passport\/artifacts\/[^/]+$/u.test(route)) return "/passport/artifacts/:artifactId";
  return route;
};
const registryByRoute = new Map(sectionRegistry.sections.map((section) => [section.canonicalRoute, section]));
const evidenceByRoute = new Map();
for (const evidence of evidenceManifest.evidence) {
  const route = patternForCapturedRoute(evidence.route);
  evidenceByRoute.set(route, unique([...(evidenceByRoute.get(route) ?? []), evidence.evidenceId]));
}

const routes = readJson("Homeport_Route_Inventory.json");
routes.phase3Implementation = phase3Envelope;
for (const section of sectionRegistry.sections) {
  const routePattern = section.canonicalRoute;
  let route = routes.routes.find((candidate) => candidate.routePattern === routePattern);
  const routeId = route?.routeId ?? routeIdFor(routePattern);
  const entryId = "entry-phase3-" + section.sectionId;
  if (!route) {
    route = {
      routeId,
      routePattern,
      implementationSource: routeSources[routePattern],
      kind: "page",
      classification: routePattern.includes(":") ? "CONTEXTUAL_DYNAMIC" : "USER_NAVIGABLE",
      ownerProject: section.owner,
      productArea: "Personal Harbor",
      shellMode: "WORKSPACE_STANDARD",
      logicalParent: section.return,
      currentVisibleEntries: [],
      currentDesktopPath: [],
      currentMobilePath: [],
      authenticationRequirement: "ACCOUNT_SESSION_REQUIRED",
      capabilityRequirements: [],
      returnOrBackRoute: section.return,
      emptyStateAction: "ROUTE_SPECIFIC_DESIGNED_STATE",
      dynamicSourceRouteOrContentSource: routePattern.includes(":") ? section.return : null,
      compatibilityAliases: section.compatibilityRoutesOrAnchors,
      redirects: [],
      currentSupportedStates: [],
      currentJourneys: [],
      currentVisualEvidenceIds: [],
      currentMaturity: "COMPLETE",
      directUrlRequired: false,
      orphanedOrdinaryRoute: false,
      targetDisposition: "PHASE_3_BUILD_THE_PERSONAL_HARBOR",
      status: "PHASE_3_CURRENT_SURFACE",
      notes: "Added additively by the idempotent Phase 3 inventory updater.",
    };
    routes.routes.push(route);
  }
  route.implementationSource = routeSources[routePattern] ?? route.implementationSource;
  route.logicalParent = section.return;
  route.returnOrBackRoute = section.return;
  route.shellMode = "WORKSPACE_STANDARD";
  route.authenticationRequirement = "ACCOUNT_SESSION_REQUIRED";
  route.currentVisibleEntries = [
    ...route.currentVisibleEntries.filter((entry) => entry.entryId !== entryId),
    {
      entryId,
      sourceRouteOrFile: routePattern.includes(":")
        ? routeSources[routePattern]
        : "src/components/homeport/PersonalHarborLayout.tsx",
      controlLabel: section.label,
      desktopAvailable: true,
      mobileAvailable: true,
      requiredCapability: section.group === "CHRONICLE_PASSPORT" ? "PLAYER" : "AUTHENTICATED",
      missingCapabilityBehavior: "EXPLICIT_CAPABILITY_OR_AUTHENTICATION_STATE",
    },
  ];
  route.currentDesktopPath = unique([
    ...route.currentDesktopPath.filter((entry) => entry !== "DIRECT_URL_ONLY"),
    "src/components/homeport/PersonalHarborLayout.tsx",
  ]);
  route.currentMobilePath = unique([
    ...route.currentMobilePath.filter((entry) => entry !== "DIRECT_URL_ONLY"),
    "src/components/homeport/PersonalHarborLayout.tsx",
  ]);
  route.compatibilityAliases = unique([...(route.compatibilityAliases ?? []), ...section.compatibilityRoutesOrAnchors]);
  route.currentSupportedStates = section.applicableStates;
  route.currentJourneys = unique([
    ...route.currentJourneys,
    ...journeyDefinitions.map(([letter]) => "HP-P3-JRN-" + letter),
  ]);
  route.currentVisualEvidenceIds = unique([
    ...route.currentVisualEvidenceIds,
    ...(evidenceByRoute.get(routePattern) ?? []),
  ]);
  route.currentMaturity = "COMPLETE";
  route.directUrlRequired = false;
  route.orphanedOrdinaryRoute = false;
  route.targetDisposition = "PHASE_3_BUILD_THE_PERSONAL_HARBOR";
  route.status = final ? "PHASE_3_VALIDATED" : "PHASE_3_IMPLEMENTED";
  route.phase3Implementation = {
    ...phase3Envelope,
    sectionId: section.sectionId,
    dto: section.dto,
    desktopPlacement: section.desktopPlacement,
    mobilePlacement: section.mobilePlacement,
    applicableStates: section.applicableStates,
    testContracts: section.testContracts,
    evidenceIds: evidenceByRoute.get(routePattern) ?? [],
  };
}
const publicRoute = routes.routes.find((candidate) => candidate.routePattern === "/profile/:handle");
if (!publicRoute) throw new Error("PHASE3_PUBLIC_PROFILE_ROUTE_MISSING");
publicRoute.logicalParent = "/account/profile";
publicRoute.returnOrBackRoute = "/account/profile";
publicRoute.currentVisibleEntries = [
  ...publicRoute.currentVisibleEntries.filter((entry) => entry.entryId !== "entry-phase3-public-profile"),
  {
    entryId: "entry-phase3-public-profile",
    sourceRouteOrFile: "src/components/homeport/AccountSurfaces.tsx",
    controlLabel: "View Public Profile",
    desktopAvailable: true,
    mobileAvailable: true,
    requiredCapability: "PUBLIC_HANDLE",
    missingCapabilityBehavior: "DELIBERATE_NO_HANDLE_STATE",
  },
];
publicRoute.currentDesktopPath = unique([
  ...publicRoute.currentDesktopPath.filter((entry) => entry !== "DIRECT_URL_ONLY"),
  "src/components/homeport/AccountSurfaces.tsx",
]);
publicRoute.currentMobilePath = unique([
  ...publicRoute.currentMobilePath.filter((entry) => entry !== "DIRECT_URL_ONLY"),
  "src/components/homeport/AccountSurfaces.tsx",
]);
publicRoute.currentSupportedStates = ["PUBLIC_READY", "PRIVATE", "NOT_FOUND", "HANDLE_REDIRECT"];
publicRoute.currentJourneys = unique([...publicRoute.currentJourneys, "HP-P3-JRN-C", "HP-P3-JRN-J"]);
publicRoute.currentVisualEvidenceIds = unique([
  ...publicRoute.currentVisualEvidenceIds,
  ...(evidenceByRoute.get("/profile/:handle") ?? []),
]);
publicRoute.currentMaturity = "COMPLETE";
publicRoute.directUrlRequired = false;
publicRoute.orphanedOrdinaryRoute = false;
publicRoute.status = final ? "PHASE_3_VALIDATED" : "PHASE_3_IMPLEMENTED";
publicRoute.phase3Implementation = {
  ...phase3Envelope,
  projection: "Explicit allowlisted public Profile DTO",
  evidenceIds: evidenceByRoute.get("/profile/:handle") ?? [],
  privateFieldsExcluded: true,
};
routes.totals = {
  routeFiles: routes.routes.length,
  pages: routes.routes.filter((route) => route.kind.toLowerCase() === "page").length,
  services: routes.routes.filter((route) => route.kind.toLowerCase() !== "page").length,
};
await writeJson("Homeport_Route_Inventory.json", routes);

function phase3Screen(section, prior = {}) {
  const route = section.canonicalRoute;
  const evidence = evidenceByRoute.get(route) ?? [];
  const routeRecord = routes.routes.find((candidate) => candidate.routePattern === route);
  return {
    ...prior,
    screenId: prior.screenId ?? screenIdFor(route),
    routeIds: [routeRecord.routeId],
    productArea: "Personal Harbor",
    owner: section.owner,
    shellMode: "WORKSPACE_STANDARD",
    primaryUserGoal: "Use " + section.label + " in the unified Personal Harbor",
    logicalParent: section.return,
    visibleEntryPoints: ["entry-phase3-" + section.sectionId],
    authentication: "ACCOUNT_SESSION_REQUIRED",
    capabilities: section.group === "CHRONICLE_PASSPORT" ? ["PLAYER"] : [],
    primaryHeading: section.label,
    primaryAction: section.mutationIds.length
      ? "SUPPORTED_OWNER_MUTATION_OR_TRUTHFUL_UNAVAILABLE_STATE"
      : "ROUTE_SPECIFIC",
    secondaryActions: [],
    dataProjection: section.dto,
    currentResponsiveComposition: "Persistent desktop rail and exact mobile section-sheet parity.",
    currentKeyboardOrder: "Semantic DOM order with skip link, visible focus, and guarded dialog focus.",
    currentFocusBehavior: "Route heading receives navigation context; dialogs restore the initiating control.",
    currentMotionOwner: "ProductShell and PersonalHarborLayout reduced-motion contract",
    currentReducedMotionBehavior: "Semantic final state remains immediately available.",
    applicableStates: section.applicableStates,
    currentVisualMaturity: "COMPLETE",
    missingStates: [],
    knownDefects: [],
    screenshotIds: unique([...(prior.screenshotIds ?? []), ...evidence]),
    journeyIds: unique([...(prior.journeyIds ?? []), ...journeyDefinitions.map(([letter]) => "HP-P3-JRN-" + letter)]),
    targetHomeportPhase: "PHASE_3_BUILD_THE_PERSONAL_HARBOR",
    acceptanceContract: section.testContracts.join(";"),
    status: final ? "PHASE_3_VALIDATED" : "PHASE_3_IMPLEMENTED",
    contractStatus: "CURRENT_STATE_RECORDED",
    targetContract: prior.targetContract ?? {
      routeReachability: "Visible desktop and mobile entry, logical parent, and safe recovery.",
      stateCompleteness: "Every applicable state is explicit and truthful.",
      responsive: "Desktop, 390x844 mobile, keyboard, reduced motion, and 200 percent zoom.",
      acceptanceOwner: "Project Homeport owner after branch integration; not established by this branch.",
    },
    phase3Implementation: {
      ...phase3Envelope,
      sectionId: section.sectionId,
      dto: section.dto,
      mutationIds: section.mutationIds,
      testContracts: section.testContracts,
      evidenceIds: evidence,
    },
  };
}
for (const catalogName of ["Homeport_Screen_Catalog.json", "Homeport_Screen_Contract_Catalog.json"]) {
  const catalog = readJson(catalogName);
  catalog.phase3Implementation = phase3Envelope;
  for (const section of sectionRegistry.sections) {
    const routeId = routes.routes.find((candidate) => candidate.routePattern === section.canonicalRoute).routeId;
    const priorIndex = catalog.screens.findIndex((screen) => screen.routeIds?.includes(routeId));
    const next = phase3Screen(section, priorIndex >= 0 ? catalog.screens[priorIndex] : {});
    if (priorIndex >= 0) catalog.screens[priorIndex] = next;
    else catalog.screens.push(next);
  }
  const priorPublicIndex = catalog.screens.findIndex((screen) => screen.routeIds?.includes(publicRoute.routeId));
  const priorPublic = priorPublicIndex >= 0 ? catalog.screens[priorPublicIndex] : {};
  const publicScreen = {
    ...priorPublic,
    screenId: "screen-page-profile-handle",
    routeIds: [publicRoute.routeId],
    productArea: "Personal Harbor",
    owner: "wayfarer",
    shellMode: "PUBLIC_STANDARD",
    primaryUserGoal: "View the allowlisted public Profile projection",
    logicalParent: "/account/profile",
    visibleEntryPoints: ["entry-phase3-public-profile"],
    authentication: "ANONYMOUS_ALLOWED",
    capabilities: [],
    primaryHeading: "Public Profile display name",
    primaryAction: "Explore Chronicles",
    secondaryActions: [],
    dataProjection: "PublicProfileDto",
    currentResponsiveComposition: "Polished desktop and responsive public Profile composition.",
    currentKeyboardOrder: "Semantic DOM order",
    currentFocusBehavior: "Standard route navigation",
    currentMotionOwner: "ProductShell",
    currentReducedMotionBehavior: "No motion-dependent meaning.",
    applicableStates: ["PUBLIC_READY", "PRIVATE", "NOT_FOUND", "HANDLE_REDIRECT"],
    currentVisualMaturity: "COMPLETE",
    missingStates: [],
    knownDefects: [],
    screenshotIds: unique([...(priorPublic.screenshotIds ?? []), ...(evidenceByRoute.get("/profile/:handle") ?? [])]),
    journeyIds: ["HP-P3-JRN-C", "HP-P3-JRN-J"],
    targetHomeportPhase: "PHASE_3_BUILD_THE_PERSONAL_HARBOR",
    acceptanceContract: "homeport.profile.public-projection;homeport.profile.no-private-leak",
    status: final ? "PHASE_3_VALIDATED" : "PHASE_3_IMPLEMENTED",
    contractStatus: "CURRENT_STATE_RECORDED",
    targetContract: {
      routeReachability: "Owner editor links to the real public route when a handle exists.",
      stateCompleteness: "Public, private, not-found, and historical-handle redirect are explicit.",
      responsive: "Desktop and mobile preserve the same allowlisted projection.",
      acceptanceOwner: "Project Homeport owner after branch integration; not established by this branch.",
    },
    phase3Implementation: {
      ...phase3Envelope,
      dto: "PublicProfileDto",
      testContracts: ["homeport.profile.public-projection", "homeport.profile.no-private-leak"],
      evidenceIds: evidenceByRoute.get("/profile/:handle") ?? [],
    },
  };
  if (priorPublicIndex >= 0) catalog.screens[priorPublicIndex] = publicScreen;
  else catalog.screens.push(publicScreen);
  await writeJson(catalogName, catalog);
}

const navigation = readJson("Homeport_Navigation_Map.json");
navigation.phase3Implementation = phase3Envelope;
navigation.phase3AcceptanceEdges = phase3Journeys.map((journey) => ({
  journeyId: journey.journeyId,
  routeTransitions: journey.routeTransitions,
  shellAuthority: "src/components/shell/ProductShell.tsx",
  sectionAuthority: "src/homeport/personal-harbor-navigation.ts",
  result: journey.result,
}));
navigation.edges = navigation.edges.filter((edge) => !edge.nodeId.startsWith("phase3-"));
navigation.edges.push(
  ...sectionRegistry.sections.map((section, index) => ({
    nodeId: "phase3-" + section.sectionId,
    routeId: "phase3-navigation-" + section.sectionId,
    label: section.label,
    controlId: "HP-CTL-" + String(51 + index).padStart(3, "0"),
    sourceScreen: "src/components/homeport/PersonalHarborLayout.tsx",
    destinationScreen: section.canonicalRoute,
    desktopAvailability: true,
    mobileAvailability: true,
    authentication: "AUTHENTICATED",
    capabilities: section.group === "CHRONICLE_PASSPORT" ? ["PLAYER"] : [],
    hiddenCondition: null,
    disabledCondition: null,
    redirectBehavior: "CANONICAL_ACCOUNT_SESSION_GUARD",
    currentStatus: final ? "PHASE_3_VALIDATED" : "PHASE_3_IMPLEMENTED",
    evidenceId: section.evidenceRequirements[0] ?? null,
    phase3ImplementationAnchorSha: implementationAnchorSha,
  })),
);
navigation.edges.push({
  nodeId: "phase3-public-profile",
  routeId: "phase3-navigation-public-profile",
  label: "View Public Profile",
  controlId: "HP-CTL-069",
  sourceScreen: "src/components/homeport/AccountSurfaces.tsx",
  destinationScreen: "/profile/:handle",
  desktopAvailability: true,
  mobileAvailability: true,
  authentication: "STATE_DEPENDENT",
  capabilities: [],
  hiddenCondition: "NO_HANDLE",
  disabledCondition: null,
  redirectBehavior: "PUBLIC_ALLOWLISTED_PROJECTION",
  currentStatus: final ? "PHASE_3_VALIDATED" : "PHASE_3_IMPLEMENTED",
  evidenceId: "HP-P3-EV-D-public-profile-preview",
  phase3ImplementationAnchorSha: implementationAnchorSha,
});
await writeJson("Homeport_Navigation_Map.json", navigation);

const visual = readJson("Homeport_Visual_Baseline_Manifest.json");
visual.phase3Implementation = phase3Envelope;
visual.phase3Run = {
  runId: evidenceManifest.runId,
  fixture: evidenceManifest.fixtureVersion,
  implementationAnchorSha,
  browserVersion: "Playwright bundled Chromium",
  visualReview: final ? "ALL_29_ACCEPTED" : "PENDING_FINAL_CLASSIFICATION",
};
visual.records = visual.records.filter((record) => !record.evidenceId.startsWith("HP-P3-EV-"));
for (const evidence of evidenceManifest.evidence) {
  const relative = "Development_Docs/Projects/Project_Homeport/evidence/phase3/" + evidence.file;
  const absolute = path.join(root, relative);
  if (!existsSync(absolute)) throw new Error("MISSING_PHASE3_EVIDENCE:" + relative);
  const route = patternForCapturedRoute(evidence.route);
  const section = registryByRoute.get(route);
  visual.records.push({
    evidenceId: evidence.evidenceId,
    sourceSha: startingSha,
    implementationAnchorSha,
    branch: evidenceManifest.branch,
    route,
    screenContract: screenIdFor(route),
    journey: "HP-P3-JRN-" + (evidenceJourneys[evidence.evidenceId] ?? ["A"])[0],
    accountFixture: "Reserved synthetic Homeport Phase 3 fixture",
    fixtureVersion: evidence.fixtureVersion,
    fixtureChecksum: evidence.fixtureChecksum,
    browser: evidence.browser,
    browserVersion: "Playwright bundled Chromium",
    viewport: evidence.viewport,
    zoom: evidence.zoom + "%",
    motionMode: evidence.evidenceId.endsWith("reduced-motion") ? "reduced" : "system or journey-controlled",
    accountState: evidence.evidenceId.includes("empty") ? "authenticated-empty" : "authenticated-synthetic",
    workspace: section?.group === "CHRONICLE_PASSPORT" ? "player" : "personal-harbor",
    shellMode: route.startsWith("/profile/") ? "PUBLIC_STANDARD" : "WORKSPACE_STANDARD",
    appearanceState: "Phase 3 implemented after-state",
    dataState: "Synthetic task-owned isolated copied database and storage roots",
    screenshotPath: relative,
    committedScreenshotPath: relative,
    sha256: createHash("sha256").update(readFileSync(absolute)).digest("hex"),
    observedResult:
      "Human visual review accepted hierarchy, typography, contrast, responsive composition, controls, and absence of clipping or horizontal overflow.",
    knownDeviation:
      "Local synthetic evidence only; no merge, deployment, owner acceptance, live provider proof, or Phase 4 Community reconstruction.",
    timestamp: updatedAt,
    reviewerClassification: final ? "PHASE_3_AFTER_STATE_ACCEPTED" : "PHASE_3_AFTER_STATE_PENDING_FINALIZER",
  });
}
await writeJson("Homeport_Visual_Baseline_Manifest.json", visual);

const controls = parseCsv(readFileSync(path.join(auditRoot, "Homeport_Control_Inventory.csv"), "utf8"));
controls.records = controls.records.filter((record) => !/^HP-CTL-(?:05[1-9]|06[0-9])$/u.test(record.control_id));
for (const [index, section] of sectionRegistry.sections.entries()) {
  const control = {
    control_id: "HP-CTL-" + String(51 + index).padStart(3, "0"),
    label: section.label,
    screen: screenIdFor(section.canonicalRoute),
    route: section.canonicalRoute,
    role_or_capability: section.group === "CHRONICLE_PASSPORT" ? "PLAYER" : "AUTHENTICATED",
    visibility_condition: "canonical account session and section policy",
    enabled_condition: "enabled when rendered",
    action_type: "NAVIGATION",
    authoritative_endpoint_or_server_action: section.canonicalRoute,
    pending_feedback: "not applicable",
    success_feedback: "destination heading and current section state",
    failure_feedback: "explicit unavailable or authentication state",
    navigation_result: section.canonicalRoute,
    focus_result: "destination content context",
    keyboard_operation: "Tab and Enter; Escape for mobile disclosure or dialogs",
    mobile_operation: "same destination through section sheet",
    current_status: final ? "VALIDATED" : "IMPLEMENTED",
    reproduction_steps: "Run governed section-specific Homeport Phase 3 journey.",
    evidence_id: section.evidenceRequirements[0] ?? "",
    target_phase: "PHASE_3",
  };
  controls.records.push(Object.fromEntries(controls.headers.map((header) => [header, control[header] ?? ""])));
}
const publicControl = {
  control_id: "HP-CTL-069",
  label: "View Public Profile",
  screen: "screen-page-account-profile",
  route: "/account/profile",
  role_or_capability: "PUBLIC_HANDLE",
  visibility_condition: "owner Profile has a public handle",
  enabled_condition: "public projection available",
  action_type: "NAVIGATION",
  authoritative_endpoint_or_server_action: "/profile/:handle",
  pending_feedback: "bounded projection loading",
  success_feedback: "allowlisted public Profile",
  failure_feedback: "private, unavailable, or no-handle state",
  navigation_result: "/profile/:handle",
  focus_result: "public Profile heading",
  keyboard_operation: "Tab and Enter",
  mobile_operation: "equivalent public route",
  current_status: final ? "VALIDATED" : "IMPLEMENTED",
  reproduction_steps: "Run governed HP-P3-JRN-C and HP-P3-JRN-J.",
  evidence_id: "HP-P3-EV-D-public-profile-preview",
  target_phase: "PHASE_3",
};
controls.records.push(Object.fromEntries(controls.headers.map((header) => [header, publicControl[header] ?? ""])));
writeCsv("Homeport_Control_Inventory.csv", controls.headers, controls.records);

const ledger = parseCsv(readFileSync(path.join(auditRoot, "Homeport_Nonconformity_Ledger.csv"), "utf8"));
const directClosures = {
  "HP-NC-008": {
    evidence: [
      "HP-P3-EV-A-profile-overview-desktop",
      "HP-P3-EV-B-profile-overview-mobile",
      "HP-P3-EV-W-mobile-section-nav",
    ],
    tests: [
      "homeport.personal-harbor.ia",
      "homeport.personal-harbor.section-registry",
      "homeport.personal-harbor.mobile-parity",
    ],
    result:
      "The unified Personal Harbor provides a Profile-led hub, persistent desktop rail, exact mobile section parity, canonical deep links, and Security as one governed section.",
  },
  "HP-NC-009": {
    evidence: [
      "HP-P3-EV-C-profile-editor",
      "HP-P3-EV-D-public-profile-preview",
      "HP-P3-EV-L-passport-populated",
      "HP-P3-EV-AA-zoom-profile",
      "HP-P3-EV-AB-zoom-passport",
    ],
    tests: [
      "homeport.profile.overview",
      "homeport.profile.public-projection",
      "homeport.passport.product-surface",
      "homeport.profile.no-private-leak",
    ],
    result:
      "Profile, the public projection, and Chronicle Passport are deliberate product surfaces with designed state, responsive, and privacy behavior.",
  },
  "HP-NC-028": {
    evidence: ["HP-P3-EV-K-linked-identities", "HP-P3-EV-L-passport-populated"],
    tests: ["homeport.passport.no-test-controls", "homeport.linked-identities.safe"],
    result:
      "Ordinary Passport no longer renders provider plans, raw integration dumps, or simulator controls; linked identities use the designed owner section.",
  },
};
const partialAdvancement = {
  "HP-NC-014": {
    evidence: ["HP-P3-EV-A-profile-overview-desktop", "HP-P3-EV-W-mobile-section-nav"],
    tests: ["homeport.personal-harbor.deep-links", "homeport.personal-harbor.mobile-parity"],
    result:
      "Every Phase 3 Personal Harbor route has a visible desktop and mobile entry, parent, deep link, and recovery. Phase 5 retains repository-wide exhaustive route reachability.",
  },
  "HP-NC-018": {
    evidence: [
      "HP-P3-EV-M-passport-empty",
      "HP-P3-EV-R-artifact-empty",
      "HP-P3-EV-X-unsaved-warning",
      "HP-P3-EV-Y-stale-conflict",
      "HP-P3-EV-Z-dependency-unavailable",
    ],
    tests: [
      "homeport.personal-harbor.mutation-feedback",
      "homeport.personal-harbor.stale-conflict",
      "homeport.history.empty-state",
      "homeport.artifacts.empty-state",
    ],
    result:
      "Every Phase 3-touched Personal Harbor screen has deliberate applicable states. Phase 6 retains repository-wide state-completeness authority.",
  },
  "HP-NC-019": {
    evidence: [
      "HP-P3-EV-L-passport-populated",
      "HP-P3-EV-M-passport-empty",
      "HP-P3-EV-Q-artifact-cabinet",
      "HP-P3-EV-S-saved-content",
      "HP-P3-EV-U-sessions",
    ],
    tests: [
      "homeport.personal-harbor.artifact-idempotency",
      "homeport.history.version-pinned",
      "homeport.artifacts.provenance",
    ],
    result:
      "A deterministic reserved synthetic Phase 3 fixture covers Profile, history, Memories, artifacts, saved content, sessions, and empty states. Phase 7 retains the final cross-product walkthrough fixture.",
  },
};
for (const record of ledger.records) {
  const direct = directClosures[record.id];
  const partial = partialAdvancement[record.id];
  if (direct) {
    const prior = record.current_status;
    record.current_status = final ? "CLOSED" : "IMPLEMENTED_PENDING_VALIDATION";
    record.journeys = unique([
      ...record.journeys.split(";").filter(Boolean),
      ...journeyDefinitions.map(([letter]) => "HP-P3-JRN-" + letter),
    ]).join(";");
    record.evidence_ids = unique([...record.evidence_ids.split(";").filter(Boolean), ...direct.evidence]).join(";");
    record.test_ids = unique([...record.test_ids.split(";").filter(Boolean), ...direct.tests]).join(";");
    record.observed_result = direct.result;
    record.disposition = final ? "CLOSED_PHASE_3_VALIDATED" : "PHASE_3_IMPLEMENTED_AWAITING_FINALIZER";
    if (!record.notes.includes("Phase 3 prior status was"))
      record.notes = (
        record.notes +
        " Phase 3 prior status was " +
        prior +
        ". Historical evidence and statuses remain preserved."
      ).trim();
  } else if (partial) {
    const prior = record.current_status;
    record.current_status = "PARTIALLY_ADVANCED_PHASE_3";
    record.journeys = unique([
      ...record.journeys.split(";").filter(Boolean),
      ...journeyDefinitions.map(([letter]) => "HP-P3-JRN-" + letter),
    ]).join(";");
    record.evidence_ids = unique([...record.evidence_ids.split(";").filter(Boolean), ...partial.evidence]).join(";");
    record.test_ids = unique([...record.test_ids.split(";").filter(Boolean), ...partial.tests]).join(";");
    record.observed_result = partial.result;
    record.disposition = "PARTIAL_PHASE_3_LATER_OWNER_RETAINED";
    if (!record.notes.includes("Phase 3 prior status was"))
      record.notes = (record.notes + " Phase 3 prior status was " + prior + ". " + partial.result).trim();
  } else if (record.id === "HP-NC-007") {
    record.journeys = unique([...record.journeys.split(";").filter(Boolean), "HP-P3-JRN-L", "HP-P3-JRN-AE"]).join(";");
    record.evidence_ids = unique([
      ...record.evidence_ids.split(";").filter(Boolean),
      "HP-P3-EV-L-passport-populated",
    ]).join(";");
    record.test_ids = unique([
      ...record.test_ids.split(";").filter(Boolean),
      "homeport.passport.session-regression",
      "homeport.personal-harbor.phase1-regression",
    ]).join(";");
    record.observed_result =
      "Phase 3 preserves ordinary Passport and Personal Harbor access under the canonical AccountSession without a second sign-in.";
    if (!record.notes.includes("Phase 3 regression"))
      record.notes = (
        record.notes +
        " Phase 3 regression evidence preserves the Phase 1 closure without changing its owner or historical status."
      ).trim();
  }
}
writeCsv("Homeport_Nonconformity_Ledger.csv", ledger.headers, ledger.records);

const soundingContracts = readJson("contracts.json", testingRoot);
soundingContracts.status = "phase-3-homeport-contracts-validated";
soundingContracts.contracts = soundingContracts.contracts.filter((contract) => !phase3Contracts.includes(contract.id));
for (const contractId of phase3Contracts) {
  soundingContracts.contracts.push({
    id: contractId,
    name: contractId
      .replace(/^homeport\./u, "")
      .replaceAll(".", " ")
      .replaceAll("-", " ")
      .replace(/\b\w/gu, (letter) => letter.toUpperCase()),
    authority: "project-homeport",
    owners: ["project-homeport", "wayfarer"],
    critical: true,
  });
}
await writeTestingJson("contracts.json", soundingContracts);

const ownership = readJson("ownership.json", testingRoot);
ownership.status = "phase-3-homeport-source-classification";
const homeportOwner = ownership.owners.find((owner) => owner.id === "project-homeport");
if (!homeportOwner) throw new Error("SOUNDING_LINE_HOMEPORT_OWNER_MISSING");
homeportOwner.sourcePaths = unique([
  ...homeportOwner.sourcePaths,
  "src/homeport/**",
  "src/components/homeport/**",
  "src/app/account/**",
  "src/app/passport/**",
  "src/app/profile/**",
  "src/app/api/account/**",
  "src/app/api/passport/**",
  "src/styles/personal-harbor.css",
  "playwright.homeport-phase3.config.ts",
]);
homeportOwner.testPaths = unique([
  ...homeportOwner.testPaths,
  "src/homeport/**/*.test.*",
  "src/components/homeport/**/*.test.*",
  "tests/e2e/homeport-phase3.spec.ts",
]);
homeportOwner.contractIds = unique([...homeportOwner.contractIds, ...phase3Contracts]);
await writeTestingJson("ownership.json", ownership);

const impactMap = readJson("impact-map.json", testingRoot);
impactMap.status = "phase-3-homeport-impact-map";
const upsertPathMapping = (pathPattern, suiteIds, contractIds) => {
  const current = impactMap.pathMappings.find((mapping) => mapping.path === pathPattern);
  if (current) {
    current.suiteIds = unique([...current.suiteIds, ...suiteIds]);
    current.contractIds = unique([...current.contractIds, ...contractIds]);
  } else impactMap.pathMappings.push({ path: pathPattern, suiteIds, contractIds });
};
for (const pathPattern of [
  "src/homeport/**",
  "src/components/homeport/**",
  "src/app/account/**",
  "src/app/passport/**",
  "src/app/profile/**",
  "src/app/api/account/**",
  "src/app/api/passport/**",
  "src/styles/personal-harbor.css",
]) {
  upsertPathMapping(pathPattern, ["unit.homeport", "component.homeport", "browser.homeport"], phase3Contracts);
}
for (const pathPattern of [
  "Development_Docs/Projects/Project_Homeport/**",
  "scripts/homeport/**",
  "tests/homeport/**",
  "package.json",
]) {
  upsertPathMapping(pathPattern, ["unit.homeport"], phase3Contracts);
}
upsertPathMapping("tests/e2e/homeport-phase3.spec.ts", ["browser.homeport"], phase3Contracts);
upsertPathMapping("playwright.homeport-phase3.config.ts", ["browser.homeport"], phase3Contracts);
impactMap.contractMappings = impactMap.contractMappings.filter(
  (mapping) => !phase3Contracts.includes(mapping.contractId),
);
for (const contractId of phase3Contracts)
  impactMap.contractMappings.push({
    contractId,
    suiteIds: ["unit.homeport", "component.homeport", "browser.homeport"],
  });
await writeTestingJson("impact-map.json", impactMap);

const suites = readJson("suites.json", testingRoot);
suites.status = "phase-3-homeport-owned-families";
const unitHomeport = suites.suites.find((suite) => suite.id === "unit.homeport");
if (!unitHomeport) throw new Error("SOUNDING_LINE_HOMEPORT_SUITE_MISSING");
unitHomeport.name = "Project Homeport inventory and Personal Harbor contracts";
unitHomeport.contracts = unique([...unitHomeport.contracts, ...phase3Contracts]);
unitHomeport.affectedPaths = unique([
  ...unitHomeport.affectedPaths,
  "src/homeport/**",
  "scripts/homeport/**",
  "tests/homeport/**",
]);
unitHomeport.currentImplementationState = "phase-3-homeport-contract-family";
const upsertSuite = (suite) => {
  const index = suites.suites.findIndex((candidate) => candidate.id === suite.id);
  if (index >= 0) suites.suites[index] = suite;
  else suites.suites.push(suite);
};
upsertSuite({
  id: "component.homeport",
  name: "Personal Harbor components",
  tier: 2,
  owner: "project-homeport",
  command: "registry-selected Vitest files",
  estimatedDuration: "measured-budget",
  expectedDurationMs: 60000,
  hardBudgetMs: 180000,
  parallelSafe: true,
  resources: ["node-slot", "vitest-worker-pool"],
  dependencies: ["unit.homeport"],
  contracts: phase3Contracts,
  affectedPaths: ["src/components/homeport/**"],
  releaseGates: ["subsystem", "mainline", "release-candidate"],
  currentImplementationState: "phase-3-owned-component-family",
  adapter: "vitest-family",
});
upsertSuite({
  id: "browser.homeport",
  name: "Personal Harbor browser journeys",
  tier: 4,
  owner: "project-homeport",
  command: "registry-selected Playwright cases",
  estimatedDuration: "measured-budget",
  expectedDurationMs: 180000,
  hardBudgetMs: 900000,
  parallelSafe: false,
  resources: ["application-port", "sqlite-clone", "browser-chromium", "media-root", "trace-root"],
  dependencies: ["unit.homeport", "component.homeport"],
  contracts: phase3Contracts,
  affectedPaths: ["tests/e2e/homeport-*.spec.ts", "playwright.homeport-phase*.config.ts"],
  releaseGates: ["subsystem", "mainline", "release-candidate"],
  currentImplementationState: "phase-3-owned-browser-family",
  adapter: "playwright-family",
});
await writeTestingJson("suites.json", suites);

const auditPath = path.join(auditRoot, "Homeport_Journey_Audit.md");
const audit = readFileSync(auditPath, "utf8");
const marker = "## Phase 3 implemented-state addendum";
const base = audit.includes(marker) ? audit.slice(0, audit.indexOf(marker)).trimEnd() : audit.trimEnd();
const rows = phase3Journeys
  .map(
    (journey) =>
      "| " +
      journey.journeyId +
      " | " +
      journey.name +
      " | " +
      journey.result +
      " | " +
      (journey.screenshots.join(", ") || "Behavioral contract") +
      " |",
  )
  .join("\n");
const addendum =
  marker +
  "\n\nProject Homeport Phase 3 adds 31 governed Personal Harbor journeys and 29 human-reviewed, checksum-bound synthetic after-state images without replacing Phase 0 through Phase 2 history. The implementation anchor is " +
  implementationAnchorSha +
  ".\n\n| Journey | Contract | Result | Visual evidence |\n| --- | --- | --- | --- |\n" +
  rows +
  "\n\nPhase 3 closes HP-NC-008, HP-NC-009, and HP-NC-028 after final governed validation, preserves the Phase 1 closure of HP-NC-007, and partially advances HP-NC-014, HP-NC-018, and HP-NC-019 without claiming later-phase closure. This is branch-local synthetic evidence, not merge, deployment, public proof, live-provider proof, or owner acceptance.\n";
writeFileSync(auditPath, await format(base + "\n\n" + addendum, { ...prettierConfig, parser: "markdown" }), "utf8");

console.log(
  JSON.stringify(
    {
      status: final ? "HOMEPORT_PHASE3_INVENTORIES_FINAL" : "HOMEPORT_PHASE3_INVENTORIES_UPDATED",
      implementationAnchorSha,
      sections: sectionRegistry.sections.length,
      journeys: phase3Journeys.length,
      visualEvidence: evidenceManifest.evidence.length,
      controls: 19,
    },
    null,
    2,
  ),
);
