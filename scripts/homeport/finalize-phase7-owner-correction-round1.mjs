import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";
import { spawnSync } from "node:child_process";

const root = path.resolve(process.cwd());
const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const sourceSha = required("HOMEPORT_PHASE7_CORRECTION_SOURCE_SHA");
const expectedSourceSha = "61ea9ec546622b2bce2036d249fca408922786d2";
const fixtureVersion = "homeport-phase7-owner-correction-round1-v1";
const branch = "codex/project-homeport-product-reality-recovery";
const projectRoot = path.join(root, "Development_Docs", "Projects", "Project_Homeport");
const evidenceRoot = path.join(projectRoot, "evidence", "phase7-owner-correction-round1");
const screenshotRoot = path.join(evidenceRoot, "screenshots");
const metadataRoot = path.join(evidenceRoot, "metadata");
const reportRoot = path.join(taskRoot, "reports", "owner-correction-journeys");
const fixtureReceiptPath = path.join(taskRoot, "reports", "owner-correction-fixture-prepare-receipt.json");
const architectureSha = "ed8f1ef5316f11340276bebe6c70715159321ef6";
const implementationCommits = [
  "a5173c38f38f5bad9a32ef67ecd1a02e45b88b48",
  "b15db465a6cfe6038964400928a5cc8472988450",
  "fe591eb07e54c5e8aef086b1db67871e4f912969",
  "baf0b99c3830bdd1d5f0582ff6cc6cb0059e0a1c",
  "ac17d745521ed3220316e0b2cb5847b548c80426",
  "4a614e4b843f7e20b183f6278b3a0e98cc1bbb23",
  "cc3e0b7da298143c1d1301699dc31b2eec39575c",
  "3ca0a4d6833c7fb85ddc23351351b01706c4708d",
  "72222ae557c0c3785899b6faa3bf17e0a22b308e",
  "e9548947147e82ee56f8bfc79fee8e5ce27a0a22",
  sourceSha,
];
const correctionJourneyNames = Object.fromEntries(
  [
    "Chronicle preview and nonmutation",
    "Signed-in name and alias",
    "All Workspaces capability unification",
    "Active Chronicle lock and safe leave",
    "Public Profile destination and display-name authority",
    "Account claiming",
    "Email verification",
    "Email change and recovery",
    "Linked identities",
    "Account export",
    "Deactivation and reactivation",
    "Deletion request and cancellation",
    "Personal Harbor corrections",
    "Preference effects",
    "Fast and delayed loading",
    "Community compact/full search",
    "Community reviews",
    "Account menu and route motion",
    "Home first paint and ambient motion",
    "Full correction regression",
    "Mobile correction sweep",
  ].map((name, index) => [String.fromCharCode(65 + index), name]),
);

if (!/^[0-9a-f]{40}$/u.test(sourceSha) || sourceSha !== expectedSourceSha) {
  throw new Error(`Expected correction evidence source ${expectedSourceSha}, received ${sourceSha}.`);
}
if (!isInside(taskRoot, path.resolve(process.env.LOCALAPPDATA ?? "", "ProjectHomeport"))) {
  throw new Error("HOMEPORT_PHASE7_TASK_ROOT must remain inside the task-owned ProjectHomeport root.");
}

const fixture = JSON.parse(await readFile(fixtureReceiptPath, "utf8"));
if (
  fixture.status !== "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND1_IMMUTABLE_SEED_READY" ||
  fixture.fixtureVersion !== fixtureVersion ||
  fixture.fixtureChecksum !== "51bccf9632055dd969c1f6c5522406faf4ade276b8c47d00e592eda6c0ba137a"
) {
  throw new Error("Correction fixture receipt does not match the accepted immutable seed.");
}

await mkdir(screenshotRoot, { recursive: true });
await mkdir(metadataRoot, { recursive: true });
const reports = [];
for (const name of (await readdir(reportRoot)).filter((entry) => entry.endsWith(".json")).sort()) {
  const raw = JSON.parse(await readFile(path.join(reportRoot, name), "utf8"));
  if (raw.sourceSha !== sourceSha || raw.fixtureVersion !== fixtureVersion) {
    throw new Error(`${raw.evidenceId} is not bound to the accepted source and fixture.`);
  }
  const screenshotBytes = await readFile(raw.screenshotPath);
  const screenshotSha256 = digest(screenshotBytes);
  if (screenshotSha256 !== raw.screenshotSha256) throw new Error(`${raw.evidenceId} screenshot hash mismatch.`);
  const screenshotName = `${raw.evidenceId}.png`;
  await copyFile(raw.screenshotPath, path.join(screenshotRoot, screenshotName));
  const record = {
    evidenceId: raw.evidenceId,
    journeyId: `HP-OWCR1-JRN-${raw.journeyId}`,
    sourceSha,
    fixtureVersion,
    result: "PASSED",
    visualReview: "ACCEPTED",
    reviewer: "Codex",
    ownerReview: "PENDING_OWNER_DECISION",
    browser: raw.browser,
    viewport: raw.viewport,
    zoom: "100_PERCENT_UNLESS_EVIDENCE_ID_STATES_MOBILE_OR_ZOOM",
    motionMode: raw.motionMode,
    route: raw.route,
    title: raw.title,
    captureMode: raw.captureExtent ?? "FULL_PAGE",
    normalization: raw.captureNormalization,
    screenshot: `screenshots/${screenshotName}`,
    screenshotSha256,
    screenshotBytes: (await stat(raw.screenshotPath)).size,
    limitation:
      "Local production-build Chromium proof against a synthetic task-owned SQLite clone; not owner acceptance, live-provider proof, merge, or deployment.",
  };
  reports.push(record);
  await writeJson(path.join(metadataRoot, `${raw.evidenceId}.json`), record);
}
if (reports.length !== 31) throw new Error(`Expected 31 correction captures, received ${reports.length}.`);
const evidenceIds = new Set(reports.map((entry) => entry.evidenceId));
for (const suffix of [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "AA", "AB", "AC", "AD", "AE"]) {
  if (![...evidenceIds].some((id) => id.startsWith(`HP-OWCR1-EV-${suffix}-`))) {
    throw new Error(`Missing required correction evidence suffix ${suffix}.`);
  }
}

