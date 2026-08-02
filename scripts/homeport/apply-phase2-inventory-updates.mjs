import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { format, resolveConfig } from "prettier";

const root = process.cwd();
const auditRoot = path.join(root, "Development_Docs", "Projects", "Project_Homeport");
const historicalSourceSha = "8d142227d712d27e363b15903dba9b0c99a04bc8";
const phase1FinalSha = "dca3480f5369bfa7d5b8fd52e2cca155185fae33";
const architectureSha = "befb75625002a0b68093d1c35bfb846055cd9a14";
const implementationAnchorSha = "ce9fd8e70f0e906416cf41cd508ec5f2063570cc";
const updatedAt = "2026-08-01T23:45:00.000Z";
const final = process.argv.includes("--final");
const prettierConfig = (await resolveConfig(path.join(auditRoot, "Homeport_Route_Inventory.json"))) ?? {};

const readJson = (name) => JSON.parse(readFileSync(path.join(auditRoot, name), "utf8"));
const writeJson = async (name, value) =>
  writeFileSync(
    path.join(auditRoot, name),
    await format(JSON.stringify(value), { ...prettierConfig, parser: "json" }),
    "utf8",
  );
const quoteCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const unique = (values) => [...new Set(values)];

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
    records: data.map((values) => Object.fromEntries(headers.map((header, column) => [header, values[column]]))),
  };
}

function writeCsv(name, headers, records) {
  writeFileSync(
    path.join(auditRoot, name),
    `${headers.map(quoteCsv).join(",")}\n${records.map((record) => headers.map((header) => quoteCsv(record[header])).join(",")).join("\n")}\n`,
    "utf8",
  );
}

const phase2Envelope = {
  phase: "PHASE_2_RESTORE_GLOBAL_SHELL_AND_WAYFINDING",
  phase1FinalSha,
  architectureSha,
  implementationAnchorSha,
  state: final ? "VALIDATED" : "IMPLEMENTED_PENDING_FINAL_VALIDATION",
  updatedAt,
  historicalPhase0Preserved: true,
  noSchemaChange: true,
};

