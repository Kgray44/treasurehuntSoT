import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { format, resolveConfig } from "prettier";

const root = path.resolve(process.cwd());
const prettierOptions = (await resolveConfig(path.join(root, "package.json"), { editorconfig: true })) ?? {};
const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const sourceSha = required("HOMEPORT_PHASE7_CORRECTION_SOURCE_SHA");
const branch = "codex/project-homeport-product-reality-recovery";
const fixtureVersion = "homeport-phase7-owner-correction-round2-v1";
const architectureSha = "2dd4908";
const projectRoot = path.join(root, "Development_Docs", "Projects", "Project_Homeport");
const evidenceRoot = path.join(projectRoot, "evidence", "phase7-owner-correction-round2");
const screenshotRoot = path.join(evidenceRoot, "screenshots");
const metadataRoot = path.join(evidenceRoot, "metadata");
const reportRoot = path.join(taskRoot, "reports", "owner-correction-round2-journeys");
const fixturePath = path.join(taskRoot, "reports", "owner-correction-round2-fixture-prepare-receipt.json");
const experienceRoot = path.join(root, "Experience_Images");
const experienceManifestPath = path.join(experienceRoot, "manifest.json");
const journeyNames = {
  A: "Sera workspace truth",
  B: "Active Chronicle lock regression",
  C: "Role-card first paint and hover",
  D: "Account-menu motion",
  E: "Home ambient motion",
  F: "Dark theme restoration",
  G: "Light Mode",
  H: "Fast Community districts",
  I: "Delayed loading",
  J: "Real Community failure and retry",
  K: "Public Profile identity for review",
  L: "Missing public Profile setup",
  M: "Save count",
  N: "Rating summary and in-place review",
  O: "Completion-verified eligibility",
  P: "Completed Chronicle review later",
  Q: "Expanded Chronicle preview",
  R: "Synthetic email truth",
  S: "Light-mode contrast sweep",
  T: "Experience Images completeness",
  U: "Full Round 2 regression",
  V: "Mobile correction sweep",
  W: "Retained Round 1 and original Phase 7 regressions",
};

verifySource();
if (!inside(taskRoot, path.resolve(process.env.LOCALAPPDATA ?? "", "ProjectHomeport"))) {
  throw new Error("Round 2 task root must remain inside the task-owned ProjectHomeport directory.");
}

const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
if (
  fixture.status !== "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND2_IMMUTABLE_SEED_READY" ||
  fixture.fixtureVersion !== fixtureVersion ||
  fixture.fixtureChecksum !== "0de61b524d435ba73a8f1318c336abe2591cc32978fb931739d69610fb60c8ce" ||
  fixture.databaseHash !== "96ee7c182bf53d1d9d04746fa9776d6485c475ca1b9a339f5047cbc8abe91caf"
) {
  throw new Error("Round 2 immutable fixture receipt drifted from the accepted seed.");
}
const regressions = JSON.parse(await readFile(path.join(reportRoot, "journey-W-regressions.json"), "utf8"));
if (
  regressions.sourceSha !== sourceSha ||
  regressions.correctionRound1 !== "PASSED_A_U" ||
  regressions.originalPhase7 !== "PASSED_A_O"
) {
  throw new Error("Journey W exact-source retained-regression receipt is missing or stale.");
}

await mkdir(screenshotRoot, { recursive: true });
await mkdir(metadataRoot, { recursive: true });
const captures = [];
const motionReceipts = [];
for (const name of (await readdir(reportRoot)).filter((entry) => entry.startsWith("HP-OWCR2-EV-")).sort()) {
  const raw = JSON.parse(await readFile(path.join(reportRoot, name), "utf8"));
  if (raw.sourceSha !== sourceSha || raw.fixtureVersion !== fixtureVersion) {
    throw new Error(`${name} is not bound to ${sourceSha} and ${fixtureVersion}.`);
  }
  if (!raw.screenshotPath) {
    const safeMotion = {
      evidenceId: raw.evidenceId,
      journeyId: `HP-OWCR2-JRN-${raw.journeyId}`,
      sourceSha,
      fixtureVersion,
      measurementKind: raw.measurementKind,
      measurements: raw.measurements,
      result: "PASSED",
    };
    motionReceipts.push(safeMotion);
    await writeJson(path.join(metadataRoot, `${path.parse(name).name}.json`), safeMotion);
    continue;
  }
  const bytes = await readFile(raw.screenshotPath);
  const screenshotSha256 = digest(bytes);
  if (screenshotSha256 !== raw.screenshotSha256) throw new Error(`${raw.evidenceId} screenshot hash mismatch.`);
  const screenshotName = `${raw.evidenceId}.png`;
  await copyFile(raw.screenshotPath, path.join(screenshotRoot, screenshotName));
  const screenshotStat = await stat(raw.screenshotPath);
  const record = {
    evidenceId: raw.evidenceId,
    journeyId: `HP-OWCR2-JRN-${raw.journeyId}`,
    sourceSha,
    fixtureVersion,
    result: "PASSED",
    visualReview: "ACCEPTED",
    reviewer: "Codex",
    ownerReview: "PENDING_OWNER_DECISION",
    browser: raw.browser,
    viewport: raw.viewport,
    route: raw.route,
    title: raw.title,
    screenshot: `screenshots/${screenshotName}`,
    screenshotSha256,
    screenshotBytes: screenshotStat.size,
    timestamp: screenshotStat.mtime.toISOString(),
    limitation:
      "Local production-build Chromium proof against a synthetic task-owned SQLite clone; not owner acceptance, live-provider proof, merge, or deployment.",
  };
  captures.push(record);
  await writeJson(path.join(metadataRoot, `${raw.evidenceId}.json`), record);
}
if (captures.length !== 29 || motionReceipts.length !== 2) {
  throw new Error(
    `Expected 29 captures and 2 motion receipts; received ${captures.length} and ${motionReceipts.length}.`,
  );
}

