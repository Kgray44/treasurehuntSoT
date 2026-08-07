import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const expectedSource = "977cb38a352eefd01110901eacc267bb903dac82";
const expectedFixtureChecksum = "6818975d1d09d26278d6e8aa0b338eaa5a0b96c333abd3279fc8c8941e779d86";
const evidenceRoot = resolve("Development_Docs/Projects/Project_Homeport/evidence/phase4");
const metadataPath = resolve(evidenceRoot, "Project_Homeport_Phase_4_Evidence_Metadata.json");

if (!process.argv.includes("--accept")) {
  throw new Error("Visual acceptance requires the explicit --accept flag.");
}

const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));

if (metadata.sourceSha !== expectedSource) {
  throw new Error(`Unexpected evidence source: ${metadata.sourceSha}`);
}

if (metadata.fixtureChecksum !== expectedFixtureChecksum) {
  throw new Error(`Unexpected fixture checksum: ${metadata.fixtureChecksum}`);
}

if (metadata.records.length !== 41) {
  throw new Error(`Expected 41 evidence records, found ${metadata.records.length}.`);
}

for (const record of metadata.records) {
  if (record.sourceSha !== expectedSource) {
    throw new Error(`${record.evidenceId} has a mismatched source SHA.`);
  }

  if (record.fixtureChecksum !== expectedFixtureChecksum) {
    throw new Error(`${record.evidenceId} has a mismatched fixture checksum.`);
  }

  const screenshotPath = resolve(record.screenshotPath);
  if (!existsSync(screenshotPath)) {
    throw new Error(`${record.evidenceId} screenshot is missing.`);
  }

  const checksum = createHash("sha256").update(readFileSync(screenshotPath)).digest("hex");
  if (checksum !== record.sha256) {
    throw new Error(`${record.evidenceId} checksum does not match metadata.`);
  }

  if (
    record.reviewerClassification !== "PENDING_CODEX_VISUAL_REVIEW" &&
    record.reviewerClassification !== "CODEX_VISUAL_REVIEW_ACCEPTED"
  ) {
    throw new Error(`${record.evidenceId} has an unexpected review classification.`);
  }

  record.reviewerClassification = "CODEX_VISUAL_REVIEW_ACCEPTED";
}

writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
console.log(`Accepted ${metadata.records.length} checksum-verified Phase 4 visual records at ${expectedSource}.`);