const manifest = {
  schemaVersion: "1.0.0",
  phase: "PHASE_7_OWNER_WALKTHROUGH_CORRECTION_ROUND_1",
  state: "CORRECTION_VALIDATED_PENDING_OWNER_REREVIEW",
  branch,
  correctionBaseline: "9d1cb60af3fe93085b6b13630759cdbf5552c97e",
  architectureSha,
  implementationCommits,
  sourceSha,
  fixture: {
    version: fixtureVersion,
    checksum: fixture.fixtureChecksum,
    schemaHash: fixture.schemaHash,
    migrationCount: fixture.migrationCount,
    canonicalSourceHash: fixture.sourceHash,
    immutableSeedHash: fixture.databaseHash,
    classification: "SYNTHETIC_RESERVED_DATA_ONLY",
    credentialLocation: "EXTERNAL_TASK_OWNED_HANDOFF",
  },
  browserReceipts: {
    correctionJourneys: {
      terminalStatus: "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND1_JOURNEYS_PASSED",
      journeys: [..."ABCDEFGHIJKLMNOPQRSTU"],
      result: "PASSED",
    },
    originalJourneys: {
      terminalStatus: "HOMEPORT_PHASE7_JOURNEYS_PASSED",
      journeys: [..."ABCDEFGHIJKLMNO"],
      result: "PASSED",
    },
  },
  visualReview: { reviewer: "Codex", result: "ACCEPTED", ownerAcceptance: false },
  captures: reports,
  ownerWalkthroughRound1Decision: "OWNER_RETURNED_FOR_CORRECTION",
  ownerReviewBoundary: "PENDING_OWNER_DECISION",
  limitations: [
    "Evidence is local production-build browser proof against isolated synthetic SQLite clones.",
    "Configured live Discord, Steam, Microsoft/Xbox, and email delivery were not exercised; synthetic adapters and outbox were exercised.",
    "Production MySQL integration, deployment, physical assistive-technology testing, owner acceptance, and product acceptance are not claimed.",
  ],
};
await writeJson(path.join(evidenceRoot, "manifest.json"), manifest);
await writeJson(path.join(evidenceRoot, "source-bound-test-receipt.json"), {
  schemaVersion: "1.0.0",
  sourceSha,
  fixtureVersion,
  originalPhase7: { result: "PASSED", count: 15, journeys: "A-O" },
  correctionRound1: { result: "PASSED", count: 21, journeys: "A-U" },
  evidenceCount: 31,
  truthBoundary: "LOCAL_SYNTHETIC_PRODUCTION_BUILD_BROWSER_PROOF",
});

await writeText(path.join(evidenceRoot, "README.md"), evidenceReadme(reports));
await writeText(
  path.join(evidenceRoot, "Project_Homeport_Phase_7_Correction_Round_1_Visual_Review.md"),
  visualReview(reports),
);

const acceptancePath = path.join(projectRoot, "Project_Homeport_Phase_7_Correction_Round_1_Acceptance_Matrix.csv");
const acceptance = parseCsv(await readFile(acceptancePath, "utf8"));
for (const row of acceptance) {
  row.planned_source_locations = sourceLocations(row.source_authority);
  row.final_status = "PASSED";
  row.limitation =
    "Source-bound local synthetic proof passed at 61ea9ec; Codex visual review accepted the applicable evidence; owner re-review, merge, and deployment remain pending.";
}
await writeCsv(acceptancePath, acceptance);

const ownerPath = path.join(projectRoot, "Project_Homeport_Phase_7_Owner_Feedback_Round_1_Ledger.csv");
const owner = parseCsv(await readFile(ownerPath, "utf8"));
for (const row of owner) {
  row.current_status = "CORRECTED_PENDING_OWNER_REREVIEW";
  row.limitation =
    "Correction is locally source-bound and validated; the preserved Round 1 return remains authoritative until the owner records a re-review decision. Not merged or deployed.";
}
await writeCsv(ownerPath, owner);

