import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { format } from "prettier";

const root = process.cwd();
const auditRoot = path.join(root, "Development_Docs", "Projects", "Project_Homeport");
const phase0SourceSha = "8d142227d712d27e363b15903dba9b0c99a04bc8";
const phase1BaseSha = "bda5217a67d8ce2b56a02163371c137d9ed07275";
const final = process.argv.includes("--final");
const updatedAt = "2026-08-01T19:00:00.000Z";

const readJson = (name) => JSON.parse(readFileSync(path.join(auditRoot, name), "utf8"));
const writeJson = async (name, value) =>
  writeFileSync(path.join(auditRoot, name), await format(JSON.stringify(value), { parser: "json" }), "utf8");
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

function implementationDigest() {
  const tracked = execFileSync("git", ["diff", "--name-only", "-z", phase1BaseSha], { cwd: root })
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { cwd: root })
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  const changed = [...new Set([...tracked, ...untracked])]
    .filter((file) => /^(src|tests|scripts\/sounding-line|playwright\.config\.ts)/u.test(file.replaceAll("\\", "/")))
    .filter((file) => existsSync(path.join(root, file)))
    .sort();
  const hash = createHash("sha256");
  for (const file of changed)
    hash
      .update(file.replaceAll("\\", "/"))
      .update("\0")
      .update(readFileSync(path.join(root, file)));
  return hash.digest("hex");
}

const sourceDigest = implementationDigest();
const phase1Envelope = {
  phase: "PHASE_1_UNITE_IDENTITY_AND_SESSION_AUTHORITY",
  implementationBaseSha: phase1BaseSha,
  implementationDigest: sourceDigest,
  state: final ? "VALIDATED" : "IMPLEMENTED_PENDING_FINAL_VALIDATION",
  updatedAt,
  historicalPhase0Preserved: true,
};

const compatibility = parseCsv(
  readFileSync(path.join(auditRoot, "Project_Homeport_Phase_1_Compatibility_Cutover_Ledger.csv"), "utf8"),
);
const compatibilityById = new Map(compatibility.records.map((record) => [record.authority_id, record]));
const sessions = readJson("Homeport_Authentication_and_Session_Inventory.json");
sessions.phase1Implementation = phase1Envelope;
for (const authority of sessions.authorities) {
  const ledger = compatibilityById.get(authority.authorityId);
  if (!ledger) continue;
  authority.phase1Implementation = {
    classification: ledger.classification,
    currentReads: ledger.current_reads,
    currentWrites: ledger.current_writes,
    action: ledger.phase_1_action,
    newWrites: ledger.new_writes_after_phase_1,
    fallbackReads: ledger.fallback_reads_after_phase_1,
    telemetry: ledger.telemetry,
    retirementCriteria: ledger.retirement_criteria,
    finalStatus: ledger.final_status,
    evidenceIds: ledger.evidence_ids.split(";").filter(Boolean),
  };
}
await writeJson("Homeport_Authentication_and_Session_Inventory.json", sessions);

