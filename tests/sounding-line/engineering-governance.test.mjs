import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  classifyAuxiliaryGovernanceImpact,
  classifyEngineeringChange,
  createEngineeringControlPlan,
  finalizeEngineeringControlPlan,
} from "../../scripts/sounding-line/engineering-governance.mjs";

const sha = (character) => character.repeat(40);
const policy = JSON.parse(await readFile(new URL("../../testing/engineering-governance-policy.json", import.meta.url), "utf8"));

test("ordinary product and bounded Bosun repairs stay on the normal path", () => {
  assert.equal(classifyEngineeringChange({ trustedPolicy: policy, changedPaths: ["src/app/page.tsx"] }).classification, "ORDINARY");
  assert.equal(
    classifyEngineeringChange({ trustedPolicy: policy, changedPaths: ["src/nightwatch/bosun.ts"] }).classification,
    "ORDINARY",
  );
});

test("control-plane changes require owner authorization from trusted policy", () => {
  const rejected = classifyEngineeringChange({
    trustedPolicy: policy,
    changedPaths: ["scripts/sounding-line/authority.mjs"],
  });
  assert.equal(rejected.classification, "CONTROL_PLANE_CHANGE_REJECTED");
  assert.ok(rejected.errors.includes("CONTROL_PLANE_CHANGE_OWNER_AUTHORIZATION_REQUIRED"));
  assert.equal(
    classifyEngineeringChange({
      trustedPolicy: policy,
      changedPaths: ["scripts/sounding-line/authority.mjs"],
      ownerAuthorized: true,
    }).classification,
    "CONTROL_PLANE_CHANGE",
  );
});

test("control plans bind trusted policy, candidate, base, and landed tree", () => {
  const plan = createEngineeringControlPlan({
    trustedPolicy: policy,
    trustedMainSha: sha("a"),
    candidateSha: sha("b"),
    candidateTree: sha("c"),
    qualifiedBaseSha: sha("a"),
    changedPaths: ["scripts/sounding-line/authority.mjs"],
    ownerAuthorized: true,
  });
  const evidence = plan.requiredEvidence.map((id) => ({ id, result: "PASSED", candidateSha: sha("b") }));
  assert.equal(
    finalizeEngineeringControlPlan({
      plan,
      evidence,
      observedCandidateSha: sha("b"),
      observedTrustedMainSha: sha("a"),
      observedLandedTree: sha("c"),
    }).decision,
    "ENGINEERING_CONTROL_GO",
  );
});

test("break glass is owner-only, unavailable-path-only, bounded, and expiring", () => {
  const base = {
    trustedPolicy: policy,
    changedPaths: ["scripts/sounding-line/authority.mjs"],
    requestedClass: "BREAK_GLASS",
    trustedControlPlaneAvailable: false,
    ownerAuthorized: true,
    breakGlassScope: { paths: ["scripts/sounding-line/authority.mjs"] },
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    beforeAfterEvidence: ["before", "after"],
  };
  assert.equal(classifyEngineeringChange(base).classification, "BREAK_GLASS");
  assert.equal(classifyEngineeringChange({ ...base, trustedControlPlaneAvailable: true }).classification, "BREAK_GLASS_REJECTED");
});

test("unknown requests and release candidates cannot bypass the exhaustive path", () => {
  const unknown = classifyEngineeringChange({
    trustedPolicy: policy,
    changedPaths: ["src/app/page.tsx"],
    requestedClass: "FAST_TRACK",
  });
  assert.equal(unknown.classification, "ORDINARY_REJECTED");
  assert.ok(unknown.errors.includes("ENGINEERING_GOVERNANCE_REQUESTED_CLASS_UNKNOWN"));
  const release = classifyEngineeringChange({
    trustedPolicy: policy,
    changedPaths: ["src/app/page.tsx"],
    requestedClass: "RELEASE_CANDIDATE",
  });
  assert.equal(release.classification, "ORDINARY_REJECTED");
  assert.ok(release.errors.includes("RELEASE_CANDIDATE_EXHAUSTIVE_PATH_REQUIRED"));
});

test("auxiliary governance is selected by impact rather than universal ceremony", () => {
  assert.deepEqual(classifyAuxiliaryGovernanceImpact({ effects: {} }), {
    featureCatalog: false,
    deepwater: false,
    documentationIndex: false,
    changelogAndUserDocs: false,
    governingDocuments: false,
    unknown: false,
  });
  assert.equal(classifyAuxiliaryGovernanceImpact({ effects: { capability: true, userVisibleBehavior: true } }).featureCatalog, true);
});