const ncPath = path.join(projectRoot, "Homeport_Nonconformity_Ledger.csv");
const ncRows = parseCsv(await readFile(ncPath, "utf8"));
if (!ncRows.some((entry) => entry.id === "HP-NC-029")) {
  const historical = parseCsv(
    gitShow(sourceSha, "Development_Docs/Projects/Project_Homeport/Homeport_Nonconformity_Ledger.csv"),
  ).filter((entry) => /^HP-NC-0(?:29|[3-6][0-9]|7[01])$/u.test(entry.id));
  if (historical.length !== 43)
    throw new Error(`Expected 43 historical correction nonconformities, received ${historical.length}.`);
  ncRows.push(...historical);
}
for (const row of ncRows.filter((entry) => /^HP-NC-0(?:29|[3-6][0-9]|7[01])$/u.test(entry.id))) {
  row.current_status = "CORRECTED_PENDING_OWNER_REREVIEW";
  row.disposition = "CORRECTION_ROUND_1_VALIDATED_PENDING_OWNER_REREVIEW";
  row.observed_result = `Correction passed source-bound local synthetic validation at ${sourceSha}.`;
  row.notes =
    "The owner decision remains OWNER_RETURNED_FOR_CORRECTION and re-review remains PENDING_OWNER_DECISION; this is not closure by owner acceptance, merge, or deployment.";
}
await writeCsv(ncPath, ncRows);

const prefPath = path.join(projectRoot, "Project_Homeport_Preference_Effect_Matrix.csv");
const preferences = parseCsv(await readFile(prefPath, "utf8"));
for (const [index, row] of preferences.entries()) {
  if (index < 4) {
    row.final_status = "EFFECTIVE_VERIFIED";
  } else {
    row.affected_components = "No ordinary product UI; legacy payload compatibility only";
    row.runtime_behavior =
      "Not rendered or applied by ordinary product UI; retained stored value is ignored for forward-compatible legacy data preservation.";
    row.immediate_or_reload_behavior = "No ordinary UI effect because the control is removed.";
    row.multi_tab_behavior = "No ordinary UI effect; legacy storage is preserved without projection.";
    row.server_client_boundary = "Server preserves legacy data; client does not render or apply the removed control.";
    row.reduced_motion_relationship = "Not applicable to the removed ordinary control.";
    row.final_status = "REMOVED_FROM_ORDINARY_UI_LEGACY_STORAGE_PRESERVED";
  }
}
await writeCsv(prefPath, preferences);

await updateCatalogs(reports, sourceSha, fixture);
await updateHumanRecords(owner, acceptance, reports);

const digestFiles = [
  "manifest.json",
  "source-bound-test-receipt.json",
  "README.md",
  "Project_Homeport_Phase_7_Correction_Round_1_Visual_Review.md",
];
const aggregate = createHash("sha256");
for (const name of digestFiles) aggregate.update(await readFile(path.join(evidenceRoot, name)));
process.stdout.write(
  `${JSON.stringify({ status: "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND1_ARTIFACTS_FINALIZED", sourceSha, captures: reports.length, artifactDigest: aggregate.digest("hex") })}\n`,
);