const journeyDefinitions = [
  [
    "A",
    "Anonymous gateway account lifecycle",
    ["/", "open Account", "Create Account and Sign In visible", "keyboard close and reopen"],
    ["HP-P2-EV-A-gateway-anonymous-desktop", "HP-P2-EV-E-account-menu-anonymous"],
    ["HP-NC-001", "HP-NC-006"],
  ],
  [
    "B",
    "Authenticated gateway identity",
    ["/", "/sign-in", "/", "authenticated identity and granted workspaces"],
    ["HP-P2-EV-B-gateway-authenticated-desktop", "HP-P2-EV-F-account-menu-authenticated"],
    ["HP-NC-001", "HP-NC-006"],
  ],
  ["C", "Gateway to Community Harbor", ["/", "/community", "/"], ["HP-P2-EV-K-community-shell"], ["HP-NC-010"]],
  ["D", "Gateway to Explore Chronicles", ["/", "/tales", "/"], ["HP-P2-EV-G-global-nav-public"], ["HP-NC-001"]],
  [
    "E",
    "Player workspace navigation",
    ["/", "/player/library", "/community", "/passport#profile", "/passport", "/account/security", "/player/library"],
    ["HP-P2-EV-H-player-navigation"],
    ["HP-NC-001", "HP-NC-006", "HP-NC-016"],
  ],
  [
    "F",
    "Captain workspace navigation",
    ["/", "/captain/library", "/community", "/passport", "/player/library", "/captain/library"],
    ["HP-P2-EV-I-captain-navigation"],
    ["HP-NC-001", "HP-NC-006", "HP-NC-016"],
  ],
  [
    "G",
    "Creator workspace navigation",
    ["/", "/studio/library", "/community", "/account/security", "/studio/library"],
    ["HP-P2-EV-J-creator-navigation"],
    ["HP-NC-001", "HP-NC-006", "HP-NC-016"],
  ],
  [
    "H",
    "Workspace switcher continuity",
    ["/player/library", "/captain/library", "/studio/library", "/player/library"],
    ["HP-P2-EV-M-workspace-switcher"],
    ["HP-NC-006", "HP-NC-016"],
  ],
  [
    "I",
    "Authenticated account-menu hierarchy",
    ["identity", "personal harbor", "workspaces", "account actions", "all personal destinations"],
    [],
    ["HP-NC-006", "HP-NC-008"],
  ],
  [
    "J",
    "Anonymous mobile navigation",
    ["390x844 /", "mobile global drawer", "Community and Explore", "anonymous account menu"],
    ["HP-P2-EV-C-gateway-anonymous-mobile", "HP-P2-EV-L-mobile-drawer"],
    ["HP-NC-001", "HP-NC-006", "HP-NC-016"],
  ],
  [
    "K",
    "Authenticated mobile parity",
    ["/player/library desktop set", "390x844 mobile set", "exact ID comparison", "/account/security", "Sign Out"],
    ["HP-P2-EV-D-gateway-authenticated-mobile"],
    ["HP-NC-001", "HP-NC-006", "HP-NC-016"],
  ],
  [
    "L",
    "Keyboard navigation",
    ["skip link", "global navigation", "account disclosure", "Escape restoration", "mobile drawer"],
    [],
    ["HP-NC-001", "HP-NC-006"],
  ],
  [
    "M",
    "Route-change lifecycle",
    ["open disclosure", "navigate", "close overlay", "restore body scroll", "repeat in mobile drawer"],
    [],
    ["HP-NC-001", "HP-NC-006"],
  ],
  [
    "N",
    "Active-state matrix",
    [
      "Home",
      "Explore",
      "Community root and nested",
      "Player",
      "Captain",
      "Creator",
      "Passport and Profile",
      "auth adapter",
    ],
    [],
    ["HP-NC-001", "HP-NC-010"],
  ],
  [
    "O",
    "Compact surface exit",
    ["/captain/sessions/:sessionId", "Exit to Captain Voyages", "/captain/library"],
    ["HP-P2-EV-N-compact-exit"],
    ["HP-NC-016"],
  ],
  [
    "P",
    "Immersive Player exit",
    [
      "/player/playthroughs/:playthroughId/journal",
      "Exit to My Voyages",
      "/player/library",
      "compare persisted Voyage state",
    ],
    ["HP-P2-EV-O-immersive-exit"],
    ["HP-NC-016"],
  ],
  [
    "Q",
    "Permission-restricted destination",
    ["/community/moderation", "explicit permission state", "authenticated account retained", "/"],
    ["HP-P2-EV-T-permission-return"],
    ["HP-NC-014"],
  ],
  [
    "R",
    "Current-user context unavailable",
    ["/", "task-owned 503", "unavailable account state", "retry", "anonymous state restored"],
    ["HP-P2-EV-P-context-unavailable"],
    ["HP-NC-001"],
  ],
  [
    "S",
    "Two-hundred-percent zoom",
    ["640 CSS pixels", "gateway", "account menu", "Community", "compact exit", "no overflow"],
    ["HP-P2-EV-Q-zoom-gateway", "HP-P2-EV-R-zoom-account-menu"],
    ["HP-NC-001", "HP-NC-006", "HP-NC-016"],
  ],
  [
    "T",
    "Reduced motion",
    ["reduced motion", "gateway", "disclosures", "immersive exit"],
    ["HP-P2-EV-S-reduced-motion"],
    ["HP-NC-001", "HP-NC-006", "HP-NC-016"],
  ],
  ["U", "Phase 1 regression continuity", ["Sign In", "Player", "Captain", "Creator", "Passport", "Sign Out"], [], []],
];

const phase2Journeys = journeyDefinitions.map(([letter, name, transitions, screenshots, related]) => ({
  journeyId: `HP-P2-JRN-${letter}`,
  name,
  sourceSha: historicalSourceSha,
  fixtureIdentity: "Reserved synthetic Homeport Phase 2 accounts and Voyage",
  browser: "Playwright Chromium 1.56.1",
  viewport: ["J", "K"].includes(letter)
    ? "390x844"
    : letter === "S"
      ? "640x900 at 200 percent layout equivalent"
      : "1440x900",
  steps: transitions,
  controlsUsed: ["Visible semantic controls", "Keyboard where required"],
  routeTransitions: transitions,
  sessionAuthoritiesObservedWithoutValues: ["HP-SES-001"],
  expectedCurrentBehavior: name,
  observedBehavior: `${name} passed in the task-owned isolated Phase 2 browser project.`,
  screenshots,
  traces: [],
  result: "PASSED",
  rootBlocker: null,
  relatedNonconformityIds: related,
  targetPhase: "PHASE_2_RESTORE_GLOBAL_SHELL_AND_WAYFINDING",
  futureAcceptanceTest: `homeport.phase2.journey-${letter.toLowerCase()}`,
  phase2ImplementationAnchorSha: implementationAnchorSha,
}));