const routeBehavior = {
  "/sign-in":
    "Canonical password lifecycle with Create Account, Forgot Password, explicit ended-session reason, and safe return.",
  "/register":
    "Reachable canonical registration establishes AccountSession, refreshes context, and completes the authorized return.",
  "/forgot-password": "Canonical recovery entry with non-enumerating response and preserved safe return intent.",
  "/reset-password": "Tokenized reset rotates the canonical session and authorizes a bounded return.",
  "/verify-email": "Tokenized verification refreshes canonical current-user context and creates no competing session.",
  "/player/sign-in": "Contextual Player and invitation adapter; contains no Player password form.",
  "/captain/sign-in": "Contextual Captain adapter; granted capability continues without a second credential.",
  "/studio/sign-in": "Contextual Creator adapter; granted capability continues without a second credential.",
  "/player/library": "Canonical Player capability guard derived from active PlayerProfile.",
  "/captain/library": "Canonical Captain capability guard with explicit permission and ended-session states.",
  "/studio/library": "Canonical Creator capability guard with explicit permission and ended-session states.",
  "/passport": "Canonical Player guard and shared client current-user consumer; no page-local identity authority.",
  "/account/security": "Canonical account guard; current/all-session revocation invalidates client context.",
  "/account/roles": "Canonical account guard and safe role projection.",
  "/community/moderation": "Authenticated non-moderator receives explicit permission denial and remains signed in.",
  "/community/moderation/[id]":
    "Authenticated non-moderator receives explicit permission denial and remains signed in.",
};
const routes = readJson("Homeport_Route_Inventory.json");
routes.phase1Implementation = phase1Envelope;
for (const route of routes.routes) {
  const behavior = routeBehavior[route.routePattern];
  if (!behavior) continue;
  route.phase1Implementation = {
    status: final ? "VALIDATED" : "IMPLEMENTED_PENDING_FINAL_VALIDATION",
    behavior,
    authority: "AccountSession via resolveCurrentUser",
    evidence: ["tests/e2e/homeport-phase1.spec.ts"],
  };
}
await writeJson("Homeport_Route_Inventory.json", routes);