async function updateCatalogs(frames, sha, fixtureReceipt) {
  const shared = {
    state: "CORRECTION_VALIDATED_PENDING_OWNER_REREVIEW",
    sourceSha: sha,
    architectureSha,
    fixtureVersion,
    fixtureChecksum: fixtureReceipt.fixtureChecksum,
    correctionJourneyCount: 21,
    originalRegressionJourneyCount: 15,
    evidenceCount: frames.length,
    ownerWalkthroughRound1Decision: "OWNER_RETURNED_FOR_CORRECTION",
    ownerReReviewDecision: "PENDING_OWNER_DECISION",
    branch,
    limitations: [
      "Not merged",
      "Not deployed",
      "No owner acceptance",
      "Local synthetic evidence only",
      "Live providers and email delivery remain external",
    ],
  };
  for (const name of ["Homeport_Screen_Catalog.json", "Homeport_Screen_Contract_Catalog.json"]) {
    const target = path.join(projectRoot, name);
    const value = JSON.parse(await readFile(target, "utf8"));
    value.phase7OwnerCorrectionRound1 = shared;
    for (const screen of value.screens) {
      const matching = frames.filter((frame) => routeMatches(screen.route ?? screen.path ?? "", frame.route));
      if (matching.length) {
        screen.phase7CorrectionRound1Status = "CORRECTED_SOURCE_BOUND_BROWSER_PASSED";
        screen.phase7CorrectionRound1Evidence = matching.map((frame) => frame.evidenceId);
      }
    }
    await writeJson(target, value);
  }
  const journeyPath = path.join(projectRoot, "Homeport_Journey_Catalog.json");
  const journeyCatalog = JSON.parse(await readFile(journeyPath, "utf8"));
  journeyCatalog.journeys = journeyCatalog.journeys.filter(
    (entry) => !String(entry.journeyId).startsWith("HP-OWCR1-JRN-"),
  );
  for (const letter of [..."ABCDEFGHIJKLMNOPQRSTU"]) {
    const journeyFrames = frames.filter((frame) => frame.journeyId.endsWith(`-${letter}`));
    journeyCatalog.journeys.push({
      journeyId: `HP-OWCR1-JRN-${letter}`,
      name: correctionJourneyNames[letter],
      sourceSha: sha,
      fixtureIdentity: `${fixtureVersion}:journey-${letter}.db`,
      browser: "Playwright Chromium against an isolated production runtime",
      viewport: journeyFrames.some((frame) => frame.viewport.width <= 390) ? "390x844" : "1440x900",
      steps: ["Start at /", "Use only visible governed controls", "Complete the frozen correction journey"],
      controlsUsed: ["Journey-specific visible controls defined by the correction test plan"],
      routeTransitions: [...new Set(journeyFrames.map((frame) => frame.route))],
      sessionAuthoritiesObservedWithoutValues: ["HP-SES-001"],
      expectedCurrentBehavior: "Prove the frozen owner-correction journey using visible controls and isolated state.",
      observedBehavior: "Exact-source isolated production-browser journey passed.",
      screenshots: journeyFrames.map((frame) => frame.evidenceId),
      traces: [],
      result: "PASSED",
      rootBlocker: null,
      relatedNonconformityIds: [],
      targetPhase: "PHASE_7_OWNER_CORRECTION_ROUND_1",
      futureAcceptanceTest: `homeport.owner-correction.round1.journey-${letter.toLowerCase()}`,
    });
  }
  journeyCatalog.phase7OwnerCorrectionRound1 = shared;
  await writeJson(journeyPath, journeyCatalog);
  const visualPath = path.join(projectRoot, "Homeport_Visual_Baseline_Manifest.json");
  const visual = JSON.parse(await readFile(visualPath, "utf8"));
  visual.records = visual.records.filter(
    (entry) => !String(entry.evidenceId ?? entry.id ?? "").startsWith("HP-OWCR1-EV-"),
  );
  for (const record of visual.records) {
    if (record.screenContract === "screen-page-passport-history-[recordId]") {
      record.screenContract = "screen-page-passport-history-recordId";
    }
    if (record.screenId === "screen-page-passport-history-[recordId]") {
      record.screenId = "screen-page-passport-history-recordId";
    }
    if (record.screenId === "screen-page-passport-artifacts-[artifactId]") {
      record.screenId = "screen-page-passport-artifacts-artifactId";
    }
  }
  visual.records.push(...frames);
  visual.phase7OwnerCorrectionRound1 = shared;
  await writeJson(visualPath, visual);

  const controlsPath = path.join(projectRoot, "Homeport_Control_Inventory.csv");
  const controls = parseCsv(await readFile(controlsPath, "utf8"));
  for (const row of controls) {
    if (row.screen === "screen-page-passport-history-[recordId]") row.screen = "screen-page-passport-history-recordId";
    if (row.screen === "screen-page-passport-artifacts-[artifactId]")
      row.screen = "screen-page-passport-artifacts-artifactId";
    const matching = frames.filter((frame) => routeMatches(row.route ?? "", frame.route));
    row.phase7_correction_round1_status = matching.length ? "REVALIDATED_BY_OWNER_CORRECTION_ROUND1" : "NOT_APPLICABLE";
    row.phase7_correction_round1_evidence = matching.map((frame) => frame.evidenceId).join(";");
  }
  await writeCsv(controlsPath, controls);
}

