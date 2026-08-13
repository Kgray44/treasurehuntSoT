import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const evidenceRoot = path.join(root, "Development_Docs", "Project Wakebook", "evidence", "phase1");
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

test("Wakebook Phase 1 visual evidence is source, fixture, and checksum bound", () => {
  const manifestPath = path.join(evidenceRoot, "manifest.json");
  assert.ok(existsSync(manifestPath), "Wakebook visual evidence manifest is required");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.phase, "PROJECT_WAKEBOOK_PHASE_1");
  assert.match(manifest.sourceSha, /^[0-9a-f]{40}$/u);
  assert.equal(manifest.fixtureVersion, "wakebook-phase1-browser-v1");
  assert.equal(manifest.visualReview?.classification, "ACCEPTED");
  assert.deepEqual(manifest.records.map((record) => record.evidenceId).sort(), [...expectedEvidenceIds].sort());
  for (const record of manifest.records) {
    assert.equal(record.sourceSha, manifest.sourceSha);
    assert.equal(record.visualReviewClassification, "ACCEPTED");
    assert.equal(record.overflowResult, "NO_ACCIDENTAL_HORIZONTAL_DOCUMENT_OVERFLOW");
    const screenshotPath = path.resolve(root, record.capturePath);
    assert.ok(screenshotPath.startsWith(evidenceRoot + path.sep));
    assert.ok(existsSync(screenshotPath), `${record.evidenceId} screenshot is missing`);
    assert.equal(createHash("sha256").update(readFileSync(screenshotPath)).digest("hex"), record.sha256);
  }
});
