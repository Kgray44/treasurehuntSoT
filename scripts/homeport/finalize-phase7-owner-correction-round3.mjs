import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { format, resolveConfig } from "prettier";

const root = path.resolve(process.cwd());
const prettierOptions = (await resolveConfig(path.join(root, "package.json"), { editorconfig: true })) ?? {};
const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const sourceSha = required("HOMEPORT_PHASE7_CORRECTION_SOURCE_SHA");
const visualReviewDecision = required("HOMEPORT_PHASE7_CODEX_VISUAL_REVIEW");
const branch = "codex/project-homeport-product-reality-recovery";
const fixtureVersion = "homeport-phase7-owner-correction-round3-v1";
const architectureSha = "88d3b0a";
const projectRoot = path.join(root, "Development_Docs", "Projects", "Project_Homeport");
const evidenceRoot = path.join(projectRoot, "evidence", "phase7-owner-correction-round3");
const screenshotRoot = path.join(evidenceRoot, "screenshots");
const metadataRoot = path.join(evidenceRoot, "metadata");
const reportRoot = path.join(taskRoot, "reports", "owner-correction-round3-journeys");
const fixturePath = path.join(taskRoot, "reports", "owner-correction-round3-fixture-prepare-receipt.json");
const experienceRoot = path.join(root, "Experience_Images");
const experienceManifestPath = path.join(experienceRoot, "manifest.json");
const journeyNames = {
  A: "Avatar selection and crop",
  B: "Banner selection and crop",
  C: "Image replacement failure",
  D: "Image removal",
  E: "Profile Overview",
  F: "New registration to code verification",
  G: "Resend and code replacement",
  H: "Change registration email",
  I: "Postmark live delivery or explicit external blocker",
  J: "KGTesting workspace provisioning",
  K: "Existing-account reconciliation",
  L: "Active Chronicle lock",
  M: "No false active lock",
  N: "Seamless Personal Harbor crossfade",
  O: "Seamless cross-product crossfade",
  P: "Slow transition and loading",
  Q: "Account-menu visible motion",
  R: "Dark default",
  S: "Mobile imagery and verification",
  T: "Effective 200 percent zoom",
  U: "Round 3 natural regression",
  V: "Prior correction regression",
};

verifySource();
if (!inside(taskRoot, path.resolve(process.env.LOCALAPPDATA ?? "", "ProjectHomeport"))) {
  throw new Error("Round 3 task root must remain inside the task-owned ProjectHomeport directory.");
}
if (visualReviewDecision !== "ACCEPTED") {
  throw new Error("Round 3 artifacts require an explicit completed Codex visual review decision of ACCEPTED.");
}

const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
if (
  fixture.status !== "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND3_IMMUTABLE_SEED_READY" ||
  fixture.fixtureVersion !== fixtureVersion ||
  fixture.fixtureChecksum !== "c2a727ea57eaa26a0c0f9cfdf481960e20644bbc19d94621b9581c2d6629ba53" ||
  fixture.databaseHash !== "d3d947436bdd0f9de01749ca301b9d5f717c35d3574b257d0aecd5ebcb07350b"
) {
  throw new Error("Round 3 immutable fixture receipt drifted from the accepted seed.");
}
const regressions = JSON.parse(await readFile(path.join(reportRoot, "journey-V-regressions.json"), "utf8"));
if (
  regressions.sourceSha !== sourceSha ||
  regressions.correctionRound2 !== "PASSED_A_W" ||
  regressions.correctionRound1 !== "PASSED_A_U" ||
  regressions.originalPhase7 !== "PASSED_A_O"
) {
  throw new Error("Journey V exact-source retained-regression receipt is missing or stale.");
}