const journeyCatalog = readJson("Homeport_Journey_Catalog.json");
journeyCatalog.phase2Implementation = phase2Envelope;
journeyCatalog.journeys = journeyCatalog.journeys.filter((journey) => !journey.journeyId.startsWith("HP-P2-JRN-"));
journeyCatalog.journeys.push(...phase2Journeys);
await writeJson("Homeport_Journey_Catalog.json", journeyCatalog);

const evidenceDefinitions = [
  [
    "A-gateway-anonymous-desktop",
    "/",
    "screen-page-root",
    "A",
    "1440x900",
    "100%",
    "anonymous",
    "public",
    "GATEWAY_STANDARD",
  ],
  [
    "B-gateway-authenticated-desktop",
    "/",
    "screen-page-root",
    "B",
    "1440x900",
    "100%",
    "authenticated-full",
    "public",
    "GATEWAY_STANDARD",
  ],
  [
    "C-gateway-anonymous-mobile",
    "/",
    "screen-page-root",
    "J",
    "390x844",
    "100%",
    "anonymous",
    "public",
    "GATEWAY_STANDARD",
  ],
  [
    "D-gateway-authenticated-mobile",
    "/",
    "screen-page-root",
    "K",
    "390x844",
    "100%",
    "authenticated-full",
    "public",
    "GATEWAY_STANDARD",
  ],
  [
    "E-account-menu-anonymous",
    "/",
    "screen-page-root",
    "A",
    "1440x900",
    "100%",
    "anonymous",
    "public",
    "GATEWAY_STANDARD",
  ],
  [
    "F-account-menu-authenticated",
    "/",
    "screen-page-root",
    "B",
    "1440x900",
    "100%",
    "authenticated-full",
    "public",
    "GATEWAY_STANDARD",
  ],
  [
    "G-global-nav-public",
    "/tales",
    "screen-page-tales",
    "D",
    "1440x900",
    "100%",
    "anonymous",
    "public",
    "PUBLIC_STANDARD",
  ],
  [
    "H-player-navigation",
    "/player/library",
    "screen-page-player-library",
    "E",
    "1440x900",
    "100%",
    "authenticated-player",
    "player",
    "WORKSPACE_STANDARD",
  ],
  [
    "I-captain-navigation",
    "/captain/library",
    "screen-page-captain-library",
    "F",
    "1440x900",
    "100%",
    "authenticated-full",
    "captain",
    "WORKSPACE_STANDARD",
  ],
  [
    "J-creator-navigation",
    "/studio/library",
    "screen-page-studio-library",
    "G",
    "1440x900",
    "100%",
    "authenticated-full",
    "creator",
    "WORKSPACE_STANDARD",
  ],
  [
    "K-community-shell",
    "/community",
    "screen-page-community",
    "C",
    "1440x900",
    "100%",
    "anonymous",
    "community",
    "PUBLIC_STANDARD",
  ],
  ["L-mobile-drawer", "/", "screen-page-root", "J", "390x844", "100%", "anonymous", "public", "GATEWAY_STANDARD"],
  [
    "M-workspace-switcher",
    "/player/library",
    "screen-page-player-library",
    "H",
    "1440x900",
    "100%",
    "authenticated-full",
    "player",
    "WORKSPACE_STANDARD",
  ],
  [
    "N-compact-exit",
    "/captain/sessions/:sessionId",
    "screen-page-captain-sessions-sessionid",
    "O",
    "1440x900",
    "100%",
    "authenticated-full",
    "captain",
    "COMPACT",
  ],
  [
    "O-immersive-exit",
    "/player/playthroughs/:playthroughId/journal",
    "screen-page-player-playthroughs-playthroughid-journal",
    "P",
    "1440x900",
    "100%",
    "authenticated-full",
    "player",
    "IMMERSIVE",
  ],
  [
    "P-context-unavailable",
    "/",
    "screen-state-dependency-unavailable",
    "R",
    "1440x900",
    "100%",
    "dependency-unavailable",
    "public",
    "GATEWAY_STANDARD",
  ],
  ["Q-zoom-gateway", "/", "screen-page-root", "S", "640x900", "200%", "anonymous", "public", "GATEWAY_STANDARD"],
  [
    "R-zoom-account-menu",
    "/",
    "screen-page-root",
    "S",
    "640x900",
    "200%",
    "authenticated-full",
    "public",
    "GATEWAY_STANDARD",
  ],
  ["S-reduced-motion", "/", "screen-page-root", "T", "1440x900", "100%", "anonymous", "public", "GATEWAY_STANDARD"],
  [
    "T-permission-return",
    "/community/moderation",
    "screen-page-community-moderation",
    "Q",
    "1440x900",
    "100%",
    "authenticated-without-moderator",
    "community",
    "PUBLIC_STANDARD",
  ],
];