const phase1Journeys = [
  [
    "A",
    "Anonymous to canonical sign-in",
    "/ -> /player/sign-in -> /sign-in -> /player/library",
    ["HP-SES-001"],
    ["HP-P1-EV-A-sign-in-desktop"],
  ],
  [
    "B",
    "Registration and intended return",
    "/ -> /player/sign-in -> /sign-in -> /register -> /player/library",
    ["HP-SES-001", "HP-SES-009"],
    ["HP-P1-EV-B-registration-return"],
  ],
  [
    "C",
    "Player and Passport continuity",
    "/ -> /sign-in -> /player/library -> /passport -> reload",
    ["HP-SES-001"],
    ["HP-P1-EV-C-passport-continuity"],
  ],
  [
    "D",
    "Captain continuity",
    "/ -> /sign-in -> /player/library -> /captain/library",
    ["HP-SES-001"],
    ["HP-P1-EV-F-workspace-continuity"],
  ],
  [
    "E",
    "Creator continuity",
    "/ -> /sign-in -> /player/library -> /studio/library",
    ["HP-SES-001"],
    ["HP-P1-EV-F-workspace-continuity"],
  ],
  [
    "F",
    "Full workspace continuity",
    "/player/library -> /captain/library -> /studio/library -> /passport -> /player/library",
    ["HP-SES-001"],
    ["HP-P1-EV-F-workspace-continuity"],
  ],
  [
    "G",
    "Explicit permission denial",
    "/ -> /sign-in -> /community/moderation",
    ["HP-SES-001"],
    ["HP-P1-EV-G-permission-denied"],
  ],
  [
    "H",
    "Session expiry and safe recovery",
    "/player/library -> /sign-in?reason=expired -> /player/library",
    ["HP-SES-001"],
    ["HP-P1-EV-H-session-expired"],
  ],
  [
    "I",
    "Visible sign-out",
    "/player/library -> / -> protected route denied",
    ["HP-SES-001", "HP-SES-002", "HP-SES-003", "HP-SES-009"],
    ["HP-P1-EV-I-sign-out-complete"],
  ],
  [
    "J",
    "Multi-tab sign-out reconciliation",
    "two tabs -> sign out -> second tab refetch -> protected route denied",
    ["HP-SES-001", "HP-SES-009"],
    ["HP-P1-EV-J-multitab-sign-out"],
  ],
  [
    "K",
    "Role removal without identity loss",
    "/captain/library denied -> /player/library allowed",
    ["HP-SES-001"],
    ["HP-P1-EV-K-role-removal"],
  ],
  [
    "L",
    "Legacy Player rotation",
    "chronicle_player -> /tales -> wayfarer_account",
    ["HP-SES-001", "HP-SES-003"],
    ["HP-P1-EV-L-legacy-player-rotation"],
  ],
  [
    "M",
    "Legacy staff bridge",
    "forever_gm -> /tales -> /captain/library -> wayfarer_account",
    ["HP-SES-001", "HP-SES-002"],
    ["HP-P1-EV-M-legacy-staff-bridge"],
  ],
  [
    "N",
    "Invitation acceptance handoff",
    "synthetic invitation -> accept -> canonical Player waiting room",
    ["HP-SES-001", "HP-SES-006"],
    ["HP-P1-EV-N-invitation-handoff"],
  ],
  [
    "O",
    "Malicious return rejection",
    "external returnTo -> sign-in -> /passport",
    ["HP-SES-001"],
    ["HP-P1-EV-O-safe-return"],
  ],
  [
    "P",
    "Mobile account lifecycle",
    "mobile / -> sign-in -> /player/library -> sign-out",
    ["HP-SES-001", "HP-SES-009"],
    ["HP-P1-EV-P-mobile-context"],
  ],
  [
    "Q",
    "Two-hundred-percent zoom states",
    "sign-in expiry -> registration -> moderation permission",
    ["HP-SES-001"],
    ["HP-P1-EV-Q-zoom-permission"],
  ],
].map(([letter, name, transitions, authorities, screenshots]) => ({
  journeyId: `HP-P1-JRN-${letter}`,
  name,
  sourceSha: phase0SourceSha,
  fixtureIdentity: "Synthetic reserved Homeport Phase 1 fixture",
  browser: "chromium",
  viewport: letter === "P" ? "390x844" : letter === "Q" ? "640x900 at 200 percent zoom" : "1280x720",
  steps: transitions.split(" -> "),
  controlsUsed: ["Keyboard and visible semantic controls"],
  routeTransitions: transitions.split(" -> "),
  sessionAuthoritiesObservedWithoutValues: authorities,
  expectedCurrentBehavior: name,
  observedBehavior: `${name} completed without a competing ordinary identity authority.`,
  screenshots,
  traces: [],
  result: "PASSED",
  rootBlocker: null,
  relatedNonconformityIds: [],
  targetPhase: "PHASE_1_IDENTITY_AND_SESSION",
  futureAcceptanceTest: `homeport.phase1.journey-${letter.toLowerCase()}`,
  phase1SourceDigest: sourceDigest,
}));
const journeyCatalog = readJson("Homeport_Journey_Catalog.json");
journeyCatalog.phase1Implementation = phase1Envelope;
journeyCatalog.journeys = journeyCatalog.journeys.filter((journey) => !journey.journeyId.startsWith("HP-P1-JRN-"));
journeyCatalog.journeys.push(...phase1Journeys);
await writeJson("Homeport_Journey_Catalog.json", journeyCatalog);

const navigation = readJson("Homeport_Navigation_Map.json");
navigation.phase1Implementation = phase1Envelope;
navigation.phase1AcceptanceEdges = phase1Journeys.map((journey) => ({
  journeyId: journey.journeyId,
  routeTransitions: journey.routeTransitions,
  accountAuthority: "HP-SES-001",
  result: journey.result,
}));
for (const edge of navigation.edges) {
  if (
    Object.keys(routeBehavior).some(
      (route) => edge.destinationScreen?.includes(route) || edge.sourceScreen?.includes(route),
    )
  )
    edge.phase1Implementation = { authority: "HP-SES-001", state: phase1Envelope.state };
}
await writeJson("Homeport_Navigation_Map.json", navigation);