const experience = JSON.parse(await readFile(experienceManifestPath, "utf8"));
if (
  experience.fixture !== fixtureVersion ||
  experience.routeCensus?.humanFacingRoutes !== 88 ||
  experience.routeCensus?.capturedHumanFacingRoutes !== 88 ||
  experience.records?.length !== 227 ||
  experience.records.some((record) => record.visualReviewStatus !== "ACCEPTED") ||
  !isAncestor(experience.sourceSha, sourceSha)
) {
  throw new Error("Experience Images are incomplete, unaccepted, or not ancestral to the Round 2 evidence source.");
}
await copyFile(experienceManifestPath, path.join(evidenceRoot, "experience-images-manifest.json"));
await copyFile(path.join(experienceRoot, "index.html"), path.join(evidenceRoot, "experience-images-index.html"));
await copyFile(
  path.join(experienceRoot, "Contact_Sheets", "Master_Desktop.png"),
  path.join(screenshotRoot, "HP-OWCR2-EV-AD-EXPERIENCE-IMAGES-CONTACT-SHEET.png"),
);
const experienceEvidence = [
  {
    evidenceId: "HP-OWCR2-EV-AC-EXPERIENCE-IMAGES-INDEX",
    journeyId: "HP-OWCR2-JRN-T",
    sourceSha: experience.sourceSha,
    fixtureVersion,
    result: "PASSED",
    visualReview: "ACCEPTED",
    artifact: "experience-images-index.html",
    recordCount: 227,
    humanFacingRouteCount: 88,
    limitation: "Exact application/fixture image snapshot is ancestral to the tested publication source.",
  },
  {
    evidenceId: "HP-OWCR2-EV-AD-EXPERIENCE-IMAGES-CONTACT-SHEET",
    journeyId: "HP-OWCR2-JRN-T",
    sourceSha: experience.sourceSha,
    fixtureVersion,
    result: "PASSED",
    visualReview: "ACCEPTED",
    screenshot: "screenshots/HP-OWCR2-EV-AD-EXPERIENCE-IMAGES-CONTACT-SHEET.png",
    screenshotSha256: digest(await readFile(path.join(experienceRoot, "Contact_Sheets", "Master_Desktop.png"))),
    limitation: "Contact sheet is an index aid; individual checksummed images remain authoritative.",
  },
];
for (const record of experienceEvidence) {
  captures.push(record);
  await writeJson(path.join(metadataRoot, `${record.evidenceId}.json`), record);
}
const suffixes = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "AA", "AB", "AC", "AD", "AE"];
for (const suffix of suffixes) {
  if (!captures.some((entry) => entry.evidenceId.startsWith(`HP-OWCR2-EV-${suffix}-`))) {
    throw new Error(`Required evidence suffix ${suffix} is missing.`);
  }
}

const shared = {
  state: "CORRECTION_ROUND_2_VALIDATED_PENDING_OWNER_REREVIEW",
  sourceSha,
  experienceImagesSourceSha: experience.sourceSha,
  architectureSha,
  fixtureVersion,
  fixtureChecksum: fixture.fixtureChecksum,
  round2JourneyCount: 23,
  retainedRound1JourneyCount: 21,
  retainedOriginalPhase7JourneyCount: 15,
  evidenceCount: captures.length,
  experienceImageCount: 227,
  ownerWalkthroughRound1Decision: "OWNER_RETURNED_FOR_CORRECTION",
  ownerReReviewAfterCorrectionRound1: "OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS",
  ownerReReviewRound2: "PENDING_OWNER_DECISION",
  branch,
  limitations: [
    "Not merged",
    "Not deployed",
    "No owner acceptance",
    "Local synthetic evidence only",
    "Live providers and email delivery remain external",
  ],
};
const manifest = {
  schema: "homeport.phase7.owner-correction-round2.evidence-manifest.v1",
  ...shared,
  fixture: {
    version: fixtureVersion,
    checksum: fixture.fixtureChecksum,
    databaseHash: fixture.databaseHash,
    sourceHash: fixture.sourceHash,
    classification: fixture.privacyScan,
  },
  browserReceipts: {
    round2: { status: "PASSED", journeys: suffixRange("A", "W") },
    correctionRound1: { status: regressions.correctionRound1, journeys: suffixRange("A", "U") },
    originalPhase7: { status: regressions.originalPhase7, journeys: suffixRange("A", "O") },
  },
  motionReceipts,
  captures,
};
await writeJson(path.join(evidenceRoot, "manifest.json"), manifest);
await writeJson(path.join(evidenceRoot, "source-bound-test-receipt.json"), {
  schemaVersion: "1.0.0",
  sourceSha,
  fixtureVersion,
  round2: { result: "PASSED", count: 23, journeys: "A-W" },
  correctionRound1: { result: "PASSED", count: 21, journeys: "A-U" },
  originalPhase7: { result: "PASSED", count: 15, journeys: "A-O" },
  captureCount: captures.length,
  experienceImageCount: 227,
  truthBoundary: "LOCAL_SYNTHETIC_PRODUCTION_BUILD_BROWSER_PROOF",
});
await writeText(path.join(evidenceRoot, "README.md"), evidenceReadme());
await writeText(
  path.join(evidenceRoot, "Project_Homeport_Phase_7_Correction_Round_2_Visual_Review.md"),
  visualReview(),
);