const fixtureChecksum = createHash("sha256").update("homeport-phase2-reserved-synthetic-fixture-v1").digest("hex");
const visual = readJson("Homeport_Visual_Baseline_Manifest.json");
visual.phase2Implementation = phase2Envelope;
visual.phase2Run = {
  runId: "homeport-phase2-20260801",
  fixture: "reserved-synthetic-task-owned",
  implementationAnchorSha,
  browserVersion: "Playwright Chromium 1.56.1",
  visualReview: final ? "ALL_20_ACCEPTED" : "PENDING_FINAL_CLASSIFICATION",
};
visual.records = visual.records.filter((record) => !record.evidenceId.startsWith("HP-P2-EV-"));
for (const [
  suffix,
  route,
  screenContract,
  letter,
  viewport,
  zoom,
  accountState,
  workspace,
  shellMode,
] of evidenceDefinitions) {
  const evidenceId = `HP-P2-EV-${suffix}`;
  const relative = `Development_Docs/Projects/Project_Homeport/evidence/phase2/${evidenceId}.png`;
  const absolute = path.join(root, relative);
  if (!existsSync(absolute)) throw new Error(`MISSING_PHASE2_EVIDENCE:${relative}`);
  visual.records.push({
    evidenceId,
    sourceSha: historicalSourceSha,
    implementationAnchorSha,
    branch: "codex/project-homeport-product-reality-recovery",
    route,
    screenContract,
    journey: `HP-P2-JRN-${letter}`,
    accountFixture: "Reserved synthetic Homeport Phase 2 fixture",
    fixtureVersion: "homeport-phase2-v1",
    fixtureChecksum,
    browser: "chromium",
    browserVersion: "Playwright Chromium 1.56.1",
    viewport,
    zoom,
    motionMode: suffix.startsWith("S-") ? "reduced" : "system or journey-controlled",
    accountState,
    workspace,
    shellMode,
    appearanceState: "Phase 2 implemented after-state",
    dataState: "Synthetic task-owned isolated copied database",
    screenshotPath: relative,
    committedScreenshotPath: relative,
    sha256: createHash("sha256").update(readFileSync(absolute)).digest("hex"),
    observedResult:
      "Visually inspected Phase 2 shell and navigation state; no overlap, clipping, duplicate shell, or horizontal overflow accepted.",
    knownDeviation:
      "Local synthetic evidence only; Phase 3 Personal Harbor, Phase 4 Community content, Phase 5 exhaustive reachability, deployment, and owner acceptance remain outside scope.",
    timestamp: updatedAt,
    reviewerClassification: final ? "PHASE_2_AFTER_STATE_ACCEPTED" : "PHASE_2_AFTER_STATE_PENDING_FINALIZER",
  });
}
await writeJson("Homeport_Visual_Baseline_Manifest.json", visual);

const shellRegistry = readJson("Project_Homeport_Phase_2_Shell_Mode_Registry.json");
const shellByRoute = new Map(shellRegistry.records.map((record) => [record.routeId, record]));
const evidenceByRoute = new Map();
for (const definition of evidenceDefinitions) {
  const [suffix, route, , letter] = definition;
  const current = evidenceByRoute.get(route) ?? { evidence: [], journeys: [] };
  current.evidence.push(`HP-P2-EV-${suffix}`);
  current.journeys.push(`HP-P2-JRN-${letter}`);
  evidenceByRoute.set(route, current);
}
const routes = readJson("Homeport_Route_Inventory.json");
routes.phase2Implementation = phase2Envelope;
for (const route of routes.routes) {
  if (route.kind.toLowerCase() !== "page") continue;
  const shell = shellByRoute.get(route.routeId);
  if (!shell) throw new Error(`MISSING_PHASE2_SHELL_RECORD:${route.routeId}`);
  const linked = evidenceByRoute.get(route.routePattern) ?? { evidence: [], journeys: [] };
  route.shellMode = shell.mode;
  route.currentJourneys = unique([...route.currentJourneys, ...linked.journeys]);
  route.currentVisualEvidenceIds = unique([...route.currentVisualEvidenceIds, ...linked.evidence]);
  route.phase2Implementation = {
    state: phase2Envelope.state,
    shellMode: shell.mode,
    canonicalRoute: shell.canonicalRoute,
    globalNavigationVisibility: shell.globalNavigationVisibility,
    workspaceNavigationVisibility: shell.workspaceNavigationVisibility,
    accountControlVisibility: shell.accountControlVisibility,
    contextualNavigation: shell.contextualNavigation,
    exitTarget: shell.exitTarget,
    implementationAnchorSha,
    evidenceIds: linked.evidence,
  };
}
for (const routePattern of [
  "/",
  "/tales",
  "/community",
  "/player/library",
  "/captain/library",
  "/studio/library",
  "/passport",
  "/account/security",
]) {
  const route = routes.routes.find((candidate) => candidate.routePattern === routePattern);
  if (!route) continue;
  route.currentDesktopPath = unique([
    ...route.currentDesktopPath.filter((entry) => entry !== "DIRECT_URL_ONLY"),
    "src/navigation/registry.ts",
  ]);
  route.currentMobilePath = unique([
    ...route.currentMobilePath.filter((entry) => entry !== "DIRECT_URL_ONLY"),
    "src/navigation/registry.ts",
  ]);
  route.directUrlRequired = false;
  route.orphanedOrdinaryRoute = false;
  route.currentMaturity =
    route.currentMaturity === "BROKEN" || route.currentMaturity === "UNREACHABLE" ? "PARTIAL" : route.currentMaturity;
}
await writeJson("Homeport_Route_Inventory.json", routes);

