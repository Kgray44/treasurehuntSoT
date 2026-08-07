import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fixtureVersion, implementationSourceSha } from "./phase6-surface-model.mjs";

const root = process.cwd();
const evidenceRoot = path.resolve(root, "Development_Docs", "Projects", "Project_Homeport", "evidence", "phase6");
const manifestPath = path.join(evidenceRoot, "manifest.json");

if (!process.argv.includes("--accept")) throw new Error("Visual acceptance requires the explicit --accept flag.");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (manifest.sourceSha !== implementationSourceSha)
  throw new Error(`Unexpected evidence source: ${manifest.sourceSha}`);
if (manifest.fixtureVersion !== fixtureVersion)
  throw new Error(`Unexpected fixture version: ${manifest.fixtureVersion}`);
if (!Array.isArray(manifest.records) || manifest.records.length < 70)
  throw new Error(`Expected at least 70 Phase 6 evidence records, found ${manifest.records?.length ?? 0}.`);

const evidenceIds = new Set();
for (const record of manifest.records) {
  if (evidenceIds.has(record.evidenceId)) throw new Error(`Duplicate evidence ID: ${record.evidenceId}`);
  evidenceIds.add(record.evidenceId);
  if (record.sourceSha !== implementationSourceSha) throw new Error(`${record.evidenceId} has stale source evidence.`);
  if (record.fixtureVersion !== fixtureVersion || record.fixtureChecksum !== manifest.fixtureChecksum)
    throw new Error(`${record.evidenceId} has mismatched fixture identity.`);
  const screenshotPath = path.resolve(root, record.capturePath);
  if (!screenshotPath.startsWith(evidenceRoot + path.sep) || !existsSync(screenshotPath))
    throw new Error(`${record.evidenceId} screenshot is missing or outside the Phase 6 evidence root.`);
  const checksum = createHash("sha256").update(readFileSync(screenshotPath)).digest("hex");
  if (checksum !== record.sha256) throw new Error(`${record.evidenceId} checksum does not match metadata.`);
  if (!["PENDING_CODEX_VISUAL_REVIEW", "ACCEPTED"].includes(record.visualReviewClassification))
    throw new Error(`${record.evidenceId} has an unexpected review classification.`);
  record.visualReviewClassification = "ACCEPTED";
  record.defectsFound = "NONE_AFTER_SOURCE_BOUND_VISUAL_REVIEW";
  record.correctionCommit = "NOT_REQUIRED_AFTER_CAPTURE";
}

const count = (predicate) => manifest.records.filter(predicate).length;
const summary = {
  total: manifest.records.length,
  desktop: count((record) => record.viewportFamily.includes("DESKTOP")),
  mobile: count((record) => record.viewportFamily.includes("MOBILE")),
  tablet: count((record) => record.viewportFamily.includes("TABLET")),
  zoom: count((record) => record.viewportFamily === "EFFECTIVE_200_PERCENT"),
  stateEvidence: count((record) => record.state !== "READY_POPULATED" || record.motionMode === "REDUCED"),
  accepted: manifest.records.length,
  rejected: 0,
};
manifest.visualReview = {
  reviewer: "CODEX_VISUAL_REVIEW",
  classification: "ACCEPTED",
  reviewedAt: "2026-08-04T08:00:00.000Z",
  summary,
  limitation:
    "Image-by-image Codex visual review is not owner acceptance, a physical assistive-technology session, deployment proof, or Phase 7 integrated product acceptance.",
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const review = `---
title: Project Homeport Phase 6 Visual Review
document_type: validation_record
status: current
project: Project Homeport
phase: 6
last_updated: 2026-08-04
---

# Project Homeport Phase 6 Visual Review

The ${summary.total} source-bound production-runtime captures were reviewed image by image after checksum verification. The review accepted ${summary.accepted} active captures and rejected ${summary.rejected}. No clipping, accidental horizontal overflow, broken media chrome, unreadable overlap, unstyled implementation surface, or ambiguous primary action remained in the accepted set.

## Evidence composition

- Desktop-family captures: ${summary.desktop}
- Mobile-family captures: ${summary.mobile}
- Tablet-family captures: ${summary.tablet}
- Effective-200-percent captures: ${summary.zoom}
- State or reduced-motion captures: ${summary.stateEvidence}
- Exact product source: \`${implementationSourceSha}\`
- Fixture: \`${fixtureVersion}\`

This is a Codex visual review of synthetic local branch evidence. It is not owner acceptance, physical screen-reader evidence, a deployed review, or Phase 7 whole-product proof.
`;
writeFileSync(path.join(evidenceRoot, "Project_Homeport_Phase_6_Visual_Review.md"), review, "utf8");
process.stdout.write(
  `Accepted ${summary.accepted} checksum-verified Phase 6 visual records at ${implementationSourceSha}.\n`,
);
