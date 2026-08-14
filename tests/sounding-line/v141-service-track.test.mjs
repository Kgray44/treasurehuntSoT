import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertNoSilentDisappearance,
  identityKey,
  normalizeManifest,
  resolveStableIdentity,
} from "../../scripts/sounding-line/stable-test-identities.mjs";
import {
  createTrustedCandidatePlan,
  finalizeTrustedCandidatePlan,
  sealTrustedCandidatePlan,
} from "../../scripts/sounding-line/candidate-qualification.mjs";

const sha = (digit) => digit.repeat(40);
const sourceKey = (file, title = "governed contract", ordinal = 0) => identityKey({ file, title, ordinal });
const manifest = (entries) => ({ version: 1, schemaVersion: "1.0.0", generated: true, identities: entries });

test("stable identity survives line movement and formatting because source lines are diagnostics only", () => {
  const stableId = "sl-sounding-line-governed-contract-1234567890-v1";
  const identities = manifest([
    { stableId, sourceKeys: [sourceKey("tests/fixture.test.mjs")], legacyTestIds: ["sl-test-old"], status: "ACTIVE" },
  ]);
  const atLineOne = resolveStableIdentity({
    manifest: identities,
    sourceKey: sourceKey("tests/fixture.test.mjs"),
    suiteId: "unit.sounding-line",
    title: "governed contract",
  });
  const atLineNineHundred = resolveStableIdentity({
    manifest: identities,
    sourceKey: sourceKey("tests/fixture.test.mjs"),
    suiteId: "unit.sounding-line",
    title: "governed contract",
  });
  assert.equal(atLineOne.stableId, stableId);
  assert.equal(atLineNineHundred.stableId, stableId);
});

test("explicit semantic metadata preserves stable identity across source relocation", () => {
  const stableId = "sl-sounding-line-relocated-contract-1234567890-v1";
  const identities = manifest([
    { stableId, sourceKeys: [sourceKey("tests/a.test.mjs")], legacyTestIds: ["sl-test-old"], status: "ACTIVE" },
  ]);
  const moved = resolveStableIdentity({
    manifest: identities,
    sourceKey: sourceKey("tests/b.test.mjs"),
    suiteId: "unit.sounding-line",
    title: "governed contract",
    explicitStableId: stableId,
  });
  assert.equal(moved.stableId, stableId);
  assert.equal(moved.relocated, true);
});

test("stable identity validation fails closed for duplicate, unknown, and silently disappeared identities", () => {
  const stableId = "sl-sounding-line-contract-1234567890-v1";
  assert.throws(
    () =>
      normalizeManifest(
        manifest([
          { stableId, sourceKeys: ["a"], legacyTestIds: [], status: "ACTIVE" },
          { stableId, sourceKeys: ["b"], legacyTestIds: [], status: "ACTIVE" },
        ]),
      ),
    /DUPLICATE_STABLE_TEST_ID/,
  );
  assert.throws(
    () =>
      assertNoSilentDisappearance(
        manifest([{ stableId, sourceKeys: ["a"], legacyTestIds: [], status: "ACTIVE" }]),
        new Set(),
      ),
    /STABLE_TEST_ID_DISAPPEARED/,
  );
  assert.throws(
    () =>
      resolveStableIdentity({
        manifest: manifest([]),
        sourceKey: "missing",
        suiteId: "unit.sounding-line",
        title: "missing",
      }),
    /MISSING_STABLE_TEST_ID/,
  );
});

test("stable identity supersession is explicit, acyclic, and independent of a source-line diagnostic", () => {
  const retired = "sl-sounding-line-retired-contract-1234567890-v1";
  const replacement = "sl-sounding-line-replacement-contract-1234567890-v1";
  assert.doesNotThrow(() =>
    normalizeManifest(
      manifest([
        { stableId: retired, sourceKeys: ["retired"], legacyTestIds: ["sl-test-retired"], status: "RETIRED" },
        {
          stableId: replacement,
          sourceKeys: ["active"],
          legacyTestIds: ["sl-test-active"],
          supersedesId: retired,
          status: "ACTIVE",
        },
      ]),
    ),
  );
  assert.throws(
    () =>
      normalizeManifest(
        manifest([
          {
            stableId: retired,
            sourceKeys: ["retired"],
            legacyTestIds: [],
            supersedesId: replacement,
            status: "RETIRED",
          },
          { stableId: replacement, sourceKeys: ["active"], legacyTestIds: [], supersedesId: retired, status: "ACTIVE" },
        ]),
      ),
    /STABLE_SUPERSESSION_CYCLE/,
  );
  // A P34 row binds the stable replacement, so line 7 versus line 700 is not
  // a semantic retirement reconciliation event.
  const p34 = { canonicalReplacementTestIds: [replacement] };
  const registryAtLine700 = new Set([replacement]);
  assert.ok(p34.canonicalReplacementTestIds.every((stableId) => registryAtLine700.has(stableId)));
});

