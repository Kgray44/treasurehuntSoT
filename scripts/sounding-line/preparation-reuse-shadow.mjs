import { canonicalJson, digest } from "./evidence.mjs";
import { inspectNativeOriginalContext } from "./native-original-context-auth.mjs";

export const PREPARATION_FINGERPRINT_FIELDS = Object.freeze([
  "sourceClosure",
  "controller",
  "policy",
  "commands",
  "inputs",
  "dependencies",
  "toolchain",
  "browser",
  "environment",
  "fixture",
  "schema",
  "profile",
  "coverage",
]);
const sha256 = (value) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const oid = (value) => typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const keys = (value, expected) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  canonicalJson(Object.keys(value).sort()) === canonicalJson([...expected].sort());
const need = (condition, code) => {
  if (!condition) throw Error(`SOUNDING_LINE_PREPARATION_SHADOW_${code}`);
};

// Metadata for comparing two complete fresh preparations. This function does not
// measure those preparations, authenticate the supplied fields, package a build,
// or issue a cache certificate. No secret values or private paths are accepted.
export function createPreparationShadowRecord({ prNumber, producer, source, fingerprints, outputs }) {
  need(positive(prNumber) && ![721, 776, 805].includes(prNumber), "SCOPE");
  need(keys(producer, ["runId", "attempt"]) && positive(producer.runId) && positive(producer.attempt), "PRODUCER");
  need(keys(source, ["baseSha", "candidateSha", "treeSha"]) && Object.values(source).every(oid), "SOURCE");
  need(keys(fingerprints, PREPARATION_FINGERPRINT_FIELDS) && Object.values(fingerprints).every(sha256), "FINGERPRINTS");
  need(
    keys(outputs, ["inventoryDigest", "contentDigest", "fileCount", "byteLength"]) &&
      sha256(outputs.inventoryDigest) &&
      sha256(outputs.contentDigest) &&
      positive(outputs.fileCount) &&
      outputs.fileCount <= 200000 &&
      positive(outputs.byteLength) &&
      outputs.byteLength <= 2 * 1024 * 1024 * 1024,
    "OUTPUTS",
  );
  const body = JSON.parse(
    canonicalJson({
      version: 1,
      kind: "PREPARATION_COMPARISON_SHADOW",
      prNumber,
      producer,
      source,
      fingerprints,
      outputs,
      qualification: false,
      reuseAuthorized: false,
    }),
  );
  return { ...body, recordDigest: digest(body) };
}

function checked(record) {
  need(
    keys(record, [
      "version",
      "kind",
      "prNumber",
      "producer",
      "source",
      "fingerprints",
      "outputs",
      "qualification",
      "reuseAuthorized",
      "recordDigest",
    ]),
    "RECORD",
  );
  const copy = createPreparationShadowRecord(record);
  need(
    record.version === copy.version &&
      record.kind === copy.kind &&
      record.qualification === false &&
      record.reuseAuthorized === false &&
      record.recordDigest === copy.recordDigest,
    "RECORD_INTEGRITY",
  );
  return copy;
}

// Even exact local equivalence cannot replace native payload authentication,
// immutable receipt custody or external isolation. No caller boolean can supply
// any of those certificates. The existing preparation command always remains.
export function comparePreparationReuseShadow({ original, fresh, nativeOriginalProof, nativeInput }) {
  const prior = checked(original),
    current = checked(fresh);
  need(prior.prNumber === current.prNumber, "CROSS_PR_SCOPE");
  const inputDifferences = [];
  for (const name of ["baseSha", "candidateSha", "treeSha"])
    if (prior.source[name] !== current.source[name]) inputDifferences.push(`source.${name}`);
  for (const name of PREPARATION_FINGERPRINT_FIELDS)
    if (prior.fingerprints[name] !== current.fingerprints[name]) inputDifferences.push(`fingerprints.${name}`);
  const outputDifferences = Object.keys(prior.outputs)
    .filter((name) => prior.outputs[name] !== current.outputs[name])
    .sort();
  const authenticated = inspectNativeOriginalContext(nativeOriginalProof, nativeInput);
  const context = authenticated?.context;
  const originalContextAuthenticated = Boolean(
    context &&
      authenticated.acceptedBaseSha === current.source.baseSha &&
      context.jobKey === "experience-preparation" &&
      context.mode === "capture" &&
      context.prNumber === prior.prNumber &&
      context.baseSha === prior.source.baseSha &&
      context.candidateSha === prior.source.candidateSha &&
      context.runId === prior.producer.runId &&
      context.attempt === prior.producer.attempt,
  );
  const requiredCertificates = [
    ...(!originalContextAuthenticated ? ["NATIVE_ORIGINAL_PREPARATION_CONTEXT"] : []),
    "NATIVE_PREPARATION_PAYLOAD_AUTHENTICATION",
    "IMMUTABLE_PREPARATION_RECEIPT_CUSTODY",
    "EXTERNAL_RUNTIME_AND_INPUT_CLOSURE_ISOLATION",
    "NATIVE_CACHE_EQUIVALENCE_AND_ADVERSARIAL_TESTS",
  ];
  const body = {
    kind: "PREPARATION_REUSE_SHADOW_COMPARISON",
    originalRecordDigest: prior.recordDigest,
    freshRecordDigest: current.recordDigest,
    originalProducer: prior.producer,
    originalSource: prior.source,
    freshProducer: current.producer,
    freshSource: current.source,
    disposition: inputDifferences.length
      ? "CHANGED_INPUTS"
      : outputDifferences.length
        ? "MATCHING_INPUTS_DISTINCT_OUTPUTS"
        : "INPUT_AND_OUTPUT_EQUIVALENT_SHADOW",
    inputDifferences: inputDifferences.sort(),
    outputDifferences,
    originalContextAuthenticated,
    inputRecordsAuthenticated: false,
    requiredCertificates,
    action: "RUN_FRESH_PREPARATION",
    certificate: "NOT_ISSUED",
    qualification: false,
    reuseAuthorized: false,
  };
  return { ...body, comparisonDigest: digest(body) };
}