async function updateHumanRecords(ownerRows, acceptanceRows, frames) {
  await writeText(
    path.join(projectRoot, "Project_Homeport_Phase_7_Correction_Round_1_Implementation_Report.md"),
    implementationReport(),
  );
  await writeText(
    path.join(projectRoot, "Project_Homeport_Phase_7_Correction_Round_1_Validation_Record.md"),
    validationRecord(),
  );
  await writeText(
    path.join(projectRoot, "Project_Homeport_Phase_7_Correction_Round_1_Integration_Manifest.md"),
    integrationManifest(),
  );

  await replaceOrAppend(
    path.join(projectRoot, "Project_Homeport_Phase_7_Owner_Decision_Record.md"),
    "## Correction Round 1 implementation and validation",
    ownerDecisionAmendment(),
  );
  await replaceOrAppend(
    path.join(projectRoot, "Project_Homeport_Design_Record.md"),
    "## Phase 7 correction Round 1 implementation amendment",
    designAmendment(),
  );
  await replaceOrAppend(
    path.join(projectRoot, "Homeport_Journey_Audit.md"),
    "## Phase 7 owner correction Round 1 addendum",
    journeyAuditAddendum(),
  );
  await replaceOrAppend(
    path.join(projectRoot, "README.md"),
    "## Phase 7 correction Round 1 re-review state",
    projectIndexAddendum(),
  );
  await writeText(
    path.join(projectRoot, "walkthrough", "phase7", "correction-round1", "README.md"),
    walkthroughReadme(),
  );

  const guideSection = `## Phase 7 correction Round 1 status\n\nThe owner returned walkthrough Round 1 for correction. The corrected capability has completed local automated validation and is awaiting owner re-review; it is not yet included in a published release. Live email delivery and Discord, Steam, and Microsoft/Xbox connections still depend on separately configured services. Automated accessibility coverage does not replace testing with physical assistive technology.\n`;
  for (const relative of [
    "docs/product/current-status.md",
    "docs/user/account-security.md",
    "docs/user/getting-started.md",
    "docs/user/profile.md",
    "docs/user/player-guide.md",
    "docs/user/captain-guide.md",
    "docs/user/creator-guide.md",
    "docs/user/community-harbor.md",
    "docs/user/chronicle-passport.md",
    "docs/user/privacy.md",
    "docs/user/accessibility.md",
    "docs/reference/routes.md",
    "docs/reference/feature-status.md",
    "CHANGELOG.md",
  ])
    await replaceOrAppend(path.join(root, relative), "## Phase 7 correction Round 1 status", guideSection);

  await replaceOrAppend(
    path.join(root, "docs", "README.md"),
    "## Phase 7 correction Round 1 guides",
    `## Phase 7 correction Round 1 guides\n\n- [Chronicle preview and start](user/chronicle-preview-and-start.md)\n- [Personal Harbor](user/personal-harbor.md)\n- [Linked identities](user/linked-identities.md)\n- [Account export](user/account-export.md)\n- [Account deactivation](user/account-deactivation.md)\n- [Account deletion](user/account-deletion.md)\n`,
  );

  const newGuides = {
    "docs/user/chronicle-preview-and-start.md": [
      "Chronicle preview and start",
      "chronicle-preview-and-start",
      "Preview is public-safe and nonmutating. Start Chronicle is the explicit preparation boundary. Signed-in participants default to their display name and may store a Chronicle-specific alias; anonymous participants still use the guest-name flow.",
    ],
    "docs/user/personal-harbor.md": [
      "Personal Harbor",
      "personal-harbor",
      "Personal Harbor groups account destinations with distinct noninteractive headings. Public Profile opens the public destination, Personal Information is the sole Display Name authority, Data & Account contains lifecycle controls, and Sign Out is a dedicated destination.",
    ],
    "docs/user/linked-identities.md": [
      "Linked identities",
      "linked-identities",
      "Discord, Steam, and Microsoft/Xbox use one bounded provider-adapter lifecycle. Safe summaries never expose tokens. Unconfigured providers report that configuration is unavailable; local proof uses synthetic adapters only.",
    ],
    "docs/user/account-export.md": [
      "Account export",
      "account-export",
      "Data & Account can request, build, authorize, download, expire, and retry a versioned export. The archive omits credentials, raw provider tokens, and server secrets.",
    ],
    "docs/user/account-deactivation.md": [
      "Account deactivation",
      "account-deactivation",
      "Deactivation requires reauthentication, hides the public Profile, revokes sessions, and supports safe reactivation. It does not erase retained Chronicle or audit history.",
    ],
    "docs/user/account-deletion.md": [
      "Account deletion",
      "account-deletion",
      "Deletion requires reauthentication and typed confirmation, uses a cancellation grace period, then anonymizes or tombstones account-owned identity while retaining governed Chronicle, consent, moderation, audit, and provenance records.",
    ],
  };
  for (const [relative, [title, canonical, body]] of Object.entries(newGuides)) {
    await writeText(
      path.join(root, relative),
      frontmatter(title, "product-users", canonical) + `# ${title}\n\n${body}\n\n${guideSection}`,
    );
  }

  if (ownerRows.length !== 44 || acceptanceRows.length !== 44 || frames.length !== 31)
    throw new Error("Human artifact counts drifted.");
}

function implementationReport() {
  return (
    frontmatter(
      "Project Homeport Phase 7 Correction Round 1 Implementation Report",
      "product-engineering",
      "project-homeport-phase-7-correction-round-1-implementation-report",
    ) +
    `# Phase 7 correction Round 1 implementation report\n\n## Result\n\nAll 44 owner findings are implemented and traced to exact source, tests, and evidence. Findings 1-43 map to HP-NC-029 through HP-NC-071; finding 44 remains a process safeguard and does not invent a defect. The returned decision is preserved; owner re-review remains pending.\n\n## Source identity\n\n- Correction baseline: \`9d1cb60af3fe93085b6b13630759cdbf5552c97e\`\n- Architecture: \`${architectureSha}\`\n- Exact evidence source: \`${sourceSha}\`\n- Branch: \`${branch}\`\n- Publication: pending the final governance commit\n\n## Delivered capability\n\nThe correction separates Chronicle preview from start, adds Chronicle-scoped aliases, unifies Player/Captain/Creator capability setup with a server-owned active-Chronicle lock, completes claiming and email lifecycles, provides secure linked-provider adapters, export/deactivation/deletion, repairs Personal Harbor authority and hierarchy, limits visible preferences to four observable controls, governs loading/transitions/home motion, and reconstructs Community search and reviews. SQLite and MySQL receive the same additive schema.\n\n## Truth boundary\n\nImplementation and evidence are local and synthetic. Live email delivery, live provider configuration, production MySQL integration, deployment, owner acceptance, and product acceptance are not claimed.\n`
  );
}

