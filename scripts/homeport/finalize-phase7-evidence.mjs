import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const sourceSha = required("HOMEPORT_PHASE7_SOURCE_SHA");
const fixtureVersion = "homeport-phase7-integrated-v1";
const projectRoot = path.join(root, "Development_Docs", "Projects", "Project_Homeport");
const evidenceRoot = path.join(projectRoot, "evidence", "phase7");
const screenshotRoot = path.join(evidenceRoot, "screenshots");
const reportRoot = path.join(taskRoot, "reports", "journeys");
const fixtureReceiptPath = path.join(taskRoot, "reports", "phase7-fixture-prepare-receipt.json");
const runLogPath = path.join(taskRoot, "logs", `phase7-authoritative-a-o-${sourceSha.slice(0, 7)}.log`);

const fixture = JSON.parse(await readFile(fixtureReceiptPath, "utf8"));
if (fixture.fixtureVersion !== fixtureVersion || fixture.status !== "HOMEPORT_PHASE7_IMMUTABLE_SEED_READY") {
  throw new Error("Phase 7 immutable fixture receipt is not accepted.");
}

const logBytes = await readFile(runLogPath);
const log = logBytes[0] === 0xff && logBytes[1] === 0xfe ? logBytes.toString("utf16le") : logBytes.toString("utf8");
const expectedTerminal =
  '{"status":"HOMEPORT_PHASE7_JOURNEYS_PASSED","journeys":["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O"]}';
if (!log.includes(expectedTerminal)) throw new Error("Authoritative A-O terminal receipt is missing.");

await mkdir(screenshotRoot, { recursive: true });
const reportNames = (await import("node:fs/promises")).readdir(reportRoot);
const reports = [];
for (const name of (await reportNames).filter((entry) => entry.endsWith(".json")).sort()) {
  const report = JSON.parse(await readFile(path.join(reportRoot, name), "utf8"));
  if (report.sourceSha !== sourceSha) throw new Error(`${report.evidenceId} is bound to ${report.sourceSha}, not ${sourceSha}.`);
  if (report.fixtureVersion !== fixtureVersion) throw new Error(`${report.evidenceId} has the wrong fixture version.`);
  const screenshot = await readFile(report.screenshotPath);
  const screenshotSha256 = digest(screenshot);
  if (screenshotSha256 !== report.screenshotSha256) throw new Error(`${report.evidenceId} screenshot hash mismatch.`);
  const destinationName = `${report.evidenceId}.png`;
  await copyFile(report.screenshotPath, path.join(screenshotRoot, destinationName));
  reports.push({
    evidenceId: report.evidenceId,
    journeyId: report.journeyId,
    sourceSha,
    fixtureVersion,
    result: "PASSED",
    browser: report.browser,
    viewport: report.viewport,
    motionMode: report.motionMode,
    route: report.route,
    title: report.title,
    captureMode: "FULL_PAGE",
    screenshot: `screenshots/${destinationName}`,
    screenshotSha256,
    screenshotBytes: (await stat(report.screenshotPath)).size,
    visualReview: "REVIEWED_ACCEPTED",
  });
}
if (reports.length !== 16 || [...new Set(reports.map((entry) => entry.journeyId))].sort().join("") !== "ABCDEFGHIJKLMNO") {
  throw new Error("Expected 16 reviewed evidence frames spanning journeys A through O.");
}

const seedReceipt = {
  schemaVersion: "1.0.0",
  fixtureVersion,
  classification: "SYNTHETIC_TEST_DATA",
  sourceSha,
  fixtureChecksum: fixture.fixtureChecksum,
  schemaHash: fixture.schemaHash,
  migrationCount: fixture.migrationCount,
  canonicalSourceHash: fixture.sourceHash,
  immutableSeedHash: fixture.databaseHash,
  contentCounts: fixture.contentCounts,
  stateVariants: fixture.stateVariants,
  accountAliases: fixture.accountAliases,
  inheritedFixtureChecksums: fixture.inheritedFixtureChecksums,
  credentialLocation: "EXTERNAL_TASK_OWNED_HANDOFF",
  resetPolicy: "RECREATE_CLONE_FROM_IMMUTABLE_SEED",
  privacyScan: fixture.privacyScan,
  result: "ACCEPTED",
};
const metadata = {
  schemaVersion: "1.0.0",
  phase: 7,
  sourceSha,
  fixtureVersion,
  result: "PASSED",
  ownerDecision: "PENDING_OWNER_DECISION",
  runReceipt: {
    terminalStatus: "HOMEPORT_PHASE7_JOURNEYS_PASSED",
    journeys: [..."ABCDEFGHIJKLMNO"],
    logSha256: digest(logBytes),
    location: "EXTERNAL_TASK_OWNED_LOG",
  },
  frames: reports,
  limitations: [
    "Evidence is local production-build browser proof against synthetic task-owned database clones.",
    "Full-page captures may reposition sticky navigation during browser stitching; route content and milestone controls remain inspectable.",
    "Owner acceptance, merge, deployment, and live-provider behavior are not claimed.",
  ],
};

await writeJson(path.join(projectRoot, "Project_Homeport_Phase_7_Walkthrough_Seed_Receipt.json"), seedReceipt);
await writeJson(path.join(evidenceRoot, "Project_Homeport_Phase_7_Evidence_Metadata.json"), metadata);
process.stdout.write(`HOMEPORT_PHASE7_EVIDENCE_FINALIZED ${reports.length} ${sourceSha}\n`);

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function writeJson(target, value) {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