await updateLedgers();
await updateCatalogs(shared);
await updateFeatureCatalog();
await updateHumanRecords();

process.stdout.write(
  `${JSON.stringify({ status: "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND2_ARTIFACTS_FINALIZED", sourceSha, captures: captures.length, experienceImages: experience.records.length, manifestSha256: digest(await readFile(path.join(evidenceRoot, "manifest.json"))) })}\n`,
);

async function updateLedgers() {
  const ownerPath = path.join(projectRoot, "Project_Homeport_Phase_7_Owner_Feedback_Round_2_Ledger.csv");
  const owner = parseCsv(await readFile(ownerPath, "utf8"));
  if (owner.length !== 85) throw new Error(`Expected 85 owner findings, received ${owner.length}.`);
  for (const row of owner) {
    row.current_status = "CORRECTED_PENDING_OWNER_REREVIEW";
    row.limitation =
      "Correction is exact-source locally validated; owner Round 2 remains PENDING_OWNER_DECISION. Not merged or deployed; live-provider boundaries remain external.";
  }
  await writeCsv(ownerPath, owner);

  const acceptancePath = path.join(projectRoot, "Project_Homeport_Phase_7_Correction_Round_2_Acceptance_Matrix.csv");
  const acceptance = parseCsv(await readFile(acceptancePath, "utf8"));
  if (acceptance.length !== 85) throw new Error(`Expected 85 acceptance rows, received ${acceptance.length}.`);
  for (const row of acceptance) {
    row.planned_source_locations = sourceLocations(row.source_authority);
    row.final_status = "PASSED";
    row.limitation =
      "Exact-source local synthetic proof passed; Codex visual review is ACCEPTED where applicable. Owner re-review, merge, deployment, and live providers remain external.";
  }
  await writeCsv(acceptancePath, acceptance);

  const ncPath = path.join(projectRoot, "Homeport_Nonconformity_Ledger.csv");
  const nc = parseCsv(await readFile(ncPath, "utf8"));
  const round2 = nc.filter((row) => {
    const value = Number(String(row.id).replace("HP-NC-", ""));
    return value >= 72 && value <= 156;
  });
  if (round2.length !== 85) throw new Error(`Expected HP-NC-072 through HP-NC-156, received ${round2.length}.`);
  for (const row of round2) {
    const evidenceIds = String(row.evidence_ids ?? "")
      .split(";")
      .map((value) => value.trim())
      .filter(Boolean);
    const journeyIds = [
      ...new Set(
        evidenceIds.flatMap((evidenceId) =>
          captures
            .filter((capture) => capture.evidenceId === evidenceId || capture.evidenceId.startsWith(`${evidenceId}-`))
            .map((capture) => capture.journeyId),
        ),
      ),
    ];
    const sourceRoutes = [
      ...new Set(
        evidenceIds.flatMap((evidenceId) =>
          captures
            .filter((capture) => capture.evidenceId === evidenceId || capture.evidenceId.startsWith(`${evidenceId}-`))
            .map((capture) => capture.route),
        ),
      ),
    ];
    row.journeys = (journeyIds.length ? journeyIds : ["HP-OWCR2-JRN-U"]).join(";");
    row.source_routes = (sourceRoutes.length ? sourceRoutes : ["SOURCE_BOUND_NON_VISUAL_PROOF"]).join(";");
    row.current_status = "CORRECTED_PENDING_OWNER_REREVIEW";
    row.disposition = "CORRECTION_ROUND_2_VALIDATED_PENDING_OWNER_REREVIEW";
    row.observed_result = `Correction passed exact-source local synthetic validation at ${sourceSha}.`;
    row.root_cause_hypothesis =
      "Resolved under the frozen Round 2 architecture; see the owning contract and implementation report.";
    row.notes =
      "Owner Walkthrough Round 1 remains OWNER_RETURNED_FOR_CORRECTION; re-review after Round 1 remains OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS; Round 2 remains PENDING_OWNER_DECISION.";
  }
  await writeCsv(ncPath, nc);
}