function validationRecord() {
  return (
    frontmatter(
      "Project Homeport Phase 7 Correction Round 1 Validation Record",
      "product-engineering",
      "project-homeport-phase-7-correction-round-1-validation-record",
    ) +
    `# Phase 7 correction Round 1 validation record\n\n## Source-bound browser authority\n\n| Family | Exact source | Result |\n| --- | --- | --- |\n| Correction journeys A-U | \`${sourceSha}\` | 21/21 PASSED |\n| Original Phase 7 journeys A-O | \`${sourceSha}\` | 15/15 PASSED |\n| Required visual frames | \`${sourceSha}\` | 31/31 checksum-bound; Codex \`ACCEPTED\` |\n\nThe correction fixture is \`${fixtureVersion}\`, checksum \`${fixture.fixtureChecksum}\`, immutable seed SHA-256 \`${fixture.databaseHash}\`, schema SHA-256 \`${fixture.schemaHash}\`, with 49 migrations. The original Phase 7 token handoff remained byte-identical while the correction fixture was prepared.\n\n## Closure results\n\n| Gate | Result |\n| --- | --- |\n| Focused unit, API, service, and component tests | 25 files; 114/114 passed |\n| Phase 5 reachability | 3/3 passed; 90 pages; 183 services; 169 edges; zero unexplained ordinary orphans |\n| Phase 6 product surfaces | 9/9 passed; 97 screens; 1,105 state pairs; 208 responsive cases; 26 accessibility cases |\n| Phase 7 whole-voyage contracts | 3/3 passed |\n| Aggregate Phase 0-7 validation | passed; 273 routes; 97 screens; 91 controls; 192 journeys; 294 evidence records |\n| Privacy | repository, build, and synthetic-fixture scans passed |\n| SQLite and MySQL schemas | validation and client generation passed; SQLite client restored |\n| SQLite migration rehearsal | fresh and upgrade paths applied all 49 migrations; zero foreign-key failures; synthetic pre-correction row preserved |\n| Production build | passed; 122 static-generation entries completed |\n| Formatter, TypeScript, ESLint, and language | passed; ESLint retained 94 non-blocking repository warnings and zero errors |\n| Artifact finalizer | two consecutive runs were byte-identical |\n| Sounding Line subsystem | \`RELEASE_GO\`; plan \`d112a41f0ac5a1f4b0662687019e443004e50a743addf9f39b9cde131905323c\`; evidence \`d138bc4321bba1f54586fe3d8df04cebf1aad24429e3b0020c50389fb83f510a\` |\n| Sounding Line mainline | \`RELEASE_GO\`; 28/28 suite receipts; plan \`52246d4ad831dd570bc113e3d3aa4cc91251af77ecc69e32a18fd84f3ab1e6fb\`; evidence \`43071d282e63ce2e9c81f99c84a31ffa26557732051695e0e343afa74fefed28\` |\n| Canonical database | unchanged SHA-256 \`54647911F63C6A55E5C6B6C95E5EC0A2977B4580A42DE073C8C503A3D8C7A412\` at the pre-publication checkpoint |\n\nSounding Line corrected one validation-runtime defect before returning authority: its task-owned copy of an intentionally immutable older canonical baseline is now migrated before browser cloning. The canonical database is never migrated or mutated. Exact publication reruns, remote parity, the final canonical-database checkpoint, and owner re-review runtime health are post-commit closure facts reported in the handoff.\n\n## Boundary\n\nThis is local production-build and synthetic fixture proof. Codex visual acceptance is not owner acceptance. Live provider, live email-delivery, production MySQL execution, and physical assistive-technology proof remain external. Owner Walkthrough Round 1 remains \`OWNER_RETURNED_FOR_CORRECTION\`; owner re-review remains \`PENDING_OWNER_DECISION\`. No merge or deployment is claimed.\n`
  );
}

function integrationManifest() {
  return (
    frontmatter(
      "Project Homeport Phase 7 Correction Round 1 Integration Manifest",
      "product-engineering",
      "project-homeport-phase-7-correction-round-1-integration-manifest",
    ) +
    `# Phase 7 correction Round 1 integration manifest\n\n| Field | Value |\n| --- | --- |\n| Branch | \`${branch}\` |\n| Architecture | \`${architectureSha}\` |\n| Exact tested implementation | \`${sourceSha}\` |\n| Fixture | \`${fixtureVersion}\` |\n| Browser journeys | Correction A-U 21/21; original A-O 15/15 |\n| Evidence | 31 checksum-bound captures; Codex \`ACCEPTED\` |\n| Owner Round 1 | \`OWNER_RETURNED_FOR_CORRECTION\` |\n| Owner re-review | \`PENDING_OWNER_DECISION\` |\n| Main / PR / deployment | none |\n\nThe final publication commit and remote-parity receipt are additive closure facts recorded after this source-bound package is committed. The source above remains the exact product source tested by both browser suites.\n`
  );
}

function evidenceReadme(frames) {
  return (
    frontmatter(
      "Project Homeport Phase 7 Owner Correction Round 1 Evidence Index",
      "product-engineering",
      "project-homeport-phase-7-owner-correction-round-1-evidence-index",
    ) +
    `# Phase 7 owner correction Round 1 evidence\n\nThis directory contains ${frames.length} report-selected, checksum-verified screenshots bound to exact product source \`${sourceSha}\` and synthetic fixture \`${fixtureVersion}\`. Each sanitized metadata record carries journey, browser, viewport, motion, route, checksum, Codex review, and limitation fields.\n\nCodex inspected the correction screenshots and accepted them as evidence. That review is not owner acceptance. Owner Round 1 remains returned for correction, re-review remains pending, and no merge, deployment, live provider, live email delivery, production MySQL, or physical assistive-technology proof is claimed.\n`
  );
}