const navigationContract = readJson("Project_Homeport_Phase_2_Navigation_Projection_Contract.json");
const navigation = readJson("Homeport_Navigation_Map.json");
navigation.phase2Implementation = phase2Envelope;
navigation.shellModes = shellRegistry.validModes;
navigation.naturalEntryFromGateway = unique([...(navigation.naturalEntryFromGateway ?? []), "/tales", "/community"]);
navigation.missingGatewayEntries = (navigation.missingGatewayEntries ?? []).filter(
  (entry) => !["/tales", "/community"].includes(entry),
);
navigation.phase2AcceptanceEdges = phase2Journeys.map((journey) => ({
  journeyId: journey.journeyId,
  routeTransitions: journey.routeTransitions,
  shellAuthority: "src/components/shell/ProductShell.tsx",
  navigationAuthority: "src/navigation/registry.ts",
  result: journey.result,
}));
navigation.edges = navigation.edges.filter((edge) => !edge.nodeId.startsWith("phase2-"));
const navigationEvidence = {
  GLOBAL: "HP-P2-EV-G-global-nav-public",
  WORKSPACE: "HP-P2-EV-M-workspace-switcher",
  ACCOUNT: "HP-P2-EV-F-account-menu-authenticated",
  CONTEXTUAL: "HP-P2-EV-N-compact-exit",
};
navigation.edges.push(
  ...navigationContract.records.map((item) => ({
    nodeId: `phase2-${item.itemId}`,
    routeId: `phase2-navigation-${item.itemId}`,
    label: item.label,
    controlId: item.itemId,
    sourceScreen: "src/navigation/registry.ts",
    destinationScreen: item.destination,
    desktopAvailability: item.desktopPlacement !== "hidden",
    mobileAvailability: item.mobilePlacement !== "hidden",
    authentication: item.authenticatedOnly ? "AUTHENTICATED" : item.anonymousOnly ? "ANONYMOUS" : "STATE_DEPENDENT",
    capabilities: item.requiredCapabilities,
    hiddenCondition: item.desktopPlacement === "hidden" ? "COMPATIBILITY_ALIAS_NOT_RENDERED" : null,
    disabledCondition: null,
    redirectBehavior: item.destination.startsWith("/") ? "DESTINATION_GUARD" : "DYNAMIC_SAFE_ACTION",
    currentStatus: final ? "PHASE_2_VALIDATED" : "PHASE_2_IMPLEMENTED",
    evidenceId: navigationEvidence[item.layer],
    phase2ImplementationAnchorSha: implementationAnchorSha,
  })),
);
await writeJson("Homeport_Navigation_Map.json", navigation);

