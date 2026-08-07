import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const evidenceRoot = path.resolve(root, "Development_Docs", "Projects", "Project_Homeport", "evidence", "phase5");
const manifestPath = path.join(evidenceRoot, "manifest.json");
const expectedSource = "b9f1552b78857c36a45f25eb5fdfb7a7e09f102a";

if (!process.argv.includes("--accept")) throw new Error("Visual acceptance requires the explicit --accept flag.");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (manifest.sourceSha !== expectedSource) throw new Error(`Unexpected evidence source: ${manifest.sourceSha}`);
if (manifest.fixtureVersion !== "homeport-phase5-route-reachability-v2")
  throw new Error(`Unexpected fixture version: ${manifest.fixtureVersion}`);
if (manifest.records.length !== 29) throw new Error(`Expected 29 evidence records, found ${manifest.records.length}.`);

const evidenceIds = new Set();
for (const record of manifest.records) {
  if (evidenceIds.has(record.evidenceId)) throw new Error(`Duplicate evidence ID: ${record.evidenceId}`);
  evidenceIds.add(record.evidenceId);
  if (record.sourceSha !== expectedSource) throw new Error(`${record.evidenceId} has a mismatched source SHA.`);
  if (record.fixtureVersion !== manifest.fixtureVersion)
    throw new Error(`${record.evidenceId} has a mismatched fixture version.`);
  if (record.fixtureChecksum !== manifest.fixtureChecksum)
    throw new Error(`${record.evidenceId} has a mismatched fixture checksum.`);

  const screenshotPath = path.resolve(root, record.committedScreenshotPath);
  if (!screenshotPath.startsWith(evidenceRoot + path.sep) || !existsSync(screenshotPath))
    throw new Error(`${record.evidenceId} screenshot is missing or outside the Phase 5 evidence root.`);
  const checksum = createHash("sha256").update(readFileSync(screenshotPath)).digest("hex");
  if (checksum !== record.sha256) throw new Error(`${record.evidenceId} checksum does not match metadata.`);
  if (
    record.reviewerClassification !== "PENDING_CODEX_VISUAL_REVIEW" &&
    record.reviewerClassification !== "CODEX_VISUAL_REVIEW_ACCEPTED"
  )
    throw new Error(`${record.evidenceId} has an unexpected review classification.`);
  record.reviewerClassification = "CODEX_VISUAL_REVIEW_ACCEPTED";
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(
  `Accepted ${manifest.records.length} checksum-verified Phase 5 visual records at ${expectedSource}.\n`,
);