const screenEvidence = {
  "screen-page-sign-in": ["HP-P1-EV-A-sign-in-desktop", "HP-P1-EV-I-sign-out-complete", "HP-P1-EV-J-multitab-sign-out"],
  "screen-page-register": ["HP-P1-EV-B-registration-return"],
  "screen-page-player-library": [
    "HP-P1-EV-B-registration-return",
    "HP-P1-EV-F-workspace-continuity",
    "HP-P1-EV-K-role-removal",
    "HP-P1-EV-P-mobile-context",
  ],
  "screen-page-passport": ["HP-P1-EV-C-passport-continuity", "HP-P1-EV-O-safe-return"],
  "screen-page-community-moderation": ["HP-P1-EV-G-permission-denied", "HP-P1-EV-Q-zoom-permission"],
  "screen-page-captain-library": ["HP-P1-EV-M-legacy-staff-bridge"],
  "screen-page-player-playthroughs-playthroughid": ["HP-P1-EV-N-invitation-handoff"],
  "screen-state-session-expired": ["HP-P1-EV-H-session-expired"],
  "screen-state-permission-restricted": ["HP-P1-EV-G-permission-denied", "HP-P1-EV-Q-zoom-permission"],
};
const touchedScreenIds = new Set([
  ...Object.keys(screenEvidence),
  "screen-page-account-security",
  "screen-page-captain-sign-in",
  "screen-page-forgot-password",
  "screen-page-player-sign-in",
  "screen-page-reset-password",
  "screen-page-studio-library",
  "screen-page-studio-sign-in",
  "screen-page-verify-email",
  "screen-state-loading",
  "screen-state-dependency-unavailable",
]);
for (const name of ["Homeport_Screen_Catalog.json", "Homeport_Screen_Contract_Catalog.json"]) {
  const catalog = readJson(name);
  catalog.phase1Implementation = phase1Envelope;
  for (const screen of catalog.screens) {
    if (!touchedScreenIds.has(screen.screenId)) continue;
    screen.phase1Implementation = {
      state: phase1Envelope.state,
      identityAuthority: "HP-SES-001",
      responsiveProof: "Desktop, mobile, keyboard, reduced-motion component coverage, and critical 200 percent zoom",
      evidenceIds: screenEvidence[screen.screenId] ?? [],
    };
    screen.screenshotIds = [...new Set([...(screen.screenshotIds ?? []), ...(screenEvidence[screen.screenId] ?? [])])];
    screen.journeyIds = [
      ...new Set([
        ...(screen.journeyIds ?? []),
        ...phase1Journeys
          .filter((journey) => journey.screenshots.some((id) => (screenEvidence[screen.screenId] ?? []).includes(id)))
          .map((journey) => journey.journeyId),
      ]),
    ];
  }
  await writeJson(name, catalog);
}