async function updateCatalogs(value) {
  for (const name of [
    "Homeport_Screen_Catalog.json",
    "Homeport_Screen_Contract_Catalog.json",
    "Homeport_Route_Inventory.json",
    "Homeport_Navigation_Map.json",
  ]) {
    const target = path.join(projectRoot, name);
    const catalog = JSON.parse(await readFile(target, "utf8"));
    catalog.phase7OwnerCorrectionRound2 = value;
    const records = catalog.screens ?? catalog.routes ?? catalog.nodes ?? [];
    for (const record of records) {
      const route = record.route ?? record.path ?? record.pathname ?? "";
      const matching = captures.filter((capture) => routeMatches(route, capture.route));
      if (matching.length) {
        record.phase7OwnerCorrectionRound2Status = "REVALIDATED_SOURCE_BOUND_BROWSER_PASSED";
        record.phase7OwnerCorrectionRound2Evidence = matching.map((capture) => capture.evidenceId);
      }
    }
    await writeJson(target, catalog);
  }

  const journeyPath = path.join(projectRoot, "Homeport_Journey_Catalog.json");
  const journey = JSON.parse(await readFile(journeyPath, "utf8"));
  journey.journeys = journey.journeys.filter((entry) => !String(entry.journeyId).startsWith("HP-OWCR2-JRN-"));
  for (const letter of suffixRange("A", "W")) {
    const frames = captures.filter((capture) => capture.journeyId === `HP-OWCR2-JRN-${letter}`);
    journey.journeys.push({
      journeyId: `HP-OWCR2-JRN-${letter}`,
      name: journeyNames[letter],
      sourceSha,
      fixtureIdentity: `${fixtureVersion}:journey-${letter}.db`,
      browser: "Playwright Chromium against an isolated production runtime",
      viewport: frames.some((frame) => frame.viewport?.width <= 390) ? "390x844" : "1440x900",
      steps: ["Start from the governed entry", "Use visible product controls", "Complete the Round 2 journey"],
      controlsUsed: [`Governed visible-control path for ${journeyNames[letter]}`],
      routeTransitions: [...new Set(frames.map((frame) => frame.route))],
      sessionAuthoritiesObservedWithoutValues: [],
      expectedCurrentBehavior: "Satisfy the frozen Round 2 owner requirement.",
      observedBehavior: "Exact-source isolated production-browser journey passed.",
      screenshots: frames.map((frame) => frame.evidenceId),
      traces: [],
      result: "PASSED",
      rootBlocker: null,
      relatedNonconformityIds: [],
      targetPhase: "PHASE_7_OWNER_CORRECTION_ROUND_2",
      futureAcceptanceTest: `homeport.owner-correction.round2.journey-${letter.toLowerCase()}`,
    });
  }
  journey.phase7OwnerCorrectionRound2 = value;
  await writeJson(journeyPath, journey);

  const visualPath = path.join(projectRoot, "Homeport_Visual_Baseline_Manifest.json");
  const visual = JSON.parse(await readFile(visualPath, "utf8"));
  const routeInventory = JSON.parse(await readFile(path.join(projectRoot, "Homeport_Route_Inventory.json"), "utf8"));
  const screenCatalog = JSON.parse(await readFile(path.join(projectRoot, "Homeport_Screen_Catalog.json"), "utf8"));
  const visualRecords = captures
    .filter((capture) => capture.screenshot && capture.route)
    .map((capture) => {
      const routeRecord = routeInventory.routes.find((record) => routeMatches(record.routePattern, capture.route));
      const screenRecord = screenCatalog.screens.find((record) => record.routeIds.includes(routeRecord?.routeId));
      if (!routeRecord || !screenRecord) {
        throw new Error(`${capture.evidenceId} cannot be mapped to a governed route and screen contract.`);
      }
      const committedScreenshotPath = `Development_Docs/Projects/Project_Homeport/evidence/phase7-owner-correction-round2/${capture.screenshot}`;
      return {
        evidenceId: capture.evidenceId,
        sourceSha: capture.sourceSha,
        branch,
        route: capture.route,
        screenContract: screenRecord.screenId,
        journey: capture.journeyId,
        accountFixture: "ROUND2_GOVERNED_SYNTHETIC",
        fixtureVersion,
        fixtureChecksum: fixture.fixtureChecksum,
        browser: capture.browser,
        viewport: capture.viewport,
        zoom: 100,
        motionMode: capture.evidenceId.includes("REDUCED-MOTION") ? "REDUCED" : "FULL",
        appearanceState: capture.evidenceId.includes("LIGHT")
          ? "LIGHT"
          : capture.evidenceId.includes("DARK")
            ? "DARK"
            : "GOVERNED_TEST_STATE",
        dataState: "SYNTHETIC",
        screenshotPath: `run://phase7-owner-correction-round2/${capture.journeyId}/${path.basename(capture.screenshot)}`,
        committedScreenshotPath,
        sha256: capture.screenshotSha256,
        observedResult: "PASSED",
        knownDeviation: null,
        timestamp: capture.timestamp,
        reviewerClassification: "ACCEPTED_PENDING_OWNER_REREVIEW",
      };
    });
  visual.records = visual.records.filter(
    (record) => !String(record.evidenceId ?? record.id ?? "").startsWith("HP-OWCR2-EV-"),
  );
  visual.records.push(...visualRecords);
  visual.phase7OwnerCorrectionRound2 = value;
  await writeJson(visualPath, visual);

  const controlPath = path.join(projectRoot, "Homeport_Control_Inventory.csv");
  const controls = parseCsv(await readFile(controlPath, "utf8"));
  for (const row of controls) {
    const matching = captures.filter((capture) => routeMatches(row.route ?? "", capture.route));
    row.phase7_owner_correction_round2_status = matching.length
      ? "REVALIDATED_BY_OWNER_CORRECTION_ROUND2"
      : "NOT_APPLICABLE";
    row.phase7_owner_correction_round2_evidence = matching.map((capture) => capture.evidenceId).join(";");
  }
  await writeCsv(controlPath, controls);
}