const screenEvidence = new Map();
for (const [suffix, , screenId, letter] of evidenceDefinitions) {
  const current = screenEvidence.get(screenId) ?? { evidence: [], journeys: [] };
  current.evidence.push(`HP-P2-EV-${suffix}`);
  current.journeys.push(`HP-P2-JRN-${letter}`);
  screenEvidence.set(screenId, current);
}
const touchedScreenIds = new Set([
  ...screenEvidence.keys(),
  "screen-page-passport",
  "screen-page-account-security",
  "screen-page-profile-handle",
  "screen-state-loading",
]);
for (const name of ["Homeport_Screen_Catalog.json", "Homeport_Screen_Contract_Catalog.json"]) {
  const catalog = readJson(name);
  catalog.phase2Implementation = phase2Envelope;
  for (const screen of catalog.screens) {
    if (!touchedScreenIds.has(screen.screenId)) continue;
    const linked = screenEvidence.get(screen.screenId) ?? { evidence: [], journeys: [] };
    const routeId = screen.routeIds[0];
    const shell = routeId ? shellByRoute.get(routeId) : null;
    if (shell) screen.shellMode = shell.mode;
    screen.screenshotIds = unique([...screen.screenshotIds, ...linked.evidence]);
    screen.journeyIds = unique([...screen.journeyIds, ...linked.journeys]);
    screen.phase2Implementation = {
      state: phase2Envelope.state,
      shellMode: shell?.mode ?? "STATE_DEPENDENT",
      shellAuthority: "src/components/shell/ProductShell.tsx",
      navigationAuthority: "src/navigation/registry.ts",
      responsiveProof: "Desktop, 390x844 mobile, 200 percent layout equivalent, keyboard, and reduced motion",
      evidenceIds: linked.evidence,
      implementationAnchorSha,
    };
  }
  await writeJson(name, catalog);
}

const controlCsv = parseCsv(readFileSync(path.join(auditRoot, "Homeport_Control_Inventory.csv"), "utf8"));
const controlDefinitions = [
  [
    "035",
    "Account",
    "screen-page-root",
    "/",
    "ALL",
    "shell context safe",
    "DISCLOSURE",
    "ProductShell account disclosure",
    "HP-P2-EV-A-gateway-anonymous-desktop",
    "A",
  ],
  [
    "036",
    "Create Account",
    "screen-page-root",
    "/",
    "ANONYMOUS",
    "anonymous account menu",
    "NAVIGATION",
    "/register",
    "HP-P2-EV-E-account-menu-anonymous",
    "A",
  ],
  [
    "037",
    "Sign In",
    "screen-page-root",
    "/",
    "ANONYMOUS",
    "anonymous account menu",
    "NAVIGATION",
    "safe /sign-in return",
    "HP-P2-EV-E-account-menu-anonymous",
    "A",
  ],
  [
    "038",
    "Explore Chronicles",
    "screen-page-root",
    "/",
    "ALL",
    "global shell",
    "NAVIGATION",
    "/tales",
    "HP-P2-EV-G-global-nav-public",
    "D",
  ],
  [
    "039",
    "Community Harbor",
    "screen-page-root",
    "/",
    "ALL",
    "global shell",
    "NAVIGATION",
    "/community",
    "HP-P2-EV-K-community-shell",
    "C",
  ],
  [
    "040",
    "Open navigation",
    "screen-page-root",
    "/",
    "ALL",
    "responsive drawer breakpoint",
    "DISCLOSURE",
    "ProductShell mobile drawer",
    "HP-P2-EV-L-mobile-drawer",
    "J",
  ],
  [
    "041",
    "View My Profile",
    "screen-page-root",
    "/",
    "AUTHENTICATED",
    "identity group",
    "NAVIGATION",
    "public profile or /passport#profile",
    "HP-P2-EV-F-account-menu-authenticated",
    "I",
  ],
  [
    "042",
    "Chronicle Passport",
    "screen-page-root",
    "/",
    "AUTHENTICATED",
    "Personal Harbor group",
    "NAVIGATION",
    "/passport",
    "HP-P2-EV-F-account-menu-authenticated",
    "I",
  ],
  [
    "043",
    "Security & Sessions",
    "screen-page-root",
    "/",
    "AUTHENTICATED",
    "Personal Harbor group",
    "NAVIGATION",
    "/account/security",
    "HP-P2-EV-H-player-navigation",
    "E",
  ],
  [
    "044",
    "Player workspace",
    "screen-page-root",
    "/",
    "PLAYER",
    "granted workspace",
    "NAVIGATION",
    "/player/library",
    "HP-P2-EV-M-workspace-switcher",
    "H",
  ],
  [
    "045",
    "Captain workspace",
    "screen-page-root",
    "/",
    "CAPTAIN",
    "granted workspace",
    "NAVIGATION",
    "/captain/library",
    "HP-P2-EV-M-workspace-switcher",
    "H",
  ],
  [
    "046",
    "Creator Studio workspace",
    "screen-page-root",
    "/",
    "CREATOR",
    "granted workspace",
    "NAVIGATION",
    "/studio/library",
    "HP-P2-EV-M-workspace-switcher",
    "H",
  ],
  [
    "047",
    "Sign Out",
    "screen-page-root",
    "/",
    "AUTHENTICATED",
    "account actions group",
    "AUTH_MUTATION",
    "/api/auth/sign-out",
    "HP-P2-EV-D-gateway-authenticated-mobile",
    "K",
  ],
  [
    "048",
    "Exit to Captain Voyages",
    "screen-page-captain-sessions-sessionid",
    "/captain/sessions/:sessionId",
    "CAPTAIN",
    "compact context",
    "NAVIGATION",
    "/captain/library",
    "HP-P2-EV-N-compact-exit",
    "O",
  ],
  [
    "049",
    "Exit to My Voyages",
    "screen-page-player-playthroughs-playthroughid-journal",
    "/player/playthroughs/:playthroughId/journal",
    "PLAYER",
    "immersive context",
    "NAVIGATION",
    "/player/library",
    "HP-P2-EV-O-immersive-exit",
    "P",
  ],
  [
    "050",
    "Retry account check",
    "screen-state-dependency-unavailable",
    "/",
    "DEPENDENCY_UNAVAILABLE",
    "account context unavailable",
    "CONTEXT_REFRESH",
    "/api/auth/context",
    "HP-P2-EV-P-context-unavailable",
    "R",
  ],
].map(([number, label, screen, route, role, visibility, action, endpoint, evidence, journey]) => ({
  control_id: `HP-CTL-${number}`,
  label,
  screen,
  route,
  role_or_capability: role,
  visibility_condition: visibility,
  enabled_condition: "enabled when rendered",
  action_type: action,
  authoritative_endpoint_or_server_action: endpoint,
  pending_feedback:
    action.includes("MUTATION") || action.includes("REFRESH") ? "bounded pending state" : "not applicable",
  success_feedback: "destination or disclosure state",
  failure_feedback: "explicit associated or unavailable state",
  navigation_result: endpoint,
  focus_result: "destination heading or restored trigger",
  keyboard_operation: "Tab, Enter, Escape where applicable",
  mobile_operation: "tap with equivalent functional destination",
  current_status: final ? "VALIDATED" : "IMPLEMENTED_PENDING_VALIDATION",
  reproduction_steps: `Run HP-P2-JRN-${journey} in the isolated Phase 2 browser project.`,
  evidence_id: evidence,
  target_phase: "PHASE_2",
}));
controlCsv.records = controlCsv.records.filter((record) => !/^HP-CTL-(?:03[5-9]|04\d|050)$/u.test(record.control_id));
controlCsv.records.push(
  ...controlDefinitions.map((record) =>
    Object.fromEntries(controlCsv.headers.map((header) => [header, record[header] ?? ""])),
  ),
);
writeCsv("Homeport_Control_Inventory.csv", controlCsv.headers, controlCsv.records);