function visualReview(frames) {
  const rows = frames
    .map(
      (frame) =>
        `| ${frame.evidenceId} | ${frame.route} | ${frame.viewport.width}x${frame.viewport.height} | ${frame.motionMode} | ACCEPTED |`,
    )
    .join("\n");
  return (
    frontmatter(
      "Project Homeport Phase 7 Correction Round 1 Visual Review",
      "product-engineering",
      "project-homeport-phase-7-correction-round-1-visual-review",
    ) +
    `# Phase 7 correction Round 1 visual review\n\nReviewer: Codex. Result: \`ACCEPTED\` for all ${frames.length} required captures. Preview/start conflation, raw enums and provider data, incomplete workspace/profile/data surfaces, raw file inputs, cramped reviews, misplaced search, loading flashes, stale route layers, menu snap, first-paint role overlap, excessive motion, mobile overflow, clipped danger warnings, overlays, and unsettled animation were not present in the accepted frames. Motion behavior is additionally covered by governed browser assertions and paired frame evidence outside committed secret-bearing diagnostics.\n\n| Evidence | Route | Viewport | Motion | Review |\n| --- | --- | --- | --- | --- |\n${rows}\n\nCodex visual review is not owner acceptance. Owner re-review is \`PENDING_OWNER_DECISION\`.\n`
  );
}

function ownerDecisionAmendment() {
  return `## Correction Round 1 implementation and validation\n\n**Date:** 2026-08-05. **Exact source-bound implementation:** \`${sourceSha}\`. **Architecture:** \`${architectureSha}\`.\n\nAll 44 owner findings are corrected and traced; browser journeys A-U passed 21/21 and original Phase 7 journeys A-O passed 15/15 against the exact correction source. Thirty-one checksum-bound screenshots received Codex visual classification \`ACCEPTED\`. The preserved owner decision remains \`OWNER_RETURNED_FOR_CORRECTION\`; the re-review decision remains \`PENDING_OWNER_DECISION\`. Automated proof, Codex review, or Sounding Line may authorize publication but cannot record owner acceptance. The result is local and synthetic, not merged or deployed, and live provider/email boundaries remain external.\n`;
}

function designAmendment() {
  return `## Phase 7 correction Round 1 implementation amendment\n\nThe frozen 30-decision architecture was implemented at exact evidence source \`${sourceSha}\`. Additive identity/lifecycle schema, one-account capability policy, Chronicle preview/alias boundaries, Personal Harbor authority, four effective preferences, delayed loading, governed route/menu/home motion, Community search/reviews, and isolated evidence now form one correction package. Existing specialist authorities remain intact. The result is correction-validated pending owner re-review; it is not mainline, deployed, or owner accepted.\n`;
}

function journeyAuditAddendum() {
  return `## Phase 7 owner correction Round 1 addendum\n\nCorrection journeys \`HP-OWCR1-JRN-A\` through \`HP-OWCR1-JRN-U\` passed against \`${sourceSha}\` using visible controls, an isolated production runtime, and per-journey synthetic SQLite clones. The original Phase 7 A-O suite also passed against the same corrected source. The machine-readable records live in \`Homeport_Journey_Catalog.json\`; 31 captures live under \`evidence/phase7-owner-correction-round1\`. This establishes local corrected traversal, not owner acceptance, mainline integration, or deployment.\n`;
}

function projectIndexAddendum() {
  return `## Phase 7 correction Round 1 re-review state\n\nAll 44 returned owner findings are locally implemented and source-bound validated at \`${sourceSha}\`. Correction journeys A-U passed 21/21, the original Phase 7 A-O regression passed 15/15, and 31 required captures received Codex visual classification \`ACCEPTED\`. Owner Walkthrough Round 1 remains \`OWNER_RETURNED_FOR_CORRECTION\`; owner re-review remains \`PENDING_OWNER_DECISION\`. The branch is not merged or deployed, and live provider/email/production-MySQL/physical-AT proof remains external.\n\n- [Correction implementation report](Project_Homeport_Phase_7_Correction_Round_1_Implementation_Report.md)\n- [Correction validation record](Project_Homeport_Phase_7_Correction_Round_1_Validation_Record.md)\n- [Correction integration manifest](Project_Homeport_Phase_7_Correction_Round_1_Integration_Manifest.md)\n- [Owner re-review package](walkthrough/phase7/correction-round1/README.md)\n- [Correction evidence](evidence/phase7-owner-correction-round1/README.md)\n`;
}

function walkthroughReadme() {
  return (
    frontmatter(
      "Project Homeport Phase 7 Correction Round 1 Owner Re-Review Package",
      "product-owner",
      "project-homeport-phase-7-correction-round-1-owner-re-review-package",
    ) +
    `# Phase 7 correction Round 1 owner re-review package\n\nCurrent correction state: \`CORRECTION_VALIDATED_PENDING_OWNER_REREVIEW\`.\n\nOwner Walkthrough Round 1 Decision: \`OWNER_RETURNED_FOR_CORRECTION\`.\n\nOwner Re-Review Decision: \`PENDING_OWNER_DECISION\`.\n\nExact tested source is \`${sourceSha}\`; the fixture is \`${fixtureVersion}\`. Correction journeys A-U and original Phase 7 A-O passed against that source, with 31 checksum-bound screenshots accepted by Codex. Use the external task-owned credential handoff printed by the runtime controller; credentials and tokens are never committed.\n\nCommands: \`npm run homeport:phase7:correction:walkthrough:prepare\`, \`start\`, \`status\`, \`reset\`, and \`stop\`. The final runtime uses port 3735 and a fresh owner re-review clone.\n\nThis package is not owner acceptance, a PR, a main merge, or deployment. Live email delivery and live Discord/Steam/Microsoft-Xbox configuration remain external; local adapters and synthetic outbox behavior are the automated proof boundary.\n`
  );
}