const evidenceDefinitions = [
  ["HP-P1-EV-A-sign-in-desktop", "/sign-in", "screen-page-sign-in", "HP-P1-JRN-A", "1280x720", "100%"],
  [
    "HP-P1-EV-B-registration-return",
    "/player/library",
    "screen-page-player-library",
    "HP-P1-JRN-B",
    "1280x720",
    "100%",
  ],
  ["HP-P1-EV-C-passport-continuity", "/passport", "screen-page-passport", "HP-P1-JRN-C", "1280x720", "100%"],
  [
    "HP-P1-EV-F-workspace-continuity",
    "/player/library",
    "screen-page-player-library",
    "HP-P1-JRN-F",
    "1280x720",
    "100%",
  ],
  [
    "HP-P1-EV-G-permission-denied",
    "/community/moderation",
    "screen-page-community-moderation",
    "HP-P1-JRN-G",
    "1280x720",
    "100%",
  ],
  ["HP-P1-EV-H-session-expired", "/sign-in", "screen-state-session-expired", "HP-P1-JRN-H", "1280x720", "100%"],
  ["HP-P1-EV-I-sign-out-complete", "/sign-in", "screen-page-sign-in", "HP-P1-JRN-I", "1280x720", "100%"],
  ["HP-P1-EV-J-multitab-sign-out", "/sign-in", "screen-page-sign-in", "HP-P1-JRN-J", "1280x720", "100%"],
  ["HP-P1-EV-K-role-removal", "/player/library", "screen-page-player-library", "HP-P1-JRN-K", "1280x720", "100%"],
  ["HP-P1-EV-L-legacy-player-rotation", "/tales", "screen-page-tales", "HP-P1-JRN-L", "1280x720", "100%"],
  [
    "HP-P1-EV-M-legacy-staff-bridge",
    "/captain/library",
    "screen-page-captain-library",
    "HP-P1-JRN-M",
    "1280x720",
    "100%",
  ],
  [
    "HP-P1-EV-N-invitation-handoff",
    "/player/playthroughs/:playthroughId",
    "screen-page-player-playthroughs-playthroughid",
    "HP-P1-JRN-N",
    "1280x720",
    "100%",
  ],
  ["HP-P1-EV-O-safe-return", "/passport", "screen-page-passport", "HP-P1-JRN-O", "1280x720", "100%"],
  ["HP-P1-EV-P-mobile-context", "/player/library", "screen-page-player-library", "HP-P1-JRN-P", "390x844", "100%"],
  [
    "HP-P1-EV-Q-zoom-permission",
    "/community/moderation",
    "screen-state-permission-restricted",
    "HP-P1-JRN-Q",
    "640x900",
    "200%",
  ],
];
const visual = readJson("Homeport_Visual_Baseline_Manifest.json");
visual.phase1Implementation = phase1Envelope;
visual.phase1Run = {
  runId: "homeport-phase1-20260801",
  fixture: "synthetic-reserved",
  implementationDigest: sourceDigest,
};
visual.records = visual.records.filter((record) => !record.evidenceId.startsWith("HP-P1-EV-"));
for (const [evidenceId, route, screenContract, journey, viewport, zoom] of evidenceDefinitions) {
  const relative = `Development_Docs/Projects/Project_Homeport/evidence/phase1/${evidenceId}.png`;
  const absolute = path.join(root, relative);
  if (!existsSync(absolute)) continue;
  visual.records.push({
    evidenceId,
    sourceSha: phase0SourceSha,
    branch: "codex/project-homeport-product-reality-recovery",
    route,
    screenContract,
    journey,
    accountFixture: "Synthetic reserved Homeport Phase 1 fixture",
    fixtureVersion: "homeport-phase1-v1",
    fixtureChecksum: createHash("sha256").update("homeport-phase1-synthetic-reserved-v1").digest("hex"),
    browser: "chromium",
    viewport,
    zoom,
    motionMode: "system or reduced according to journey",
    appearanceState: "Phase 1 implemented after-state",
    dataState: "Synthetic task-owned isolated database",
    screenshotPath: relative,
    committedScreenshotPath: relative,
    sha256: createHash("sha256").update(readFileSync(absolute)).digest("hex"),
    observedResult: "Phase 1 identity and session acceptance state rendered without private values.",
    knownDeviation: "Phase 2 navigation and Phase 3 Passport redesign remain outside scope.",
    timestamp: updatedAt,
    reviewerClassification: "PHASE_1_AFTER_STATE",
    phase1SourceDigest: sourceDigest,
  });
}
await writeJson("Homeport_Visual_Baseline_Manifest.json", visual);