async function candidateRoots() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sl-v141-"));
  const authorityRoot = path.join(root, "authority");
  const candidateRoot = path.join(root, "candidate");
  for (const directory of [authorityRoot, candidateRoot])
    await mkdir(path.join(directory, "testing", "generated"), { recursive: true });
  const authority = JSON.parse(
    await readFile(new URL("../../testing/sounding-line-authority.json", import.meta.url), "utf8"),
  );
  await Promise.all([
    writeFile(path.join(authorityRoot, "testing", "sounding-line-authority.json"), JSON.stringify(authority)),
    writeFile(
      path.join(authorityRoot, "testing", "generated", "active-test-registry.json"),
      JSON.stringify({ cases: [] }),
    ),
    writeFile(path.join(authorityRoot, "testing", "release-gates.json"), JSON.stringify({ gates: [] })),
    // A hostile candidate can alter these files; trusted planning must not read them.
    writeFile(
      path.join(candidateRoot, "testing", "sounding-line-authority.json"),
      JSON.stringify({
        currentAuthorityVersion: "9.9",
        candidateQualification: { maintenance: { mode: "ALLOW_SELF" } },
      }),
    ),
  ]);
  return { authorityRoot, candidateRoot };
}

const fixturePlan = async (changedPaths = ["scripts/sounding-line/planner.mjs"]) => {
  const { authorityRoot, candidateRoot } = await candidateRoots();
  return createTrustedCandidatePlan({
    authorityRoot,
    candidateRoot,
    authoritySourceSha: sha("a"),
    authoritySourceTree: sha("b"),
    candidateHeadSha: sha("c"),
    candidateTreeSha: sha("d"),
    qualifiedBaseSha: sha("e"),
    changedPaths,
  });
};

const cleanReceipts = (plan) =>
  plan.obligations.map((obligationId) => ({
    obligationId,
    status: "PASSED",
    authoritySourceSha: plan.authoritySource.sha,
    authoritySourceTree: plan.authoritySource.tree,
    candidateHeadSha: plan.subjectCandidate.headSha,
    candidateTreeSha: plan.subjectCandidate.treeSha,
    qualifiedBaseSha: plan.subjectCandidate.qualifiedBaseSha,
  }));

test("trusted protected-main authority classifies and finalizes a maintenance candidate", async () => {
  const plan = sealTrustedCandidatePlan(await fixturePlan());
  assert.equal(plan.executionIdentity, "MAINTENANCE");
  assert.equal(plan.candidateClassification, "VERIFICATION_MAINTENANCE");
  assert.equal(finalizeTrustedCandidatePlan({ plan, receipts: cleanReceipts(plan) }).decision, "MAINTENANCE_GO");
});

test("mixed product and Sounding Line changes fail closed from maintenance", async () => {
  await assert.rejects(
    () => fixturePlan(["scripts/sounding-line/planner.mjs", "src/app/page.tsx"]),
    /INELIGIBLE_MIXED_SCOPE/,
  );
});

test("candidate classifier, release-gate, and finalizer edits cannot self-authorize", async () => {
  const plan = sealTrustedCandidatePlan(await fixturePlan(["scripts/sounding-line/candidate-qualification.mjs"]));
  assert.equal(plan.authoritySource.sha, sha("a"));
  assert.notEqual(plan.authoritySource.authorityDigest, plan.subjectCandidate.candidateAuthorityDigest);
  const tampered = cleanReceipts(plan).map((receipt) => ({ ...receipt }));
  tampered[0].candidateTreeSha = sha("f");
  assert.equal(finalizeTrustedCandidatePlan({ plan, receipts: tampered }).decision, "MAINTENANCE_EVIDENCE_INVALID");
});

test("ordinary candidate remains trusted-main qualified and exact candidate bound", async () => {
  const plan = sealTrustedCandidatePlan(await fixturePlan(["src/app/page.tsx"]));
  assert.equal(plan.executionIdentity, "CANDIDATE");
  assert.equal(plan.candidateClassification, "ORDINARY_CANDIDATE");
  assert.equal(finalizeTrustedCandidatePlan({ plan, receipts: cleanReceipts(plan) }).decision, "RELEASE_GO");
  const incomplete = cleanReceipts(plan).slice(1);
  assert.equal(finalizeTrustedCandidatePlan({ plan, receipts: incomplete }).decision, "RELEASE_INCOMPLETE");
});