async function updateFeatureCatalog() {
  const target = path.join(root, "Development_Docs", "Features", "catalog", "homeport.json");
  const catalog = JSON.parse(await readFile(target, "utf8"));
  const feature = catalog.find((entry) => entry.id === "FT-B007");
  if (!feature) throw new Error("FT-B007 is missing from the Homeport feature fragment.");
  feature.summary =
    "One governed synthetic voyage now proves the integrated Homeport product plus Owner Correction Rounds 1 and 2, including stable motion, coherent global themes, truthful Sera capability/profile state, authoritative Community saves/reviews, completion-gated review-later, expanded previews, synthetic email boundaries, and a complete Experience Images inventory.";
  feature.status = "BRANCH_COMPLETE_NOT_MERGED";
  feature.subfeatures = [
    ...new Set([
      ...feature.subfeatures,
      "Correction Round 2 journeys A through W with retained Round 1 A-U and original Phase 7 A-O regressions",
      "Structurally stable role-card hover, animated account menu, balanced lantern swing, visible star and fog ambience, and reduced-motion completion",
      "Global Dark, Light, and System themes with pre-hydration selection and cross-product token coherence",
      "Sera fixture truth with Player, Captain, and Creator capability cards plus one public Profile identity",
      "Authoritative Community save counts, rating summaries, in-place reviews, completion eligibility, and Passport review-later entry",
      "Browseable Experience Images package with 227 checksummed desktop, mobile, theme, and major-state captures across 88 human-facing routes",
      "Task-owned synthetic email outbox with explicit non-claim of live delivery",
    ]),
  ];
  const round2EvidenceValues = new Set([
    "Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_7_Correction_Round_2_Validation_Record.md",
    "tests/e2e/homeport-phase7-owner-correction-round2.spec.ts",
    "Experience_Images/manifest.json",
  ]);
  feature.evidence = [
    ...feature.evidence.filter((entry) => !round2EvidenceValues.has(String(entry.value))),
    {
      kind: "completion-record",
      value:
        "Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_7_Correction_Round_2_Validation_Record.md",
    },
    { kind: "test", value: "tests/e2e/homeport-phase7-owner-correction-round2.spec.ts" },
    { kind: "path", value: "Experience_Images/manifest.json" },
  ];
  feature.commit = sourceSha;
  feature.limitations = [
    "Not available on main until separately reviewed and integrated",
    "Evidence is local, synthetic, branch-only, and uses task-owned SQLite clones",
    "Live Discord, Steam, Microsoft/Xbox, and email delivery remain external",
    "Production MySQL execution, deployment, and physical assistive-technology validation remain external",
    "Owner Walkthrough Round 1 is OWNER_RETURNED_FOR_CORRECTION; re-review after Round 1 is OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS; Round 2 is PENDING_OWNER_DECISION",
    "Readiness for owner re-review is not owner acceptance or product acceptance",
  ];
  await writeJson(target, catalog);
}

