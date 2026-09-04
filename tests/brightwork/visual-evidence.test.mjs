import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  canonicalCaptureIdentity,
  captureContractValidation,
  captureRequirementDigest,
  fileChecksum,
  reconciliationReport,
  semanticCaptureIssue,
  sourcePageRoutes,
} from "../../scripts/brightwork/visual-evidence.mjs";

const sourceSha = "a".repeat(40);
const contractDigest = "contract-digest";

function requirement(overrides = {}) {
  const { identity, ...fields } = overrides;
  const value = {
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
    expectedReadyLandmarks: [{ id: "EXAMPLE_MAIN", selector: "main" }],
    ...fields,
  };
  const canonical = { ...value, identity: identity ?? canonicalCaptureIdentity(value) };
  return { ...canonical, requirementDigest: fields.requirementDigest ?? captureRequirementDigest(canonical) };
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
    requirementDigest: required.requirementDigest,
    screenshotPath: relative,
    sha256: fileChecksum(image),
    captureStatus: "CAPTURED_PENDING_BRIGHTWORK_REVIEW",
    semanticObservation: {
      httpStatus: 200,
      finalPath: "/example",
      pageTitle: "Example",
      visibleMain: true,
      expectedPathMatched: true,
      transitionSettled: true,
      notFound: false,
      unauthorizedSurface: false,
      signInSurface: false,
      readyLandmarks: ["EXAMPLE_MAIN"],
      syntheticRecordProven: true,
    },
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
  const report = reconciliationReport({
    contract: value.contract,
    manifest: { records: [value.record] },
    sourceSha,
    imageRoot: value.root,
  });
  assert.equal(report.currentCaptures, 1);
  assert.equal(report.overallCompleteness, "COMPLETE");
});

test("old-source evidence is STALE", async (t) => {
  const value = await fixture(t, { record: { sourceSha: "b".repeat(40) } });
  const report = reconciliationReport({
    contract: value.contract,
    manifest: { records: [value.record] },
    sourceSha,
    imageRoot: value.root,
  });
  assert.equal(report.staleCaptures, 1);
});

test("an unchanged per-requirement binding stays current across a global contract revision", async (t) => {
  const value = await fixture(t);
  const report = reconciliationReport({
    contract: { contractDigest: "expanded-contract-digest", requirements: [value.required] },
    manifest: { records: [value.record] },
    sourceSha,
    imageRoot: value.root,
  });
  assert.equal(report.currentCaptures, 1);
  assert.equal(report.staleCaptures, 0);
});

test("a newly required human route remains MISSING until captured", async (t) => {
  const value = await fixture(t);
  const added = requirement({ routeId: "route-page-new", routePattern: "/new", screenId: "screen-page-new" });
  const report = reconciliationReport({
    contract: { contractDigest, requirements: [value.required, added] },
    manifest: { records: [value.record] },
    sourceSha,
    imageRoot: value.root,
  });
  assert.equal(report.missingCaptures, 1);
  assert.equal(report.missing[0].routePattern, "/new");
});

test("a retired route capture becomes orphaned rather than current", async (t) => {
  const value = await fixture(t);
  const report = reconciliationReport({
    contract: { contractDigest, requirements: [] },
    manifest: { records: [value.record] },
    sourceSha,
    imageRoot: value.root,
  });
  assert.equal(report.unexpectedOrphanedCaptures, 1);
});

test("an unindexed canonical file is an orphaned capture", async (t) => {
  const value = await fixture(t);
  const retiredPath = path.join(value.root, "Canonical/DARK/desktop-1440x900/Gateway_Public_Shell/retired.png");
  await mkdir(path.dirname(retiredPath), { recursive: true });
  await writeFile(retiredPath, "retired synthetic bytes");
  const report = reconciliationReport({
    contract: value.contract,
    manifest: { records: [value.record] },
    sourceSha,
    imageRoot: value.root,
  });
  assert.equal(report.unexpectedOrphanedCaptures, 1);
  assert.equal(report.orphaned[0].reconciliationReason, "CANONICAL_FILE_NOT_IN_MANIFEST");
});

test("a newly required screen state is MISSING", async (t) => {
  const value = await fixture(t);
  const requiredState = requirement({ state: "ERROR" });
  const report = reconciliationReport({
    contract: { contractDigest, requirements: [value.required, requiredState] },
    manifest: { records: [value.record] },
    sourceSha,
    imageRoot: value.root,
  });
  assert.equal(report.missingCaptures, 1);
  assert.equal(report.missing[0].state, "ERROR");
});