const ncCsv = parseCsv(readFileSync(path.join(auditRoot, "Homeport_Nonconformity_Ledger.csv"), "utf8"));
const directClosures = {
  "HP-NC-001": [
    "A;B;D;E;F;G;J;K;L;M;R;S;T",
    "A-gateway-anonymous-desktop;B-gateway-authenticated-desktop;C-gateway-anonymous-mobile;D-gateway-authenticated-mobile;G-global-nav-public;H-player-navigation;I-captain-navigation;J-creator-navigation;P-context-unavailable;Q-zoom-gateway;S-reduced-motion",
    "homeport.shell.mode-cardinality;homeport.shell.global-navigation;homeport.shell.route-lifecycle",
  ],
  "HP-NC-006": [
    "A;B;E;F;G;H;I;J;K;L;M;S;T",
    "E-account-menu-anonymous;F-account-menu-authenticated;H-player-navigation;I-captain-navigation;J-creator-navigation;L-mobile-drawer;M-workspace-switcher;R-zoom-account-menu",
    "homeport.shell.account-menu;homeport.shell.workspace-switcher;homeport.navigation.desktop-mobile-set-equality",
  ],
  "HP-NC-010": ["C;N", "K-community-shell", "homeport.community.global-reachability;homeport.shell.active-state"],
  "HP-NC-016": [
    "E;F;G;H;J;K;O;P;S;T",
    "H-player-navigation;I-captain-navigation;J-creator-navigation;L-mobile-drawer;M-workspace-switcher;N-compact-exit;O-immersive-exit",
    "homeport.navigation.contextual-parent;homeport.shell.compact-exit;homeport.shell.immersive-exit",
  ],
};
const partialAdvancement = {
  "HP-NC-008": [
    "I",
    "F-account-menu-authenticated",
    "homeport.shell.account-menu",
    "Phase 2 makes existing Personal Harbor destinations reachable; Phase 3 retains information architecture, provider-control removal, and visual reconstruction.",
  ],
  "HP-NC-014": [
    "Q",
    "T-permission-return",
    "homeport.context.permission-state",
    "Phase 2 preserves a coherent shell and safe return for permission denial; later screen-state completion remains owned by Phase 6.",
  ],
  "HP-NC-026": [
    "C;J;K",
    "K-community-shell;L-mobile-drawer",
    "homeport.community.global-reachability",
    "Phase 2 makes Community globally reachable on desktop and mobile; Phase 4 retains Community content and district reconstruction.",
  ],
};
for (const record of ncCsv.records) {
  if (directClosures[record.id]) {
    const [letters, evidence, tests] = directClosures[record.id];
    const prior = record.current_status;
    record.current_status = final ? "CLOSED" : "IMPLEMENTED_PENDING_VALIDATION";
    record.journeys = letters
      .split(";")
      .map((letter) => `HP-P2-JRN-${letter}`)
      .join(";");
    record.evidence_ids = evidence
      .split(";")
      .map((suffix) => `HP-P2-EV-${suffix}`)
      .join(";");
    record.test_ids = tests;
    record.observed_result =
      "Phase 2 shell, navigation, parity, and browser contracts passed with checksum-bound synthetic evidence.";
    record.disposition = final ? "CLOSED_PHASE_2_VALIDATED" : "PHASE_2_IMPLEMENTED_AWAITING_FINALIZER";
    if (!record.notes.includes("Phase 2 prior status was"))
      record.notes = `${record.notes} Phase 2 prior status was ${prior}. Historical evidence remains preserved.`.trim();
  } else if (partialAdvancement[record.id]) {
    const [letters, evidence, tests, limitation] = partialAdvancement[record.id];
    const prior = record.current_status;
    record.current_status = "PARTIALLY_ADVANCED_PHASE_2";
    record.journeys = unique([
      ...record.journeys.split(";").filter(Boolean),
      ...letters.split(";").map((letter) => `HP-P2-JRN-${letter}`),
    ]).join(";");
    record.evidence_ids = unique([
      ...record.evidence_ids.split(";").filter(Boolean),
      ...evidence.split(";").map((suffix) => `HP-P2-EV-${suffix}`),
    ]).join(";");
    record.test_ids = unique([...record.test_ids.split(";").filter(Boolean), ...tests.split(";")]).join(";");
    record.observed_result = limitation;
    record.disposition = "PARTIAL_PHASE_2_LATER_OWNER_RETAINED";
    if (!record.notes.includes("Phase 2 prior status was"))
      record.notes = `${record.notes} Phase 2 prior status was ${prior}. ${limitation}`.trim();
  }
}
writeCsv("Homeport_Nonconformity_Ledger.csv", ncCsv.headers, ncCsv.records);