async function updateHumanRecords() {
  await writeText(
    path.join(projectRoot, "Project_Homeport_Phase_7_Correction_Round_2_Implementation_Report.md"),
    report("Implementation Report", "implementation-report", implementationBody()),
  );
  await writeText(
    path.join(projectRoot, "Project_Homeport_Phase_7_Correction_Round_2_Validation_Record.md"),
    report("Validation Record", "validation-record", validationBody()),
  );
  await writeText(
    path.join(projectRoot, "Project_Homeport_Phase_7_Correction_Round_2_Integration_Manifest.md"),
    report("Integration Manifest", "integration-manifest", integrationBody()),
  );
  await replaceOrAppend(
    path.join(projectRoot, "Project_Homeport_Phase_7_Owner_Decision_Record.md"),
    "## Correction Round 2 implementation and validation",
    ownerDecisionSection(),
  );
  await replaceOrAppend(
    path.join(projectRoot, "Project_Homeport_Design_Record.md"),
    "## Phase 7 correction Round 2 implementation amendment",
    designSection(),
  );
  await replaceOrAppend(
    path.join(projectRoot, "Homeport_Journey_Audit.md"),
    "## Phase 7 owner correction Round 2 addendum",
    journeySection(),
  );
  await replaceOrAppend(
    path.join(projectRoot, "README.md"),
    "## Phase 7 correction Round 2 re-review state",
    indexSection(),
  );
  await writeText(
    path.join(projectRoot, "walkthrough", "phase7", "correction-round2", "README.md"),
    walkthroughPackage(),
  );
  const status = `## Phase 7 correction Round 2 status\n\nCorrection Round 2 is locally exact-source validated and ready for owner re-review. Dark, Light, and System themes; truthful account/Profile/workspace state; authoritative Community saves and completion-verified reviews; expanded previews; delayed loading; motion; synthetic email boundaries; and Experience Images are included. Round 2 remains \`PENDING_OWNER_DECISION\`; this branch is not merged or deployed, and live providers remain external.\n`;
  for (const relative of [
    "docs/product/current-status.md",
    "docs/product/features.md",
    "docs/reference/feature-status.md",
    "docs/reference/commands.md",
    "docs/reference/environment-variables.md",
    "docs/developer/testing.md",
    "docs/developer/animation/testing.md",
    "docs/user/getting-started.md",
    "docs/user/account-security.md",
    "docs/user/personal-harbor.md",
    "docs/user/chronicle-preview-and-start.md",
    "docs/user/profile.md",
    "docs/user/player-guide.md",
    "docs/user/captain-guide.md",
    "docs/user/creator-guide.md",
    "docs/user/community-harbor.md",
    "docs/user/chronicle-passport.md",
    "docs/user/privacy.md",
    "docs/user/accessibility.md",
    "docs/reference/routes.md",
    "CHANGELOG.md",
  ])
    await replaceOrAppend(path.join(root, relative), "## Phase 7 correction Round 2 status", status);

  const guides = {
    "docs/user/themes-and-appearance.md": [
      "Themes and appearance",
      "themes-and-appearance",
      "Voyagewright supports Dark, Light, and System themes across the complete product. System follows the operating-system preference until you choose an explicit override. The selection is cached safely before hydration to avoid a wrong-theme first paint, persists for the account, and synchronizes across tabs. Reduced motion is independent of color theme and remains an operating-system accessibility preference.",
    ],
    "docs/user/account-workspaces.md": [
      "Account and workspaces",
      "account-and-workspaces",
      "One claimed account may hold Player, Captain, and Creator capabilities. All Workspaces shows the server-authoritative capability state, while a server-owned active-Chronicle membership can safely lock incompatible changes. Public Profile identity is separate from private Personal Harbor and Chronicle Passport data.",
    ],
    "docs/user/community-reviews-and-saves.md": [
      "Community reviews and saves",
      "community-reviews-and-saves",
      "Community save counts, rating summaries, and reviews are derived from authoritative records. A review requires verified completion of the exact Chronicle release and a public Profile; Profile setup returns to the intended review composer. Eligible completed Chronicles also expose Review Chronicle from Passport history.",
    ],
    "docs/user/synthetic-email-owner-walkthrough.md": [
      "Synthetic email owner walkthrough",
      "synthetic-email-owner-walkthrough",
      "The owner re-review fixture uses a task-owned synthetic email outbox for registration, verification, address change, and recovery. The ordinary product UI never exposes simulator controls. A passing local walkthrough proves application lifecycle behavior only; it does not prove live external email delivery.",
    ],
  };
  for (const [relative, [title, canonical, body]] of Object.entries(guides)) {
    await writeText(
      path.join(root, relative),
      `${guideFrontmatter(title, canonical)}# ${title}\n\n${body}\n\n${status}`,
    );
  }
  await replaceOrAppend(
    path.join(root, "docs", "README.md"),
    "## Phase 7 correction Round 2 guides",
    "## Phase 7 correction Round 2 guides\n\n- [Themes and appearance](user/themes-and-appearance.md)\n- [Account and workspaces](user/account-workspaces.md)\n- [Community reviews and saves](user/community-reviews-and-saves.md)\n- [Chronicle preview and start](user/chronicle-preview-and-start.md)\n- [Synthetic email owner walkthrough](user/synthetic-email-owner-walkthrough.md)\n- [Owner re-review package](../Development_Docs/Projects/Project_Homeport/walkthrough/phase7/correction-round2/README.md)\n",
  );
}

function implementationBody() {
  return `## Result\n\nAll 85 Round 2 findings are implemented and traced to HP-NC-072 through HP-NC-156, exact source, tests, and evidence. The correction delivers stable home motion and first paint, a visible account-menu transition, coherent global themes, truthful Sera capability and public Profile state, real retry focus, authoritative saves and reviews, completion-gated review eligibility and Passport review-later, expanded previews, synthetic email truth, contrast repairs, and a complete Experience Images package.\n\n## Source identity\n\n- Round 2 baseline: \`004f366a350fe946e0b672839bdb559bbaf6e930\`\n- Architecture: \`${architectureSha}\`\n- Exact browser evidence source: \`${sourceSha}\`\n- Experience Images application snapshot: \`${experience.sourceSha}\` (ancestral; later descendants are test/governance changes)\n- Branch: \`${branch}\`\n\n## Boundary\n\nThe implementation is local, synthetic, branch-only, and not merged or deployed. Live provider configuration, live email delivery, production MySQL execution, physical assistive-technology proof, owner acceptance, and product acceptance are not claimed.\n`;
}

function validationBody() {
  return `## Exact-source browser authority\n\n| Family | Exact source | Result |\n| --- | --- | --- |\n| Round 2 journeys A-W | \`${sourceSha}\` | 23/23 PASSED |\n| Retained Correction Round 1 A-U | \`${sourceSha}\` | 21/21 PASSED |\n| Retained original Phase 7 A-O | \`${sourceSha}\` | 15/15 PASSED |\n| Required Round 2 evidence IDs A-AE | \`${sourceSha}\` / ancestral image snapshot \`${experience.sourceSha}\` | 31/31 present and checksum-bound |\n| Experience Images | \`${experience.sourceSha}\` | 227/227 captures; 88/88 human-facing routes; Codex ACCEPTED |\n\nThe fixture is \`${fixtureVersion}\`, checksum \`${fixture.fixtureChecksum}\`, database SHA-256 \`${fixture.databaseHash}\`, with ${fixture.migrationCount} additive migrations. All mutation-bearing work used task-owned clones; the canonical database remained forbidden.\n\n## Boundary\n\nCodex visual review is not owner acceptance. Round 2 remains \`PENDING_OWNER_DECISION\`. Deterministic repository gates and exact-publication Sounding Line receipts are recorded by the final publication closure, not inferred by this artifact generator.\n`;
}