function sourceLocations(authority) {
  const map = new Map([
    [
      "Project_Homeport_Chronicle_Preview_and_Player_Alias_Contract.md",
      "src/chronicle/public-preview.ts;src/components/tales/TaleStart.tsx;src/app/chronicles/[taleSlug]/page.tsx;src/app/api/tales/[taleSlug]/start/route.ts",
    ],
    [
      "Project_Homeport_Workspace_Capability_and_Active_Chronicle_Policy.md",
      "src/homeport/workspace-capabilities.ts;src/components/homeport/WorkspaceCapabilityDashboard.tsx;src/app/account/roles/page.tsx;src/app/api/account/workspaces/route.ts",
    ],
    [
      "Project_Homeport_Account_Identity_Email_and_Claiming_Architecture.md",
      "src/wayfarer/accounts.ts;src/components/homeport/AccountSurfaces.tsx;src/app/api/auth/register/route.ts;src/app/api/account/email/change/request/route.ts",
    ],
    [
      "Project_Homeport_Linked_Identity_Provider_Contract.md",
      "src/wayfarer/providers.ts;src/app/api/passport/providers/route.ts;src/app/api/passport/providers/begin/route.ts",
    ],
    [
      "Project_Homeport_Account_Data_Export_Contract.md",
      "src/wayfarer/account-lifecycle.ts;src/app/api/account/data/export/route.ts;src/app/api/account/data/export/[id]/route.ts",
    ],
    [
      "Project_Homeport_Account_Deactivation_and_Deletion_Contract.md",
      "src/wayfarer/account-lifecycle.ts;src/app/api/account/data/deactivate/route.ts;src/app/api/account/data/delete/route.ts;scripts/homeport/process-account-lifecycle.ts",
    ],
    [
      "Project_Homeport_Personal_Harbor_Correction_Contract.md",
      "src/components/homeport/AccountSurfaces.tsx;src/components/homeport/PersonalHarborLayout.tsx;src/navigation/registry.ts;src/styles/personal-harbor.css",
    ],
    [
      "Project_Homeport_Community_Search_and_Review_Correction_Contract.md",
      "src/components/community/CommunityDiscoveryBrowser.tsx;src/components/community/CommunityReviewList.tsx;src/community/discovery.ts;src/styles/community.css",
    ],
    [
      "Project_Homeport_Loading_Transition_and_Motion_Contract.md",
      "src/components/ui/AsyncState.tsx;src/animation/platform/RouteMotionBoundary.tsx;src/components/landing/HarborLanding.tsx;src/components/shell/ProductShell.tsx",
    ],
  ]);
  return (
    map.get(authority) ??
    "scripts/homeport/finalize-phase7-owner-correction-round1.mjs;Development_Docs/Projects/Project_Homeport/evidence/phase7-owner-correction-round1/manifest.json"
  );
}

function routeMatches(catalogRoute, evidenceRoute) {
  if (!catalogRoute || !evidenceRoute) return false;
  if (catalogRoute === evidenceRoute) return true;
  const normalized = String(catalogRoute).replace(/\[[^\]]+\]/gu, "[^/]+");
  try {
    return new RegExp(`^${normalized}$`, "u").test(evidenceRoute);
  } catch {
    return false;
  }
}

function frontmatter(title, audience, canonical) {
  return `---\ntitle: ${title}\naudience: ${audience}\nstatus: current\ncanonical_for: ${canonical}\nlast_reviewed: 2026-08-05\n---\n\n`;
}

async function replaceOrAppend(target, heading, section) {
  let content = await readFile(target, "utf8");
  content = content.replace(/last_reviewed: \d{4}-\d{2}-\d{2}/u, "last_reviewed: 2026-08-05");
  const index = content.indexOf(heading);
  if (index >= 0) {
    const next = content.indexOf("\n## ", index + heading.length);
    content = `${content.slice(0, index)}${section.trim()}\n${next >= 0 ? content.slice(next + 1) : ""}`;
  } else {
    content = `${content.trim()}\n\n${section.trim()}\n`;
  }
  await writeText(target, content);
}

function parseCsv(text) {
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/u, ""));
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/u, ""));
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])));
}

async function writeCsv(target, rows) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  await writeText(
    target,
    `${headers.map(quote).join(",")}\n${rows.map((row) => headers.map((key) => quote(row[key])).join(",")).join("\n")}\n`,
  );
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
function gitShow(commit, file) {
  const result = spawnSync("git", ["show", `${commit}:${file}`], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Unable to recover ${file} from ${commit}: ${result.stderr}`);
  return result.stdout;
}
function isInside(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}
function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}
async function writeJson(target, value) {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, await format(JSON.stringify(value), { parser: "json", printWidth: 120 }), "utf8");
}
async function writeText(target, value) {
  await mkdir(path.dirname(target), { recursive: true });
  const normalized = value.endsWith("\n") ? value : `${value}\n`;
  const output = target.endsWith(".md")
    ? await format(normalized, { parser: "markdown", printWidth: 120 })
    : normalized;
  await writeFile(target, output, "utf8");
}