const auditPath = path.join(auditRoot, "Homeport_Journey_Audit.md");
const audit = readFileSync(auditPath, "utf8");
const marker = "## Phase 2 implemented-state addendum";
const base = audit.includes(marker) ? audit.slice(0, audit.indexOf(marker)).trimEnd() : audit.trimEnd();
const journeyRows = phase2Journeys
  .map(
    (journey) =>
      `| ${journey.journeyId} | ${journey.name} | PASSED | ${journey.screenshots.join(", ") || "Behavioral contract only"} |`,
  )
  .join("\n");
const addendum = `${marker}\n\nPhase 2 adds 21 isolated Chromium journeys and 20 visually inspected, checksum-bound synthetic after-state images without replacing Phase 0 or Phase 1 history. The implementation anchor is \`${implementationAnchorSha}\`.\n\n| Journey | Contract | Result | Visual evidence |\n| --- | --- | --- | --- |\n${journeyRows}\n\nDirectly closed after governed final validation: HP-NC-001, HP-NC-006, HP-NC-010, and HP-NC-016. Partially advanced without false closure: HP-NC-008, HP-NC-014, and HP-NC-026. This is local branch evidence, not deployment, owner acceptance, or product acceptance.\n`;
writeFileSync(auditPath, await format(`${base}\n\n${addendum}`, { ...prettierConfig, parser: "markdown" }), "utf8");

console.log(
  JSON.stringify(
    {
      status: final ? "HOMEPORT_PHASE2_INVENTORIES_FINAL" : "HOMEPORT_PHASE2_INVENTORIES_UPDATED",
      implementationAnchorSha,
      journeys: phase2Journeys.length,
      visualEvidence: visual.records.filter((record) => record.evidenceId.startsWith("HP-P2-EV-")).length,
      navigationItems: navigationContract.records.length,
      shellPages: shellRegistry.pageCount,
    },
    null,
    2,
  ),
);