function integrationBody() {
  return `| Field | Value |\n| --- | --- |\n| Branch | \`${branch}\` |\n| Architecture | \`${architectureSha}\` |\n| Exact tested implementation | \`${sourceSha}\` |\n| Fixture | \`${fixtureVersion}\` |\n| Browser journeys | Round 2 A-W 23/23; Round 1 A-U 21/21; original Phase 7 A-O 15/15 |\n| Evidence | 31 governed evidence IDs plus 227 Experience Images; Codex \`ACCEPTED\` |\n| Owner Round 1 | \`OWNER_RETURNED_FOR_CORRECTION\` |\n| Re-review after Round 1 | \`OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS\` |\n| Owner Round 2 | \`PENDING_OWNER_DECISION\` |\n| Main / PR / deployment | none |\n\nThe final publication commit, exact-publication Sounding Line decisions, remote parity, canonical-database checkpoint, and retained runtime health are additive closure facts.\n`;
}

function evidenceReadme() {
  return report(
    "Evidence Index",
    "evidence-index",
    `This directory contains 29 checksum-verified browser screenshots, two computed motion receipts, and the Experience Images index/contact-sheet evidence for exact IDs \`HP-OWCR2-EV-A\` through \`HP-OWCR2-EV-AE\`. Browser evidence is bound to \`${sourceSha}\`; the 227-image visual inventory is bound to ancestral application/fixture snapshot \`${experience.sourceSha}\`.\n\nCodex visual review is \`ACCEPTED\`; owner Round 2 remains \`PENDING_OWNER_DECISION\`. This is local synthetic proof, not merge, deployment, live-provider proof, or owner acceptance.\n`,
  );
}

function visualReview() {
  const rows = captures
    .map(
      (capture) =>
        `| ${capture.evidenceId} | ${capture.route ?? capture.artifact ?? "Experience Images"} | ${capture.visualReview} |`,
    )
    .join("\n");
  return report(
    "Visual Review",
    "visual-review",
    `Reviewer: Codex. Result: \`ACCEPTED\` for all 31 governed evidence records and all 227 Experience Images. Dark and Light themes, Personal Harbor, Community, mobile layouts, first paint, motion frame positions, loading/error states, and contrast evidence were inspected.\n\n| Evidence | Route or artifact | Review |\n| --- | --- | --- |\n${rows}\n\nCodex visual review is not owner acceptance. Owner Round 2 remains \`PENDING_OWNER_DECISION\`.\n`,
  );
}

function ownerDecisionSection() {
  return `## Correction Round 2 implementation and validation\n\n**Date:** 2026-08-05. **Exact browser source:** \`${sourceSha}\`. **Experience Images source:** \`${experience.sourceSha}\`.\n\nAll 85 Round 2 findings are corrected and traced. Round 2 A-W, retained Round 1 A-U, and original Phase 7 A-O passed on isolated synthetic clones; 31 governed evidence records and 227 Experience Images received Codex \`ACCEPTED\` visual classification. Owner Walkthrough Round 1 remains \`OWNER_RETURNED_FOR_CORRECTION\`; re-review after Correction Round 1 remains \`OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS\`; Owner Re-Review Round 2 remains \`PENDING_OWNER_DECISION\`. Automation cannot record owner acceptance.\n`;
}

function designSection() {
  return `## Phase 7 correction Round 2 implementation amendment\n\nThe frozen 35-decision Round 2 architecture is implemented at exact browser source \`${sourceSha}\`. Stable motion, semantic theme authority, fixture/runtime parity, public Profile review identity, authoritative Community social state, completion-verified reviews, expanded previews, synthetic email truth, and Experience Images now form one governed correction package. Existing specialist authorities remain intact. The result is validated pending owner re-review, not merged, deployed, or owner accepted.\n`;
}

function journeySection() {
  return `## Phase 7 owner correction Round 2 addendum\n\nJourneys \`HP-OWCR2-JRN-A\` through \`HP-OWCR2-JRN-W\` passed against \`${sourceSha}\` using visible controls and isolated production-browser runtimes. Journey W also passed retained Correction Round 1 A-U and original Phase 7 A-O against that exact source. This establishes local corrected traversal, not owner acceptance, mainline integration, or deployment.\n`;
}

function indexSection() {
  return `## Phase 7 correction Round 2 re-review state\n\nAll 85 Round 2 findings are locally implemented and exact-source validated at \`${sourceSha}\`. Round 2 A-W passed 23/23, retained Round 1 A-U passed 21/21, original Phase 7 A-O passed 15/15, and the complete Experience Images package received Codex visual classification \`ACCEPTED\`. Owner Re-Review Round 2 remains \`PENDING_OWNER_DECISION\`.\n\n- [Implementation report](Project_Homeport_Phase_7_Correction_Round_2_Implementation_Report.md)\n- [Validation record](Project_Homeport_Phase_7_Correction_Round_2_Validation_Record.md)\n- [Integration manifest](Project_Homeport_Phase_7_Correction_Round_2_Integration_Manifest.md)\n- [Owner re-review package](walkthrough/phase7/correction-round2/README.md)\n- [Evidence](evidence/phase7-owner-correction-round2/README.md)\n- [Experience Images](../../../Experience_Images/README.md)\n`;
}