test("a corrupted image checksum fails reconciliation", async (t) => {
  const value = await fixture(t, { record: { sha256: "0".repeat(64) } });
  const report = reconciliationReport({
    contract: value.contract,
    manifest: { records: [value.record] },
    sourceSha,
    imageRoot: value.root,
  });
  assert.equal(report.missingCaptures, 1);
  assert.equal(report.missing[0].reconciliationReason, "CHECKSUM_MISMATCH");
});

test("duplicate canonical image ids are rejected", async (t) => {
  const value = await fixture(t);
  const duplicate = { ...value.record, theme: "LIGHT" };
  const second = requirement({ theme: "LIGHT" });
  const report = reconciliationReport({
    contract: { contractDigest, requirements: [value.required, second] },
    manifest: { records: [value.record, duplicate] },
    sourceSha,
    imageRoot: value.root,
  });
  assert.equal(report.duplicateCanonicalImageIds, 1);
});

test("truthful product blockers remain distinct from missing screenshot-system evidence", async (t) => {
  const value = await fixture(t, { record: { captureStatus: "BLOCKED_BY_PRODUCT" } });
  const report = reconciliationReport({
    contract: value.contract,
    manifest: { records: [value.record] },
    sourceSha,
    imageRoot: value.root,
  });
  assert.equal(report.blockedByProduct, 1);
  assert.equal(report.missingCaptures, 0);
  assert.equal(report.overallCompleteness, "COMPLETE_WITH_PRODUCT_BLOCKERS");
});

test("canonical capture identities are deterministic and route-specific", () => {
  const first = requirement();
  const same = requirement();
  const distinct = requirement({ routeId: "route-page-other", routePattern: "/other", screenId: "screen-page-other" });
  assert.equal(first.identity, same.identity);
  assert.notEqual(first.identity, distinct.identity);
});

test("contract validation rejects malformed and duplicate emitted identities", () => {
  const first = requirement();
  const duplicate = requirement({
    routeId: "route-page-other",
    routePattern: "/other",
    screenId: "screen-page-other",
    identity: first.identity,
  });
  const malformed = requirement({ identity: "not-a-canonical-identity" });
  const report = captureContractValidation({ contract: { requirements: [first, duplicate, malformed] } });
  assert.equal(report.duplicateIdentities.length, 1);
  assert.equal(report.malformedIdentities.length, 2);
  assert.equal(report.valid, false);
});

test("contract validation rejects a persona outside the route census", () => {
  const value = requirement({ persona: "ANONYMOUS" });
  const report = captureContractValidation({
    contract: { requirements: [value] },
    census: { routes: [{ routeId: value.routeId, applicablePersonas: ["ADMIRALTY_OPERATOR"] }] },
  });
  assert.equal(report.personaMismatches.length, 1);
  assert.equal(report.valid, false);
});

test("semantic validation refuses a ready capture that is a not-found surface", () => {
  assert.equal(
    semanticCaptureIssue(requirement(), {
      visibleMain: true,
      expectedPathMatched: true,
      notFound: true,
      unauthorizedSurface: false,
      signInSurface: false,
      syntheticRecordProven: true,
    }),
    "READY_NOT_FOUND",
  );
  assert.equal(
    semanticCaptureIssue(requirement(), {
      visibleMain: true,
      expectedPathMatched: true,
      notFound: false,
      unauthorizedSurface: false,
      unavailableSurface: true,
      deadEndSurface: false,
      signInSurface: false,
      syntheticRecordProven: true,
    }),
    "READY_UNAVAILABLE_SURFACE",
  );
  assert.equal(
    semanticCaptureIssue(requirement(), {
      visibleMain: true,
      expectedPathMatched: true,
      transitionSettled: true,
      notFound: false,
      unauthorizedSurface: false,
      signInSurface: true,
      readyLandmarks: ["EXAMPLE_MAIN"],
      syntheticRecordProven: true,
    }),
    null,
  );
});

test("semantic validation requires intended compatibility and dynamic evidence", () => {
  const compatibility = requirement({
    classification: "COMPATIBILITY_OR_REDIRECT",
    state: "COMPATIBILITY_OR_REDIRECT",
    expectedDestination: "/captain/library",
  });
  assert.equal(
    semanticCaptureIssue(compatibility, {
      notFound: false,
      unauthorizedSurface: false,
      signInSurface: false,
      finalPath: "/unexpected",
      syntheticRecordProven: true,
    }),
    "COMPATIBILITY_DESTINATION_MISMATCH",
  );
  assert.equal(
    semanticCaptureIssue(requirement({ classification: "CONTEXTUAL_DYNAMIC_DESTINATION" }), {
      notFound: false,
      unauthorizedSurface: false,
      signInSurface: false,
      finalPath: "/example",
      syntheticRecordProven: false,
    }),
    "DYNAMIC_SYNTHETIC_RECORD_UNPROVEN",
  );
});
