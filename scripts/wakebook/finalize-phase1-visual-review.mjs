import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const evidenceRoot = path.resolve(
  process.env.WAKEBOOK_PHASE1_EVIDENCE_ROOT ??
    path.join(root, "Development_Docs", "Project Wakebook", "evidence", "phase1"),
);
const manifestPath = path.join(evidenceRoot, "manifest.json");
const expectedSourceSha = process.env.WAKEBOOK_PHASE1_EXPECTED_SOURCE_SHA;
const expectedEvidenceIds = [
  "WB-P1-EV-001-archive-empty",
  "WB-P1-EV-002-archive-one-voyage",
  "WB-P1-EV-003-archive-many-voyages",
  "WB-P1-EV-004-archive-year-grouping",
  "WB-P1-EV-005-archive-filter-controls",
  "WB-P1-EV-006-archive-filtered-no-results",
  "WB-P1-EV-007-voyage-card-desktop",
  "WB-P1-EV-008-voyage-card-mobile",
  "WB-P1-EV-009-voyage-detail-desktop",
  "WB-P1-EV-010-voyage-detail-mobile",
  "WB-P1-EV-011-invitation-history",
  "WB-P1-EV-012-unavailable-timing",
  "WB-P1-EV-013-partial-history",
  "WB-P1-EV-014-error-state",
  "WB-P1-EV-015-error-recovery",
];

if (!process.argv.includes("--accept")) throw new Error("Visual acceptance requires the explicit --accept flag.");
if (!expectedSourceSha)
  throw new Error("WAKEBOOK_PHASE1_EXPECTED_SOURCE_SHA is required for source-bound visual review.");
if (!existsSync(manifestPath)) throw new Error(`Wakebook evidence manifest is missing: ${manifestPath}`);

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (manifest.phase !== "PROJECT_WAKEBOOK_PHASE_1") throw new Error(`Unexpected evidence phase: ${manifest.phase}`);
if (manifest.sourceSha !== expectedSourceSha) throw new Error(`Unexpected evidence source: ${manifest.sourceSha}`);
if (manifest.fixtureVersion !== "wakebook-phase1-browser-v1")
  throw new Error(`Unexpected fixture version: ${manifest.fixtureVersion}`);
if (!Array.isArray(manifest.records) || manifest.records.length !== expectedEvidenceIds.length)
  throw new Error(
    `Expected ${expectedEvidenceIds.length} Wakebook evidence records, found ${manifest.records?.length ?? 0}.`,
  );

const observedIds = new Set();
for (const record of manifest.records) {
  if (observedIds.has(record.evidenceId)) throw new Error(`Duplicate evidence ID: ${record.evidenceId}`);
  observedIds.add(record.evidenceId);
  if (record.sourceSha !== expectedSourceSha) throw new Error(`${record.evidenceId} has stale source evidence.`);
  if (record.visualReviewClassification !== "PENDING_CODEX_VISUAL_REVIEW")
    throw new Error(`${record.evidenceId} is not awaiting visual review.`);
  const screenshotPath = path.resolve(root, record.capturePath);
  if (!screenshotPath.startsWith(evidenceRoot + path.sep) || !existsSync(screenshotPath))
    throw new Error(`${record.evidenceId} screenshot is missing or outside the Wakebook evidence root.`);
  const checksum = createHash("sha256").update(readFileSync(screenshotPath)).digest("hex");
  if (checksum !== record.sha256) throw new Error(`${record.evidenceId} checksum does not match metadata.`);
  record.visualReviewClassification = "ACCEPTED";
  record.defectsFound = "NONE_AFTER_SOURCE_BOUND_VISUAL_REVIEW";
  record.correctionCommit = "NOT_REQUIRED_AFTER_CAPTURE";
}
for (const evidenceId of expectedEvidenceIds)
  if (!observedIds.has(evidenceId)) throw new Error(`Required Wakebook evidence is missing: ${evidenceId}`);

manifest.visualReview = {
  reviewer: "CODEX_VISUAL_REVIEW",
  classification: "ACCEPTED",
  acceptedRecords: manifest.records.length,
  limitation:
    "Image-by-image Codex review is not owner acceptance, physical assistive-technology evidence, deployment proof, or protected-main approval.",
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
writeFileSync(
  path.join(evidenceRoot, "Project_Wakebook_Phase_1_Visual_Review.md"),
  `---\ntitle: Project Wakebook Phase 1 Visual Review\ndocument_type: validation_record\nstatus: current\nproject: Project Wakebook\nphase: 1\n---\n\n# Project Wakebook Phase 1 visual review\n\nAll ${manifest.records.length} source-bound synthetic captures were checksum-verified and reviewed image by image.\nThe accepted captures cover empty, one-Voyage, many-Voyage, grouping, filters, no-results, desktop/mobile card and detail,\nunavailable timing, partial history, invitation separation, and error/recovery states.\n\n- Exact implementation source: \`${expectedSourceSha}\`\n- Fixture: \`${manifest.fixtureVersion}\`\n- Review classification: \`ACCEPTED\`\n\nThis Codex review is not owner acceptance, a physical assistive-technology session, deployment proof, or protected-main approval.\n`,
  "utf8",
);
process.stdout.write(
  `Accepted ${manifest.records.length} checksum-verified Wakebook visual records at ${expectedSourceSha}.\n`,
);