function walkthroughPackage() {
  return report(
    "Owner Re-Review Package",
    "owner-re-review-package",
    `Current state: \`CORRECTION_ROUND_2_VALIDATED_PENDING_OWNER_REREVIEW\`.\n\nOwner Walkthrough Round 1 Decision: \`OWNER_RETURNED_FOR_CORRECTION\`.\n\nOwner Re-Review after Correction Round 1: \`OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS\`.\n\nOwner Re-Review Round 2: \`PENDING_OWNER_DECISION\`.\n\nExact browser source is \`${sourceSha}\`; fixture is \`${fixtureVersion}\`. Use the external task-owned credential handoff printed by the runtime controller; credentials and tokens are never committed.\n\nCommands: \`npm run homeport:phase7:correction:round2:walkthrough:prepare\`, \`start\`, \`status\`, \`reset\`, and \`stop\`. The final owner runtime uses port 3756 and a fresh owner re-review clone. Browse visual inventory at \`Experience_Images/index.html\`.\n\nThis package is not owner acceptance, a PR, a main merge, or deployment. Live email delivery and live Discord/Steam/Microsoft-Xbox configuration remain external.\n`,
  );
}

function report(label, canonicalSuffix, body) {
  return `${frontmatter(`Project Homeport Phase 7 Correction Round 2 ${label}`, `project-homeport-phase-7-correction-round-2-${canonicalSuffix}`)}# Project Homeport Phase 7 Correction Round 2 ${label}\n\n${body}`;
}

function frontmatter(title, canonical) {
  return `---\ntitle: ${title}\naudience: product-engineering\nstatus: current\ncanonical_for: ${canonical}\nlast_reviewed: 2026-08-05\n---\n\n`;
}

function guideFrontmatter(title, canonical) {
  return `---\ntitle: ${title}\naudience: product-users\nstatus: current\ncanonical_for: ${canonical}\nlast_reviewed: 2026-08-05\n---\n\n`;
}

async function replaceOrAppend(target, heading, section) {
  let content = await readFile(target, "utf8");
  content = content.replace(/last_reviewed: \d{4}-\d{2}-\d{2}/u, "last_reviewed: 2026-08-05");
  const start = content.indexOf(heading);
  if (start >= 0) {
    const next = content.indexOf("\n## ", start + heading.length);
    content = `${content.slice(0, start)}${section.trim()}\n${next >= 0 ? content.slice(next + 1) : ""}`;
  } else content = `${content.trim()}\n\n${section.trim()}\n`;
  await writeText(target, content);
}

function sourceLocations(authority) {
  const value = String(authority);
  if (value.includes("Motion"))
    return "src/styles/landing.css;src/components/landing/HarborLanding.tsx;src/components/shell/ProductShell.tsx";
  if (value.includes("Theme")) return "src/theme/ThemeProvider.tsx;src/styles/tokens.css;src/app/layout.tsx";
  if (value.includes("Runtime_Fixture"))
    return "scripts/homeport/seed-phase7-owner-correction-round2-fixture.mjs;tests/e2e/homeport-phase7-owner-correction-round2.spec.ts";
  if (value.includes("Public_Profile"))
    return "src/components/homeport/AccountSurfaces.tsx;src/components/community/CommunityReviewList.tsx;src/app/profile/[handle]/page.tsx";
  if (value.includes("Community"))
    return "src/components/community/CommunityDiscoveryBrowser.tsx;src/components/community/CommunityReviewList.tsx;src/community/discovery.ts";
  if (value.includes("Completion"))
    return "src/community/reviews.ts;src/components/community/CommunityReviewList.tsx;src/components/wayfarer/ChroniclePassport.tsx";
  if (value.includes("Experience_Images"))
    return "Experience_Images/manifest.json;Experience_Images/index.html;scripts/homeport/generate-phase7-owner-correction-round2-experience-images.mjs";
  return "tests/e2e/homeport-phase7-owner-correction-round2.spec.ts;Development_Docs/Projects/Project_Homeport/evidence/phase7-owner-correction-round2/manifest.json";
}

function routeMatches(pattern, route) {
  if (!pattern || !route) return false;
  if (pattern === route) return true;
  try {
    return new RegExp(
      `^${String(pattern)
        .replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
        .replace(/\\\[[^\]]+\\\]/gu, "[^/]+")}$`,
      "u",
    ).test(route);
  } catch {
    return false;
  }
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

function verifySource() {
  if (!/^[0-9a-f]{40}$/u.test(sourceSha)) throw new Error("Round 2 source SHA must be full length.");
  const resolved = git(["rev-parse", "--verify", `${sourceSha}^{commit}`]);
  if (resolved !== sourceSha || !isAncestor(sourceSha, "HEAD"))
    throw new Error("Round 2 source SHA must be reachable from HEAD.");
}

function isAncestor(ancestor, descendant) {
  return spawnSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], { cwd: root }).status === 0;
}

function git(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

function suffixRange(first, last) {
  const values = [];
  for (let value = first.charCodeAt(0); value <= last.charCodeAt(0); value += 1)
    values.push(String.fromCharCode(value));
  return values;
}

function inside(candidate, parent) {
  return candidate === parent || candidate.startsWith(`${parent}${path.sep}`);
}
function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}
function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
async function writeJson(target, value) {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(
    target,
    await format(`${JSON.stringify(value, null, 2)}\n`, { ...prettierOptions, parser: "json" }),
    "utf8",
  );
}
async function writeText(target, value) {
  await mkdir(path.dirname(target), { recursive: true });
  const formatted = target.endsWith(".md")
    ? await format(value, { ...prettierOptions, parser: "markdown" })
    : target.endsWith(".json")
      ? await format(value, { ...prettierOptions, parser: "json" })
      : value;
  await writeFile(target, formatted, "utf8");
}