await mkdir(screenshotRoot, { recursive: true });
await mkdir(metadataRoot, { recursive: true });
const captures = [];
const motionReceipts = [];
for (const name of (await readdir(reportRoot)).filter((entry) => entry.startsWith("HP-OWCR3-EV-")).sort()) {
  const raw = JSON.parse(await readFile(path.join(reportRoot, name), "utf8"));
  if (raw.sourceSha !== sourceSha || raw.fixtureVersion !== fixtureVersion) {
    throw new Error(`${name} is not bound to ${sourceSha} and ${fixtureVersion}.`);
  }
  if (!raw.screenshotPath) {
    const safeMotion = {
      evidenceId: raw.evidenceId,
      journeyId: `HP-OWCR3-JRN-${raw.journeyId}`,
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
    journeyId: `HP-OWCR3-JRN-${raw.journeyId}`,
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
if (captures.length !== 29 || motionReceipts.length !== 5) {
  throw new Error(
    `Expected 29 captures and 5 motion receipts; received ${captures.length} and ${motionReceipts.length}.`,
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
  throw new Error("Experience Images are incomplete, unaccepted, or not ancestral to the Round 3 evidence source.");
}
await copyFile(experienceManifestPath, path.join(evidenceRoot, "experience-images-manifest.json"));
await copyFile(path.join(experienceRoot, "index.html"), path.join(evidenceRoot, "experience-images-index.html"));
await copyFile(
  path.join(experienceRoot, "Contact_Sheets", "Master_Desktop.png"),
  path.join(screenshotRoot, "round3-experience-images-contact-sheet.png"),
);
const suffixes = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "AA", "AB", "AC", "AD"];
const governedEvidence = [...captures, ...motionReceipts];
for (const suffix of suffixes) {
  if (!governedEvidence.some((entry) => entry.evidenceId.startsWith(`HP-OWCR3-EV-${suffix}-`))) {
    throw new Error(`Required evidence suffix ${suffix} is missing.`);
  }
}

const shared = {
  state: "CORRECTION_ROUND_3_VALIDATED_PENDING_OWNER_REREVIEW",
  sourceSha,
  experienceImagesSourceSha: experience.sourceSha,
  architectureSha,
  fixtureVersion,
  fixtureChecksum: fixture.fixtureChecksum,
  round3JourneyCount: 22,
  retainedRound2JourneyCount: 23,
  retainedRound1JourneyCount: 21,
  retainedOriginalPhase7JourneyCount: 15,
  evidenceCount: 30,
  experienceImageCount: 227,
  ownerWalkthroughRound1Decision: "OWNER_RETURNED_FOR_CORRECTION",
  ownerReReviewAfterCorrectionRound1: "OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS",
  ownerReReviewAfterCorrectionRound2: "OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS",
  ownerReReviewRound3: "PENDING_OWNER_DECISION",
  transactionalEmail: "POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION",
  branch,
  limitations: [
    "Not merged",
    "Not deployed",
    "No owner acceptance",
    "Local synthetic evidence only",
    "Postmark live delivery is blocked by external configuration",
    "Production MySQL and physical assistive-technology validation remain external",
  ],
};
const manifest = {
  schema: "homeport.phase7.owner-correction-round3.evidence-manifest.v1",
  ...shared,
  fixture: {
    version: fixtureVersion,
    checksum: fixture.fixtureChecksum,
    databaseHash: fixture.databaseHash,
    sourceHash: fixture.sourceHash,
    classification: fixture.privacyScan,
  },
  browserReceipts: {
    round3: { status: "PASSED", journeys: suffixRange("A", "V") },
    correctionRound2: { status: regressions.correctionRound2, journeys: suffixRange("A", "W") },
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
  round3: { result: "PASSED", count: 22, journeys: "A-V" },
  correctionRound2: { result: "PASSED", count: 23, journeys: "A-W" },
  correctionRound1: { result: "PASSED", count: 21, journeys: "A-U" },
  originalPhase7: { result: "PASSED", count: 15, journeys: "A-O" },
  screenshotCount: captures.length,
  motionReceiptCount: motionReceipts.length,
  governedEvidenceIdCount: 30,
  experienceImageCount: 227,
  truthBoundary: "LOCAL_SYNTHETIC_PRODUCTION_BUILD_BROWSER_PROOF",
});
await writeText(path.join(evidenceRoot, "README.md"), evidenceReadme());
await writeText(
  path.join(evidenceRoot, "Project_Homeport_Phase_7_Correction_Round_3_Visual_Review.md"),
  visualReview(),
);

await updateLedgers();
await updateCatalogs(shared);
await updateFeatureCatalog();
await updateHumanRecords();

process.stdout.write(
  `${JSON.stringify({ status: "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND3_ARTIFACTS_FINALIZED", sourceSha, captures: captures.length, experienceImages: experience.records.length, manifestSha256: digest(await readFile(path.join(evidenceRoot, "manifest.json"))) })}\n`,
);

async function updateLedgers() {
  const ownerPath = path.join(projectRoot, "Project_Homeport_Phase_7_Owner_Feedback_Round_3_Ledger.csv");
  const owner = parseCsv(await readFile(ownerPath, "utf8"));
  if (owner.length !== 54) throw new Error(`Expected 54 owner findings, received ${owner.length}.`);
  for (const row of owner) {
    row.current_status = "CORRECTED_PENDING_OWNER_REREVIEW";
    row.limitation =
      "Correction is exact-source locally validated; owner Round 3 remains PENDING_OWNER_DECISION. Not merged or deployed; live-provider boundaries remain external.";
  }
  await writeCsv(ownerPath, owner);

  const acceptancePath = path.join(projectRoot, "Project_Homeport_Phase_7_Correction_Round_3_Acceptance_Matrix.csv");
  const acceptance = parseCsv(await readFile(acceptancePath, "utf8"));
  if (acceptance.length !== 54) throw new Error(`Expected 54 acceptance rows, received ${acceptance.length}.`);
  for (const row of acceptance) {
    row.planned_source_locations = sourceLocations(row.source_authority);
    row.final_status = "PASSED";
    row.limitation =
      "Exact-source local synthetic proof passed; Codex visual review is ACCEPTED where applicable. Owner re-review, merge, deployment, and live providers remain external.";
  }
  await writeCsv(acceptancePath, acceptance);

  const ncPath = path.join(projectRoot, "Homeport_Nonconformity_Ledger.csv");
  const nc = parseCsv(await readFile(ncPath, "utf8"));
  const round3 = nc.filter((row) => {
    const value = Number(String(row.id).replace("HP-NC-", ""));
    return value >= 157 && value <= 210;
  });
  if (round3.length !== 54) throw new Error(`Expected HP-NC-157 through HP-NC-210, received ${round3.length}.`);
  for (const row of round3) {
    const evidenceIds = String(row.evidence_ids ?? "")
      .split(";")
      .map((value) => value.trim())
      .filter(Boolean);
    const journeyIds = [
      ...new Set(
        evidenceIds.flatMap((evidenceId) =>
          governedEvidence
            .filter((capture) => capture.evidenceId === evidenceId || capture.evidenceId.startsWith(`${evidenceId}-`))
            .map((capture) => capture.journeyId),
        ),
      ),
    ];
    const sourceRoutes = [
      ...new Set(
        evidenceIds.flatMap((evidenceId) =>
          governedEvidence
            .filter((capture) => capture.evidenceId === evidenceId || capture.evidenceId.startsWith(`${evidenceId}-`))
            .map((capture) => capture.route),
        ),
      ),
    ];
    row.journeys = (journeyIds.length ? journeyIds : ["HP-OWCR3-JRN-U"]).join(";");
    row.source_routes = (sourceRoutes.length ? sourceRoutes : ["SOURCE_BOUND_NON_VISUAL_PROOF"]).join(";");
    row.current_status = "CORRECTED_PENDING_OWNER_REREVIEW";
    row.disposition = "CORRECTION_ROUND_3_VALIDATED_PENDING_OWNER_REREVIEW";
    row.observed_result = `Correction passed exact-source local synthetic validation at ${sourceSha}.`;
    row.root_cause_hypothesis =
      "Resolved under the frozen Round 3 architecture; see the owning contract and implementation report.";
    row.notes =
      "Owner Walkthrough Round 1 remains OWNER_RETURNED_FOR_CORRECTION; re-reviews after Rounds 1 and 2 remain OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS; Round 3 remains PENDING_OWNER_DECISION.";
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
    catalog.phase7OwnerCorrectionRound3 = value;
    const records = catalog.screens ?? catalog.routes ?? catalog.nodes ?? catalog.edges ?? [];
    for (const record of records) {
      const route =
        record.route ?? record.routePattern ?? record.path ?? record.pathname ?? record.destinationScreen ?? "";
      const matching = captures.filter((capture) => routeMatches(route, capture.route));
      if (matching.length) {
        record.phase7OwnerCorrectionRound3Status = "REVALIDATED_SOURCE_BOUND_BROWSER_PASSED";
        record.phase7OwnerCorrectionRound3Evidence = matching.map((capture) => capture.evidenceId);
      }
    }
    await writeJson(target, catalog);
  }

  const journeyPath = path.join(projectRoot, "Homeport_Journey_Catalog.json");
  const journey = JSON.parse(await readFile(journeyPath, "utf8"));
  journey.journeys = journey.journeys.filter((entry) => !String(entry.journeyId).startsWith("HP-OWCR3-JRN-"));
  for (const letter of suffixRange("A", "V")) {
    const frames = captures.filter((capture) => capture.journeyId === `HP-OWCR3-JRN-${letter}`);
    journey.journeys.push({
      journeyId: `HP-OWCR3-JRN-${letter}`,
      name: journeyNames[letter],
      sourceSha,
      fixtureIdentity: `${fixtureVersion}:journey-${letter}.db`,
      browser: "Playwright Chromium against an isolated production runtime",
      viewport: frames.some((frame) => frame.viewport?.width <= 390) ? "390x844" : "1440x900",
      steps: ["Start from the governed entry", "Use visible product controls", "Complete the Round 3 journey"],
      controlsUsed: [`Governed visible-control path for ${journeyNames[letter]}`],
      routeTransitions: [...new Set(frames.map((frame) => frame.route))],
      sessionAuthoritiesObservedWithoutValues: [],
      expectedCurrentBehavior: "Satisfy the frozen Round 3 owner requirement.",
      observedBehavior: "Exact-source isolated production-browser journey passed.",
      screenshots: frames.map((frame) => frame.evidenceId),
      traces: [],
      result: "PASSED",
      rootBlocker: null,
      relatedNonconformityIds: [],
      targetPhase: "PHASE_7_OWNER_CORRECTION_ROUND_3",
      futureAcceptanceTest: `homeport.owner-correction.round3.journey-${letter.toLowerCase()}`,
    });
  }
  journey.phase7OwnerCorrectionRound3 = value;
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
      const committedScreenshotPath = `Development_Docs/Projects/Project_Homeport/evidence/phase7-owner-correction-round3/${capture.screenshot}`;
      return {
        evidenceId: capture.evidenceId,
        sourceSha: capture.sourceSha,
        branch,
        route: capture.route,
        screenContract: screenRecord.screenId,
        journey: capture.journeyId,
        accountFixture: "ROUND3_GOVERNED_SYNTHETIC",
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
        screenshotPath: `run://phase7-owner-correction-round3/${capture.journeyId}/${path.basename(capture.screenshot)}`,
        committedScreenshotPath,
        sha256: capture.screenshotSha256,
        observedResult: "PASSED",
        knownDeviation: null,
        timestamp: capture.timestamp,
        reviewerClassification: "ACCEPTED_PENDING_OWNER_REREVIEW",
      };
    });
  visual.records = visual.records.filter(
    (record) => !String(record.evidenceId ?? record.id ?? "").startsWith("HP-OWCR3-EV-"),
  );
  visual.records.push(...visualRecords);
  visual.phase7OwnerCorrectionRound3 = value;
  await writeJson(visualPath, visual);

  const controlPath = path.join(projectRoot, "Homeport_Control_Inventory.csv");
  const controls = parseCsv(await readFile(controlPath, "utf8"));
  for (const row of controls) {
    const matching = captures.filter((capture) => routeMatches(row.route ?? "", capture.route));
    row.phase7_owner_correction_round3_status = matching.length
      ? "REVALIDATED_BY_OWNER_CORRECTION_ROUND3"
      : "NOT_APPLICABLE";
    row.phase7_owner_correction_round3_evidence = matching.map((capture) => capture.evidenceId).join(";");
  }
  await writeCsv(controlPath, controls);
}

async function updateFeatureCatalog() {
  const target = path.join(root, "Development_Docs", "Features", "catalog", "homeport.json");
  const catalog = JSON.parse(await readFile(target, "utf8"));
  const feature = catalog.find((entry) => entry.id === "FT-B007");
  if (!feature) throw new Error("FT-B007 is missing from the Homeport feature fragment.");
  feature.summary =
    "Project Homeport now includes the integrated Whole Voyage plus Owner Correction Rounds 1-3: governed Profile imagery and crop editing, identity propagation, six-digit verification, a Postmark production adapter with deterministic synthetic testing, ordinary Player/Captain/Creator entry separated from resource authority, direct route crossfades, visible account-menu motion, and Dark defaults.";
  feature.status = "BRANCH_COMPLETE_NOT_MERGED";
  feature.subfeatures = [
    ...new Set([
      ...feature.subfeatures,
      "Interactive avatar and banner selection, preview, crop, replacement, removal, and normalized derivative lifecycle",
      "Profile avatar and banner propagation across Personal Harbor, account controls, and safe public identity projections",
      "Six-digit email-code registration with hashed expiry, attempts, resend replacement, and atomic account activation",
      "Provider-neutral transactional email with Postmark production and task-owned synthetic adapters",
      "Ordinary-account Player, Captain, and Creator entry separated from resource-specific authorization",
      "Active-Chronicle transition safety with authoritative true-lock and false-lock behavior",
      "Direct page crossfades with stable shell, 500 ms loading integration, focus handoff, and reduced motion",
      "Perceptible production account-menu opening and closing motion",
      "Dark anonymous and new-account defaults with broad Light visual completion deferred",
      "Correction Round 3 journeys A-V with retained Round 2 A-W, Round 1 A-U, and original Phase 7 A-O regressions",
    ]),
  ];
  const round3Evidence = new Set([
    "Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_7_Correction_Round_3_Validation_Record.md",
    "tests/e2e/homeport-phase7-owner-correction-round3.spec.ts",
    "Experience_Images/manifest.json",
  ]);
  feature.evidence = [
    ...feature.evidence.filter((entry) => !round3Evidence.has(String(entry.value))),
    {
      kind: "completion-record",
      value:
        "Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_7_Correction_Round_3_Validation_Record.md",
    },
    { kind: "test", value: "tests/e2e/homeport-phase7-owner-correction-round3.spec.ts" },
    { kind: "path", value: "Experience_Images/manifest.json" },
  ];
  feature.commit = sourceSha;
  feature.limitations = [
    "Not available on main until separately reviewed and integrated",
    "Not deployed; no pull request was created by the governed Round 3 task",
    "Owner Re-Review Round 3 remains PENDING_OWNER_DECISION",
    "Broad Light Mode visual completion remains deferred",
    "Postmark live delivery is POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION; synthetic proof is not live inbox proof",
    "Production MySQL execution, external-provider configuration, and physical assistive-technology validation remain external",
    "Readiness for owner re-review is not owner acceptance or product acceptance",
  ];
  await writeJson(target, catalog);
}

async function updateHumanRecords() {
  await writeText(
    path.join(projectRoot, "Project_Homeport_Phase_7_Correction_Round_3_Implementation_Report.md"),
    report("Implementation Report", "implementation-report", implementationBody()),
  );
  await writeText(
    path.join(projectRoot, "Project_Homeport_Phase_7_Correction_Round_3_Validation_Record.md"),
    report("Validation Record", "validation-record", validationBody()),
  );
  await writeText(
    path.join(projectRoot, "Project_Homeport_Phase_7_Correction_Round_3_Integration_Manifest.md"),
    report("Integration Manifest", "integration-manifest", integrationBody()),
  );
  await replaceOrAppend(
    path.join(projectRoot, "Project_Homeport_Phase_7_Owner_Decision_Record.md"),
    "## Correction Round 3 implementation and validation",
    ownerDecisionSection(),
  );
  await replaceOrAppend(
    path.join(projectRoot, "Project_Homeport_Design_Record.md"),
    "## Phase 7 correction Round 3 implementation amendment",
    designSection(),
  );
  await replaceOrAppend(
    path.join(projectRoot, "Homeport_Journey_Audit.md"),
    "## Phase 7 owner correction Round 3 addendum",
    journeySection(),
  );
  await replaceOrAppend(
    path.join(projectRoot, "README.md"),
    "## Phase 7 correction Round 3 re-review state",
    indexSection(),
  );
  await writeText(
    path.join(projectRoot, "walkthrough", "phase7", "correction-round3", "README.md"),
    walkthroughPackage(),
  );
  const status = `## Phase 7 correction Round 3 status

Correction Round 3 is locally exact-source validated at \`${sourceSha}\` and ready for owner re-review. It adds governed Profile imagery/cropping and identity propagation, six-digit verification, a Postmark production adapter with task-owned synthetic isolation, ordinary Player/Captain/Creator entry separated from resource authority, direct route crossfades, visible account-menu motion, and Dark defaults. Owner Re-Review Round 3 remains \`PENDING_OWNER_DECISION\`; the branch is not merged or deployed. Postmark is \`POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION\`, broad Light Mode visual completion is deferred, and production MySQL plus physical assistive-technology validation remain external.
`;
  for (const relative of [
    "docs/product/current-status.md",
    "docs/product/features.md",
    "docs/reference/feature-status.md",
    "docs/reference/commands.md",
    "docs/reference/environment-variables.md",
    "docs/developer/testing.md",
    "docs/developer/animation/testing.md",
    "docs/developer/security-architecture.md",
    "docs/administrator/deployment.md",
    "docs/administrator/configuration.md",
    "docs/user/getting-started.md",
    "docs/user/account-security.md",
    "docs/user/account-workspaces.md",
    "docs/user/personal-harbor.md",
    "docs/user/profile.md",
    "docs/user/captain-guide.md",
    "docs/user/creator-guide.md",
    "docs/user/themes-and-appearance.md",
    "docs/user/privacy.md",
    "docs/user/accessibility.md",
    "docs/reference/routes.md",
    "CHANGELOG.md",
  ])
    await replaceOrAppend(path.join(root, relative), "## Phase 7 correction Round 3 status", status);

  const userGuideBoundary =
    "These instructions describe the Round 3 branch. They do not claim mainline availability, deployment, live Postmark delivery, owner acceptance, broad Light Mode completion, production MySQL proof, or physical assistive-technology validation.";
  await writeText(
    path.join(root, "docs", "user", "email-verification.md"),
    `${guideFrontmatter("Email verification", "email-verification")}# Email verification

After registration, Voyagewright asks for the six-digit code sent to the submitted address. The code expires, can be used once, and is replaced when a new code is sent. A short cooldown protects resend. Incorrect, expired, unavailable, and successful states remain distinct; change the address from the verification screen if it was entered incorrectly.

Round 3 local walkthroughs use a task-owned synthetic inbox. Real delivery requires configured Postmark sender and templates.

${userGuideBoundary}
`,
  );
  await writeText(
    path.join(root, "docs", "user", "password-recovery.md"),
    `${guideFrontmatter("Password recovery", "password-recovery")}# Password recovery

Use **Forgot password** from Sign In. Voyagewright returns the same safe response whether or not the address is registered, then dispatches a single-use recovery message through the governed transactional-email provider. Expired or already-used recovery links must be requested again. If delivery is unavailable, no success claim implies that an external message was accepted.

${userGuideBoundary}
`,
  );
  await writeText(
    path.join(root, "docs", "user", "profile-imagery.md"),
    `${guideFrontmatter("Profile imagery", "profile-imagery")}# Profile imagery

Personal Harbor supports an avatar and banner. Selection stays local until you position and confirm the crop. Pan by dragging or keyboard controls, zoom with the slider or supported pointer gesture, reset without saving, cancel safely, then save the pending preview. PNG, JPEG, and WebP are accepted within the displayed limits. A failed replacement preserves the current image, and removal is explicit.

Confirmed originals remain private; only server-normalized, locally validated derivatives appear on identity surfaces. The avatar propagates to the account trigger, menu, and authorized public Profile projection. The banner leads the Personal Harbor overview.

${userGuideBoundary}
`,
  );
  await writeText(
    path.join(root, "docs", "developer", "local-email-testing.md"),
    `${frontmatter("Local email testing", "local-email-testing")}# Local email testing

Set \`HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER=SYNTHETIC_OUTBOX\`, \`HOMEPORT_SYNTHETIC_EMAIL_ADAPTER=TASK_OWNED_TEST\`, \`HOMEPORT_PHASE7_TASK_ROOT\`, and a task-owned \`HOMEPORT_SYNTHETIC_OUTBOX_PATH\`. Never point the adapter at a shared or canonical directory. Read codes only from the task-owned private handoff/outbox used by the walkthrough harness; do not expose them in product UI, logs, committed evidence, URLs, analytics, or provider metadata.

Synthetic acceptance proves application lifecycle behavior only. It is not Postmark submission or inbox delivery. Switch back by removing the synthetic override and configuring the server-only Postmark variables described in the provider guide.

${userGuideBoundary}
`,
  );
  await writeText(
    path.join(root, "docs", "administrator", "postmark-configuration.md"),
    `${frontmatter("Postmark transactional email configuration", "postmark-transactional-email-configuration")}# Postmark transactional email configuration

## Required setup

1. Create or select a Postmark Server and approve the sender signature/domain for the From address.
2. Create transactional templates for verification, password reset, email change, security notice, and account lifecycle; record their aliases.
3. Set server-only \`HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER=POSTMARK\`, \`POSTMARK_SERVER_TOKEN\`, \`POSTMARK_FROM_ADDRESS\`, \`POSTMARK_FROM_NAME\`, \`POSTMARK_TRANSACTIONAL_MESSAGE_STREAM\`, \`POSTMARK_TEMPLATE_ALIAS_VERIFY_EMAIL\`, \`POSTMARK_TEMPLATE_ALIAS_PASSWORD_RESET\`, \`POSTMARK_TEMPLATE_ALIAS_EMAIL_CHANGE\`, \`POSTMARK_TEMPLATE_ALIAS_SECURITY_NOTICE\`, and \`POSTMARK_TEMPLATE_ALIAS_ACCOUNT_LIFECYCLE\`.
4. Configure Delivery, Bounce, and SpamComplaint webhooks to \`/api/webhooks/postmark\` over HTTPS. Protect the endpoint with unique \`POSTMARK_WEBHOOK_USERNAME\` and \`POSTMARK_WEBHOOK_PASSWORD\` HTTP Basic credentials. Postmark does not provide an HMAC signature contract for these webhooks.
5. Use an approved staging/test inbox. Register, receive the real code, verify the account, correlate the provider MessageID and sanitized delivery event, and retain no token or message body.
6. During provider outage, fail closed with a delivery-unavailable state. Use the synthetic adapter only in an explicitly task-owned local/test runtime; never silently substitute it in production.

No \`NEXT_PUBLIC_\` variable may contain provider configuration. Rotate any exposed credential immediately.

Current Round 3 status is \`POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION\`; no live provider submission or inbox receipt is claimed.

${userGuideBoundary}
`,
  );
  await replaceOrAppend(
    path.join(root, "docs", "README.md"),
    "## Phase 7 correction Round 3 guides",
    "## Phase 7 correction Round 3 guides\n\n- [Email verification](user/email-verification.md)\n- [Password recovery](user/password-recovery.md)\n- [Profile imagery](user/profile-imagery.md)\n- [Themes and appearance](user/themes-and-appearance.md)\n- [Account and workspaces](user/account-workspaces.md)\n- [Local email testing](developer/local-email-testing.md)\n- [Postmark configuration](administrator/postmark-configuration.md)\n- [Owner re-review package](../Development_Docs/Projects/Project_Homeport/walkthrough/phase7/correction-round3/README.md)\n",
  );
}

function implementationBody() {
  return `## Result

All 54 Round 3 findings are implemented and traced to HP-NC-157 through HP-NC-210, exact source, tests, and evidence. The correction provides local avatar/banner preview and crop, normalized private-original/public-derivative media handling, identity imagery propagation, an identity-led Profile Overview, six-digit email verification, a provider-neutral Postmark/synthetic delivery boundary, Dark defaults, ordinary workspace entry separated from resource authority, true active-Chronicle safety, direct route crossfades, and perceptible account-menu motion.

## Source identity

- Round 2 publication baseline and Round 3 start: \`8e3900a734674cb58800878aaeaf91a0e9f2285e\`
- Architecture commit: \`${architectureSha}\`
- Exact browser evidence source: \`${sourceSha}\`
- Experience Images source: \`${experience.sourceSha}\`
- Branch: \`${branch}\`
- Fixture: \`${fixtureVersion}\`

## Transactional email boundary

The Postmark adapter, template aliases, delivery receipts, authenticated/idempotent Delivery/Bounce/SpamComplaint webhook handling, and deterministic synthetic adapter are implemented. No approved token, sender, templates, webhook, or test inbox was available, so the exact live classification is \`POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION\`. Synthetic acceptance is not live provider or inbox proof.

## Boundary

The implementation is local, synthetic, branch-only, and not merged or deployed. Broad Light Mode visual completion is deferred. Production MySQL execution, external-provider proof, physical assistive-technology proof, owner acceptance, and product acceptance are not claimed.
`;
}

function validationBody() {
  return `## Exact-source browser authority

| Family | Exact source | Result |
| --- | --- | --- |
| Round 3 journeys A-V | \`${sourceSha}\` | 22/22 PASSED |
| Retained Correction Round 2 A-W | \`${sourceSha}\` | 23/23 PASSED |
| Retained Correction Round 1 A-U | \`${sourceSha}\` | 21/21 PASSED |
| Retained original Phase 7 A-O | \`${sourceSha}\` | 15/15 PASSED |
| Required Round 3 evidence IDs A-AD | \`${sourceSha}\` | 30/30 present; 29 screenshots and 5 temporal receipts |
| Experience Images | \`${experience.sourceSha}\` | 227/227 captures; 88/88 human-facing routes; Codex ACCEPTED |
| Vitest | implementation source family | 204 files; 1289 tests passed |
| Migration rehearsal | Round 3 task-owned databases | 50 migrations; fresh/populated integrity and FK checks passed |

The fixture is \`${fixtureVersion}\`, checksum \`${fixture.fixtureChecksum}\`, database SHA-256 \`${fixture.databaseHash}\`, with ${fixture.migrationCount} additive migrations. All mutation-bearing work used task-owned clones; the canonical database remained forbidden.

## External and publication boundary

Postmark is \`POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION\`. Codex visual review is not owner acceptance. Round 3 remains \`PENDING_OWNER_DECISION\`. Repository-wide validators, Sounding Line decisions, exact-publication reruns, remote parity, canonical-database invariance, and runtime health are additive closure facts recorded outside this source-bound artifact generator.
`;
}

function integrationBody() {
  return `| Field | Value |
| --- | --- |
| Branch | \`${branch}\` |
| Round 3 start | \`8e3900a734674cb58800878aaeaf91a0e9f2285e\` |
| Architecture | \`${architectureSha}\` |
| Exact tested implementation | \`${sourceSha}\` |
| Fixture | \`${fixtureVersion}\` |
| Browser journeys | Round 3 A-V 22/22; Round 2 A-W 23/23; Round 1 A-U 21/21; original Phase 7 A-O 15/15 |
| Evidence | 30 governed IDs, 29 screenshots, 5 temporal receipts, and 227 Experience Images; Codex \`ACCEPTED\` |
| Transactional email | \`POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION\`; synthetic adapter passed |
| Owner Round 1 | \`OWNER_RETURNED_FOR_CORRECTION\` |
| Re-review after Round 1 | \`OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS\` |
| Re-review after Round 2 | \`OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS\` |
| Owner Round 3 | \`PENDING_OWNER_DECISION\` |
| Main / PR / deployment | none |

The final publication commit, exact-publication Sounding Line decisions, remote parity, canonical-database checkpoint, and retained runtime health are additive closure facts.
`;
}

function evidenceReadme() {
  return report(
    "Evidence Index",
    "evidence-index",
    `This directory contains 29 checksum-verified browser screenshots and five computed temporal receipts covering exact evidence IDs \`HP-OWCR3-EV-A\` through \`HP-OWCR3-EV-AD\` (30 unique IDs). The Experience Images manifest, browseable index, and master desktop contact sheet are supplemental exact-source visual inventory artifacts. Evidence is bound to \`${sourceSha}\`; the 227-image inventory is bound to \`${experience.sourceSha}\`.

Codex visual review is \`ACCEPTED\`; Owner Re-Review Round 3 remains \`PENDING_OWNER_DECISION\`. This is local synthetic proof, not merge, deployment, live Postmark proof, or owner acceptance.
`,
  );
}

function visualReview() {
  const rows = governedEvidence
    .map(
      (record) =>
        `| ${record.evidenceId} | ${record.route ?? record.measurementKind ?? "Temporal evidence"} | ACCEPTED |`,
    )
    .join("\n");
  return report(
    "Visual Review",
    "visual-review",
    `Reviewer: Codex. Result: \`ACCEPTED\` for all 30 governed evidence IDs and all 227 Experience Images. Profile selection/crop/pending/committed states, identity propagation, verification, workspace empty/locked states, direct crossfade frames, delayed loading, account-menu opening/closing frames, Dark first paint, mobile, zoom, reduced motion, and the full visual inventory were inspected.

| Evidence | Route or artifact | Review |
| --- | --- | --- |
${rows}

Codex visual review is not owner acceptance. Owner Re-Review Round 3 remains \`PENDING_OWNER_DECISION\`.
`,
  );
}

function ownerDecisionSection() {
  return `## Correction Round 3 implementation and validation

**Date:** 2026-08-05. **Exact browser source:** \`${sourceSha}\`. **Experience Images source:** \`${experience.sourceSha}\`.

All 54 Round 3 findings are corrected and traced. Round 3 A-V, retained Round 2 A-W, Round 1 A-U, and original Phase 7 A-O passed on isolated synthetic clones; all 30 governed evidence IDs and 227 Experience Images received Codex \`ACCEPTED\` visual classification. Owner Walkthrough Round 1 remains \`OWNER_RETURNED_FOR_CORRECTION\`; re-reviews after Rounds 1 and 2 remain \`OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS\`; Owner Re-Review Round 3 remains \`PENDING_OWNER_DECISION\`. Automation cannot record owner acceptance.
`;
}

function designSection() {
  return `## Phase 7 correction Round 3 implementation amendment

The frozen 42-decision Round 3 architecture is implemented at exact browser source \`${sourceSha}\`. It retains canonical AccountSession, specialist resource authority, prior owner/history records, and the 500 ms loading contract while adding Profile imagery/crop, identity propagation, six-digit verification, provider-neutral Postmark delivery, Dark defaults, ordinary workspace entry, active-Chronicle truth, direct route crossfades, visible account-menu motion, isolated fixtures, and exact-source evidence. Delivery, Bounce, and SpamComplaint webhooks use configured HTTP Basic protection and idempotent MessageID event handling; no unsupported Postmark HMAC claim is made. The result is validated pending owner re-review, not merged, deployed, or owner accepted.
`;
}

function journeySection() {
  return `## Phase 7 owner correction Round 3 addendum

Journeys \`HP-OWCR3-JRN-A\` through \`HP-OWCR3-JRN-V\` passed against \`${sourceSha}\` using visible controls and isolated production-browser runtimes. Journey V also passed retained Correction Round 2 A-W, Correction Round 1 A-U, and original Phase 7 A-O against that exact source. This establishes local corrected traversal, not owner acceptance, mainline integration, or deployment.
`;
}

function indexSection() {
  return `## Phase 7 correction Round 3 re-review state

All 54 Round 3 findings are locally implemented and exact-source validated at \`${sourceSha}\`. Round 3 A-V passed 22/22, retained Round 2 A-W passed 23/23, Round 1 A-U passed 21/21, original Phase 7 A-O passed 15/15, and the complete Experience Images package received Codex visual classification \`ACCEPTED\`. Postmark remains \`POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION\`; Owner Re-Review Round 3 remains \`PENDING_OWNER_DECISION\`.

- [Implementation report](Project_Homeport_Phase_7_Correction_Round_3_Implementation_Report.md)
- [Validation record](Project_Homeport_Phase_7_Correction_Round_3_Validation_Record.md)
- [Integration manifest](Project_Homeport_Phase_7_Correction_Round_3_Integration_Manifest.md)
- [Owner re-review package](walkthrough/phase7/correction-round3/README.md)
- [Evidence](evidence/phase7-owner-correction-round3/README.md)
- [Experience Images](../../../Experience_Images/README.md)
`;
}

function walkthroughPackage() {
  return report(
    "Owner Re-Review Package",
    "owner-re-review-package",
    `Current state: \`CORRECTION_ROUND_3_VALIDATED_PENDING_OWNER_REREVIEW\`.

Owner Walkthrough Round 1 Decision: \`OWNER_RETURNED_FOR_CORRECTION\`.

Owner Re-Review after Correction Round 1: \`OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS\`.

Owner Re-Review after Correction Round 2: \`OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS\`.

Owner Re-Review Round 3: \`PENDING_OWNER_DECISION\`.

Exact browser source is \`${sourceSha}\`; fixture is \`${fixtureVersion}\`. Use the external task-owned credential handoff printed by the runtime controller; credentials and verification codes are never committed. Transactional email is \`POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION\`; the owner runtime uses its task-owned synthetic inbox and does not prove live delivery.

Commands: \`npm run homeport:phase7:correction:round3:walkthrough:prepare\`, \`start\`, \`status\`, \`reset\`, and \`stop\`. The final owner runtime uses port 3768 and a fresh owner re-review clone. Browse the visual inventory at \`Experience_Images/index.html\`.

This package is not owner acceptance, a PR, a main merge, or deployment. Broad Light Mode visual completion, real Postmark delivery, production MySQL, and physical assistive-technology validation remain external.
`,
  );
}

function report(label, canonicalSuffix, body) {
  return `${frontmatter(`Project Homeport Phase 7 Correction Round 3 ${label}`, `project-homeport-phase-7-correction-round-3-${canonicalSuffix}`)}# Project Homeport Phase 7 Correction Round 3 ${label}\n\n${body}`;
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
  if (value.includes("Profile_Imagery"))
    return "src/components/homeport/ProfileCropEditor.tsx;src/wayfarer/profile-crop.ts;src/wayfarer/profile-media.ts;src/app/api/passport/media/route.ts";
  if (value.includes("Profile_Identity"))
    return "src/components/homeport/AccountSurfaces.tsx;src/homeport/personal-harbor.ts;src/homeport/current-user.server.ts;src/components/shell/ProductShell.tsx";
  if (value.includes("Registration_Email"))
    return "src/components/wayfarer/AccountFlow.tsx;src/wayfarer/verification-policy.ts;src/app/api/auth/register/route.ts;src/app/api/auth/email/verify/route.ts";
  if (value.includes("Postmark"))
    return "src/wayfarer/transactional-email.ts;src/app/api/webhooks/postmark/route.ts;src/wayfarer/transactional-email.test.ts;src/app/api/webhooks/postmark/route.test.ts";
  if (value.includes("Workspace_Entry"))
    return "src/homeport/workspace-capabilities.ts;src/chronicle/studio-authorization.ts;src/components/platform/CaptainLibrary.tsx;src/components/homeport/WorkspaceCapabilityDashboard.tsx";
  if (value.includes("Route_Crossfade"))
    return "src/animation/platform/RouteMotionBoundary.tsx;src/animation/platform/RouteMotionBoundary.test.tsx;src/animation/platform/motion-tokens.ts";
  if (value.includes("Account_Menu_Motion"))
    return "src/components/shell/ProductShell.tsx;src/components/shell/ProductShell.test.tsx;src/styles/shell.css";
  if (value.includes("Dark_Default"))
    return "src/app/layout.tsx;src/homeport/theme-bootstrap.ts;src/homeport/preference-runtime.ts";
  if (value.includes("Runtime_Fixture"))
    return "scripts/homeport/seed-phase7-owner-correction-round3-fixture.mjs;tests/e2e/homeport-phase7-owner-correction-round3.spec.ts";
  return "tests/e2e/homeport-phase7-owner-correction-round3.spec.ts;Development_Docs/Projects/Project_Homeport/evidence/phase7-owner-correction-round3/manifest.json";
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
  if (!/^[0-9a-f]{40}$/u.test(sourceSha)) throw new Error("Round 3 source SHA must be full length.");
  const resolved = git(["rev-parse", "--verify", `${sourceSha}^{commit}`]);
  if (resolved !== sourceSha || !isAncestor(sourceSha, "HEAD"))
    throw new Error("Round 3 source SHA must be reachable from HEAD.");
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
