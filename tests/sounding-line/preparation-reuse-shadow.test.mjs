import test from "node:test";
import assert from "node:assert/strict";
import { digest } from "../../scripts/sounding-line/evidence.mjs";
import {
  createPreparationShadowRecord,
  comparePreparationReuseShadow,
  PREPARATION_FINGERPRINT_FIELDS,
} from "../../scripts/sounding-line/preparation-reuse-shadow.mjs";

function input() {
  return {
    prNumber: 900,
    producer: { runId: 123, attempt: 1 },
    source: { baseSha: "a".repeat(40), candidateSha: "b".repeat(40), treeSha: "c".repeat(40) },
    fingerprints: Object.fromEntries(PREPARATION_FINGERPRINT_FIELDS.map((name) => [name, digest(name)])),
    outputs: { inventoryDigest: digest("inventory"), contentDigest: digest("content"), fileCount: 5, byteLength: 100 },
  };
}

test("equivalent shadow preparations preserve original run/source identities and still run fresh", () => {
  const original = createPreparationShadowRecord(input()),
    next = input();
  next.producer.runId = 124;
  const fresh = createPreparationShadowRecord(next),
    before = JSON.stringify(original);
  const result = comparePreparationReuseShadow({ original, fresh });
  assert.equal(result.disposition, "INPUT_AND_OUTPUT_EQUIVALENT_SHADOW");
  assert.equal(result.originalProducer.runId, 123);
  assert.equal(result.freshProducer.runId, 124);
  assert.deepEqual(result.originalSource, original.source);
  assert.equal(JSON.stringify(original), before);
  assert.equal(result.action, "RUN_FRESH_PREPARATION");
  assert.equal(result.certificate, "NOT_ISSUED");
  assert.equal(result.reuseAuthorized, false);
  assert.equal(result.originalContextAuthenticated, false);
  assert(result.requiredCertificates.includes("NATIVE_PREPARATION_PAYLOAD_AUTHENTICATION"));
  assert(result.requiredCertificates.includes("EXTERNAL_RUNTIME_AND_INPUT_CLOSURE_ISOLATION"));
});

test("each dependency/runtime/policy/coverage fingerprint independently invalidates preparation comparison", () => {
  const original = createPreparationShadowRecord(input());
  for (const name of PREPARATION_FINGERPRINT_FIELDS) {
    const next = input();
    next.fingerprints[name] = digest(`changed:${name}`);
    const result = comparePreparationReuseShadow({ original, fresh: createPreparationShadowRecord(next) });
    assert.equal(result.disposition, "CHANGED_INPUTS");
    assert.deepEqual(result.inputDifferences, [`fingerprints.${name}`]);
    assert.equal(result.action, "RUN_FRESH_PREPARATION");
  }
});

test("different source identities and nondeterministic output bytes cannot be normalized into reuse credit", () => {
  const original = createPreparationShadowRecord(input());
  for (const name of ["baseSha", "candidateSha", "treeSha"]) {
    const next = input();
    next.source[name] = "d".repeat(40);
    const result = comparePreparationReuseShadow({ original, fresh: createPreparationShadowRecord(next) });
    assert.deepEqual(result.inputDifferences, [`source.${name}`]);
  }
  const next = input();
  next.outputs.contentDigest = digest("different BUILD_ID or compiled bytes");
  const result = comparePreparationReuseShadow({ original, fresh: createPreparationShadowRecord(next) });
  assert.equal(result.disposition, "MATCHING_INPUTS_DISTINCT_OUTPUTS");
  assert.deepEqual(result.outputDifferences, ["contentDigest"]);
  assert.equal(result.reuseAuthorized, false);
});

test("serialized context claims and caller authorization flags cannot mint a preparation certificate", () => {
  const original = createPreparationShadowRecord(input());
  const result = comparePreparationReuseShadow({
    original,
    fresh: JSON.parse(JSON.stringify(original)),
    nativeOriginalProof: {
      kind: "PROVIDER_BOUND_ORIGINAL_CONTEXT_NOT_REUSE_AUTHORITY",
      qualification: true,
      reuseAuthorized: true,
    },
    nativeInput: {},
  });
  assert.equal(result.originalContextAuthenticated, false);
  assert.equal(result.certificate, "NOT_ISSUED");
  assert.equal(result.inputRecordsAuthenticated, false);
  assert.throws(
    () => comparePreparationReuseShadow({ original: { ...original, reuseAuthorized: true }, fresh: original }),
    /RECORD_INTEGRITY/u,
  );
});

test("incomplete, corrupted, oversized, cross-PR and held-owner metadata fail closed", () => {
  const original = createPreparationShadowRecord(input());
  const missing = input();
  delete missing.fingerprints.schema;
  assert.throws(() => createPreparationShadowRecord(missing), /FINGERPRINTS/u);
  assert.throws(
    () => comparePreparationReuseShadow({ original: { ...original, recordDigest: "0".repeat(64) }, fresh: original }),
    /RECORD_INTEGRITY/u,
  );
  assert.throws(
    () =>
      createPreparationShadowRecord({
        ...input(),
        outputs: { ...input().outputs, byteLength: 2 * 1024 * 1024 * 1024 + 1 },
      }),
    /OUTPUTS/u,
  );
  for (const prNumber of [721, 776, 805])
    assert.throws(() => createPreparationShadowRecord({ ...input(), prNumber }), /SCOPE/u);
  assert.throws(
    () =>
      comparePreparationReuseShadow({ original, fresh: createPreparationShadowRecord({ ...input(), prNumber: 901 }) }),
    /CROSS_PR_SCOPE/u,
  );
});
