import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileChecksum, reconciliationReport, sourcePageRoutes } from "../../scripts/brightwork/visual-evidence.mjs";

const sourceSha = "a".repeat(40);
const contractDigest = "contract-digest";

function requirement(overrides = {}) {
  return {
    routeId: "route-page-example",
    routePattern: "/example",
    screenId: "screen-page-example",
    productArea: "Gateway_Public_Shell",
    classification: "USER_FACING_NAVIGABLE",
    state: "READY",
    persona: "ANONYMOUS",
    theme: "DARK",
    viewport: "desktop-1440x900",
    motionMode: "REDUCED",
    coverageKind: "ROUTE",
    criticality: "STANDARD",
    ...overrides,
  };
}

async function fixture(t, overrides = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "brightwork-evidence-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const relative = "Canonical/DARK/desktop-1440x900/Gateway_Public_Shell/BW-XI-0001.png";
  const image = path.join(root, ...relative.split("/"));
  await (await import("node:fs/promises")).mkdir(path.dirname(image), { recursive: true });
  await writeFile(image, "synthetic image bytes");
  const required = requirement(overrides.requirement);
  const record = {
    ...required,
    imageId: "BW-XI-0001",
    sourceSha,
    contractDigest,
    screenshotPath: relative,
    sha256: fileChecksum(image),
    captureStatus: "CAPTURED_PENDING_BRIGHTWORK_REVIEW",
    ...overrides.record,
  };
  return { root, required, record, contract: { contractDigest, requirements: [required] } };
}

test("source census sees the current root route", () => {
  const routes = sourcePageRoutes(path.resolve("src/app"));
  assert(routes.some((route) => route.routePattern === "/"));
  assert(routes.some((route) => route.routePattern === "/admin"));
});

test("current evidence with a valid checksum resolves CURRENT", async (t) => {
  const value = await fixture(t);
  const report = reconciliationReport({ contract: value.contract, manifest: { records: [value.record] }, sourceSha, imageRoot: value.root });
  assert.equal(report.currentCaptures, 1);
  assert.equal(report.overallCompleteness, "COMPLETE");
});

test("old-source evidence is STALE", async (t) => {
  const value = await fixture(t, { record: { sourceSha: "b".repeat(40) } });
  const report = reconciliationReport({ contract: value.contract, manifest: { records: [value.record] }, sourceSha, imageRoot: value.root });
  assert.equal(report.staleCaptures, 1);
});

test("a newly required human route remains MISSING until captured", async (t) => {
  const value = await fixture(t);
  const added = requirement({ routeId: "route-page-new", routePattern: "/new", screenId: "screen-page-new" });
  const report = reconciliationReport({ contract: { contractDigest, requirements: [value.required, added] }, manifest: { records: [value.record] }, sourceSha, imageRoot: value.root });
  assert.equal(report.missingCaptures, 1);
  assert.equal(report.missing[0].routePattern, "/new");
});

test("a retired route capture becomes orphaned rather than current", async (t) => {
  const value = await fixture(t);
  const report = reconciliationReport({ contract: { contractDigest, requirements: [] }, manifest: { records: [value.record] }, sourceSha, imageRoot: value.root });
  assert.equal(report.unexpectedOrphanedCaptures, 1);
});

test("an unindexed canonical file is an orphaned capture", async (t) => {
  const value = await fixture(t);
  const retiredPath = path.join(value.root, "Canonical/DARK/desktop-1440x900/Gateway_Public_Shell/retired.png");
  await mkdir(path.dirname(retiredPath), { recursive: true });
  await writeFile(retiredPath, "retired synthetic bytes");
  const report = reconciliationReport({ contract: value.contract, manifest: { records: [value.record] }, sourceSha, imageRoot: value.root });
  assert.equal(report.unexpectedOrphanedCaptures, 1);
  assert.equal(report.orphaned[0].reconciliationReason, "CANONICAL_FILE_NOT_IN_MANIFEST");
});

test("a newly required screen state is MISSING", async (t) => {
  const value = await fixture(t);
  const requiredState = requirement({ state: "ERROR" });
  const report = reconciliationReport({ contract: { contractDigest, requirements: [value.required, requiredState] }, manifest: { records: [value.record] }, sourceSha, imageRoot: value.root });
  assert.equal(report.missingCaptures, 1);
  assert.equal(report.missing[0].state, "ERROR");
});

test("a corrupted image checksum fails reconciliation", async (t) => {
  const value = await fixture(t, { record: { sha256: "0".repeat(64) } });
  const report = reconciliationReport({ contract: value.contract, manifest: { records: [value.record] }, sourceSha, imageRoot: value.root });
  assert.equal(report.missingCaptures, 1);
  assert.equal(report.missing[0].reconciliationReason, "CHECKSUM_MISMATCH");
});

test("duplicate canonical image ids are rejected", async (t) => {
  const value = await fixture(t);
  const duplicate = { ...value.record, theme: "LIGHT" };
  const second = requirement({ theme: "LIGHT" });
  const report = reconciliationReport({ contract: { contractDigest, requirements: [value.required, second] }, manifest: { records: [value.record, duplicate] }, sourceSha, imageRoot: value.root });
  assert.equal(report.duplicateCanonicalImageIds, 1);
});

test("truthful product blockers remain distinct from missing screenshot-system evidence", async (t) => {
  const value = await fixture(t, { record: { captureStatus: "BLOCKED_BY_PRODUCT" } });
  const report = reconciliationReport({ contract: value.contract, manifest: { records: [value.record] }, sourceSha, imageRoot: value.root });
  assert.equal(report.blockedByProduct, 1);
  assert.equal(report.missingCaptures, 0);
  assert.equal(report.overallCompleteness, "COMPLETE_WITH_PRODUCT_BLOCKERS");
});