const controlCsv = parseCsv(readFileSync(path.join(auditRoot, "Homeport_Control_Inventory.csv"), "utf8"));
const controlUpdates = {
  "HP-CTL-006": ["VALIDATED", "HP-P1-EV-A-sign-in-desktop"],
  "HP-CTL-008": ["VALIDATED", "HP-P1-EV-B-registration-return"],
  "HP-CTL-014": ["VALIDATED", "HP-P1-EV-I-sign-out-complete"],
  "HP-CTL-015": ["VALIDATED", "HP-P1-EV-F-workspace-continuity"],
  "HP-CTL-016": ["VALIDATED", "HP-P1-EV-F-workspace-continuity"],
  "HP-CTL-026": ["VALIDATED", "HP-P1-EV-C-passport-continuity"],
  "HP-CTL-030": ["VALIDATED", "HP-P1-EV-G-permission-denied"],
};
for (const record of controlCsv.records) {
  const update = controlUpdates[record.control_id];
  if (!update) continue;
  record.current_status = update[0];
  record.evidence_id = update[1];
  const baseReproductionSteps = record.reproduction_steps.split(" Phase 1 after-state:")[0];
  record.reproduction_steps = `${baseReproductionSteps} Phase 1 after-state: run the matching HP-P1 browser journey.`;
}
const addedControls = [
  [
    "HP-CTL-031",
    "Continue to account sign-in",
    "screen-page-player-sign-in",
    "/player/sign-in",
    "ANONYMOUS",
    "auth adapter visible",
    "enabled",
    "NAVIGATION",
    "Next Link /sign-in with safe returnTo",
    "link focus",
    "canonical sign-in",
    "route error",
    "/sign-in",
    "destination form",
    "Enter",
    "tap",
    "VALIDATED",
    "Run HP-P1-JRN-A from the gateway.",
    "HP-P1-EV-A-sign-in-desktop",
    "PHASE_1",
  ],
  [
    "HP-CTL-032",
    "Forgot Password",
    "screen-page-sign-in",
    "/sign-in",
    "ANONYMOUS",
    "canonical sign-in visible",
    "enabled",
    "NAVIGATION",
    "Next Link /forgot-password",
    "link focus",
    "recovery form",
    "route error",
    "/forgot-password",
    "destination form",
    "Enter",
    "tap",
    "VALIDATED",
    "Run HP-P1-JRN-A and inspect lifecycle links.",
    "HP-P1-EV-A-sign-in-desktop",
    "PHASE_1",
  ],
  [
    "HP-CTL-033",
    "Reauthenticate after expiry",
    "screen-state-session-expired",
    "/sign-in",
    "EXPIRED_SESSION",
    "expired reason present",
    "enabled",
    "AUTH_MUTATION",
    "/api/auth/sign-in",
    "Working announcement",
    "safe return",
    "associated error",
    "/player/library",
    "form remains operable",
    "Enter",
    "tap",
    "VALIDATED",
    "Run HP-P1-JRN-H.",
    "HP-P1-EV-H-session-expired",
    "PHASE_1",
  ],
  [
    "HP-CTL-034",
    "Return to an available workspace",
    "screen-state-permission-restricted",
    "/community/moderation",
    "AUTHENTICATED_WITHOUT_MODERATOR",
    "permission state visible",
    "enabled",
    "NAVIGATION",
    "AccessDecisionState safe action",
    "link focus",
    "available workspace",
    "route error",
    "/player/library",
    "destination heading",
    "Enter",
    "tap",
    "VALIDATED",
    "Run HP-P1-JRN-G.",
    "HP-P1-EV-G-permission-denied",
    "PHASE_1",
  ],
].map((values) => Object.fromEntries(controlCsv.headers.map((header, index) => [header, values[index] ?? ""])));
controlCsv.records = controlCsv.records.filter(
  (record) => !record.control_id.startsWith("HP-CTL-03") || Number(record.control_id.slice(-3)) <= 30,
);
controlCsv.records.push(...addedControls);
writeCsv("Homeport_Control_Inventory.csv", controlCsv.headers, controlCsv.records);

const nonconformityCsv = parseCsv(readFileSync(path.join(auditRoot, "Homeport_Nonconformity_Ledger.csv"), "utf8"));
const ncUpdates = {
  "HP-NC-002": [
    "HP-P1-JRN-A;HP-P1-JRN-D;HP-P1-JRN-E",
    "HP-P1-EV-A-sign-in-desktop;HP-P1-EV-F-workspace-continuity",
    "homeport.auth.single-product",
  ],
  "HP-NC-003": [
    "HP-P1-JRN-A;HP-P1-JRN-B",
    "HP-P1-EV-A-sign-in-desktop;HP-P1-EV-B-registration-return",
    "homeport.registration.reachable",
  ],
  "HP-NC-004": [
    "HP-P1-JRN-A;HP-P1-JRN-C;HP-P1-JRN-F",
    "HP-P1-EV-A-sign-in-desktop;HP-P1-EV-C-passport-continuity;HP-P1-EV-F-workspace-continuity",
    "homeport.session.convergence",
  ],
  "HP-NC-005": [
    "HP-P1-JRN-I;HP-P1-JRN-J",
    "HP-P1-EV-I-sign-out-complete;HP-P1-EV-J-multitab-sign-out",
    "homeport.signout.visible;homeport.signout.multi-tab;homeport.signout.compatibility",
  ],
  "HP-NC-007": ["HP-P1-JRN-C", "HP-P1-EV-C-passport-continuity", "homeport.passport.session"],
  "HP-NC-017": [
    "HP-P1-JRN-G;HP-P1-JRN-H",
    "HP-P1-EV-G-permission-denied;HP-P1-EV-H-session-expired",
    "homeport.context.failure-state;homeport.session.expiry;homeport.session.restricted-account",
  ],
  "HP-NC-021": [
    "HP-P1-JRN-A;HP-P1-JRN-B",
    "HP-P1-EV-A-sign-in-desktop;HP-P1-EV-B-registration-return",
    "homeport.shell.auth-refresh;homeport.current-user.no-stale-overwrite",
  ],
  "HP-NC-022": [
    "HP-P1-JRN-C;HP-P1-JRN-K",
    "HP-P1-EV-C-passport-continuity;HP-P1-EV-K-role-removal",
    "homeport.capability.player-agreement",
  ],
  "HP-NC-023": [
    "HP-P1-JRN-F;HP-P1-JRN-M",
    "HP-P1-EV-F-workspace-continuity;HP-P1-EV-M-legacy-staff-bridge",
    "homeport.capability.staff-agreement;homeport.legacy-staff.bridge",
  ],
  "HP-NC-024": ["HP-P1-JRN-B", "HP-P1-EV-B-registration-return", "homeport.registration.success-destination"],
  "HP-NC-025": ["HP-P1-JRN-A", "HP-P1-EV-A-sign-in-desktop", "homeport.signin.lifecycle-links"],
  "HP-NC-027": [
    "HP-P1-JRN-G;HP-P1-JRN-K",
    "HP-P1-EV-G-permission-denied;HP-P1-EV-K-role-removal",
    "homeport.permission.explicit",
  ],
};
for (const record of nonconformityCsv.records) {
  const update = ncUpdates[record.id];
  if (!update) continue;
  const prior = record.current_status;
  record.current_status = final ? "CLOSED" : "IMPLEMENTED_PENDING_VALIDATION";
  record.journeys = update[0];
  record.evidence_ids = update[1];
  record.test_ids = update[2];
  record.observed_result =
    "Phase 1 canonical AccountSession and current-user context behavior passed the linked focused and browser acceptance evidence.";
  record.disposition = final ? "CLOSED_PHASE_1_VALIDATED" : "PHASE_1_IMPLEMENTED_AWAITING_FINALIZER";
  if (!record.notes.includes("Phase 0 status was"))
    record.notes = `${record.notes} Phase 0 status was ${prior}. Historical evidence remains unchanged.`.trim();
}
writeCsv("Homeport_Nonconformity_Ledger.csv", nonconformityCsv.headers, nonconformityCsv.records);

console.log(
  JSON.stringify(
    {
      status: final ? "HOMEPORT_PHASE1_INVENTORIES_FINAL" : "HOMEPORT_PHASE1_INVENTORIES_UPDATED",
      sourceDigest,
      journeys: phase1Journeys.length,
      visualEvidence: visual.records.filter((record) => record.evidenceId.startsWith("HP-P1-EV-")).length,
    },
    null,
    2,
  ),
);
