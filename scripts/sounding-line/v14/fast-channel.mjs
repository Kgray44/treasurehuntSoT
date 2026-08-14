/*
 * Sounding Line v1.4 fast channel.  This module is deliberately additive:
 * callers may exercise it for v1.4 shadow qualification, but it has no v1.3
 * authority import and cannot emit RELEASE_GO.
 */
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  V14_AUTHORITY_BOUNDARY,
  V14_EVIDENCE_FINGERPRINT_VERSION,
  canonicalJson,
  canonicalize,
  createEvidenceLineage,
  digest,
  reconstructLegacyEvidence,
  validateCleanupManifest,
  verifyPreparedLayerManifest,
} from "./foundation.mjs";

export const V14_FAILURE_ROUTES = Object.freeze({
  STALE_EVIDENCE: "RUN_FRESH",
  FINGERPRINT_CHANGED: "RUN_FRESH",
  MISSING_IDENTITY: "CONSERVATIVE_EXPAND",
  CORRUPT_RECEIPT: "REJECT",
  CORRUPT_LAYER: "REJECT",
  UNTRUSTED_PRODUCER: "REJECT",
  AUTHORITY_VERSION_MISMATCH: "REJECT",
  POLICY_MISMATCH: "INVALIDATE",
  TEST_DEFINITION_MISMATCH: "RUN_FRESH",
  SCHEMA_MISMATCH: "RUN_FRESH",
  MIGRATION_MISMATCH: "RUN_FRESH",
  TOOLCHAIN_MISMATCH: "RUN_FRESH",
  EXPIRED_EVIDENCE: "RUN_FRESH",
  UNKNOWN_IMPACT: "CONSERVATIVE_EXPAND",
  MAPPING_DEBT: "CONSERVATIVE_EXPAND",
  CLEANUP_INCOMPLETE: "REJECT",
  DUPLICATE_PRODUCER: "REJECT",
  MISSING_PRODUCER: "REJECT",
  TREE_IDENTITY_MISMATCH: "REJECT",
});

export const typedFailure = (code) => ({ code, recovery: V14_FAILURE_ROUTES[code] ?? "REJECT" });

export const V14_RISK_FLOORS = Object.freeze([
  {
    id: "sounding-line",
    paths: ["scripts/sounding-line/**", ".github/workflows/**"],
    domains: ["authority"],
    suiteKinds: ["sounding-line", "static"],
  },
  {
    id: "security",
    paths: ["src/**/auth/**", "src/**/security/**"],
    domains: ["security", "authorization"],
    suiteKinds: ["auth", "privacy", "static"],
  },
  {
    id: "privacy",
    paths: ["src/**/private-content/**", "scripts/private-content/**"],
    domains: ["privacy"],
    suiteKinds: ["privacy", "static"],
  },
  {
    id: "persistence",
    paths: ["prisma/**", "**/migration.sql", "**/seed.*"],
    domains: ["schema", "migration", "seed"],
    suiteKinds: ["database", "migration", "static"],
  },
  {
    id: "identity",
    paths: ["src/**/identity/**", "src/**/account/**"],
    domains: ["identity"],
    suiteKinds: ["auth", "static"],
  },
  {
    id: "navigation",
    paths: ["src/app/**", "src/components/**/nav*"],
    domains: ["navigation", "access"],
    suiteKinds: ["navigation", "accessibility", "static", "build"],
  },
  {
    id: "build",
    paths: ["package.json", "package-lock.json", "next.config.*", "src/**"],
    domains: ["build"],
    suiteKinds: ["build", "static"],
  },
  { id: "accessibility", paths: ["src/**"], domains: ["accessibility"], suiteKinds: ["accessibility", "static"] },
]);

const validSha = (value) => typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);
const now = () => new Date().toISOString();
const recordId = (record) => record.id ?? digest(record).slice(0, 32);
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};
const glob = (pattern) =>
  new RegExp(
    `^${pattern
      .replace(/[|\\{}()[\]^$+?.]/gu, "\\$&")
      .replace(/\*\*/gu, "::DS::")
      .replace(/\*/gu, "[^/]*")
      .replace(/::DS::/gu, ".*")}$`,
    "u",
  );
const matches = (value, patterns) => patterns.some((pattern) => glob(pattern).test(value));
const sorted = (values) => [...new Set(values)].sort();

export function sealedRecord(kind, payload) {
  const unsigned = canonicalize({ version: V14_EVIDENCE_FINGERPRINT_VERSION, kind, immutable: true, ...payload });
  return { ...unsigned, digest: digest(unsigned) };
}

export async function contentManifestFromDirectory(root, relative = "") {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const records = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) records.push(...(await contentManifestFromDirectory(root, child)));
    else if (entry.isFile()) {
      const bytes = await readFile(path.join(root, child));
      records.push({
        path: child.replaceAll("\\", "/"),
        digest: createHash("sha256").update(bytes).digest("hex"),
        bytes: bytes.length,
      });
    }
  }
  return records;
}

export function verifySealedRecord(record, expectedKind = null) {
  if (!record || record.version !== V14_EVIDENCE_FINGERPRINT_VERSION || record.immutable !== true)
    return { valid: false, code: "CORRUPT_RECEIPT" };
  const { digest: observed, ...unsigned } = record;
  if (!observed || observed !== digest(unsigned)) return { valid: false, code: "CORRUPT_RECEIPT" };
  if (expectedKind && record.kind !== expectedKind) return { valid: false, code: "MISSING_IDENTITY" };
  return { valid: true };
}

export function validateLayerConsumption(
  manifest,
  { trustedProducers = [], platform = { os: process.platform, architecture: process.arch }, at = new Date() } = {},
) {
  if (!trustedProducers.includes(manifest?.producer)) return { valid: false, code: "UNTRUSTED_PRODUCER" };
  if (manifest?.securityScan?.status !== "CLEAN" || manifest?.revocationState !== "ACTIVE")
    return { valid: false, code: "CORRUPT_LAYER" };
  if (manifest?.retentionState?.expiresAt && new Date(manifest.retentionState.expiresAt) <= at)
    return { valid: false, code: "EXPIRED_EVIDENCE" };
  if (
    manifest?.consumerConstraints?.os !== platform.os ||
    manifest?.consumerConstraints?.architecture !== platform.architecture
  )
    return { valid: false, code: "TOOLCHAIN_MISMATCH" };
  return { valid: true };
}

/**
 * Future self-hosted workers may consume a portable layer, but never promote
 * evidence merely by presenting a cache hit.  This is an interface contract,
 * not an Option C deployment or a release decision.
 */
export function validateSelfHostedPreparedEvidence({ attestation, layerIdentity, runId, owner, approvedWorkers = [] }) {
  const invalid = (code) => ({ valid: false, code });
  if (!attestation || !approvedWorkers.includes(attestation.workerId)) return invalid("SELF_HOSTED_WORKER_UNAPPROVED");
  if (!/^[0-9a-f]{64}$/u.test(attestation.bootAttestationDigest ?? ""))
    return invalid("SELF_HOSTED_BOOT_ATTESTATION_REQUIRED");
  if (!/^[0-9a-f]{64}$/u.test(attestation.runtimeAttestationDigest ?? ""))
    return invalid("SELF_HOSTED_RUNTIME_ATTESTATION_REQUIRED");
  if (attestation.layerIdentity !== layerIdentity || attestation.layerMutable !== false)
    return invalid("SELF_HOSTED_LAYER_IDENTITY_INVALID");
  if (attestation.owner !== owner || attestation.workspace?.owner !== owner)
    return invalid("SELF_HOSTED_OWNER_MISMATCH");
  if (attestation.workspace?.runId !== runId || attestation.workspace?.runOwned !== true)
    return invalid("SELF_HOSTED_WORKSPACE_NOT_RUN_OWNED");
  if (
    attestation.scrub?.runId !== runId ||
    attestation.scrub?.owner !== owner ||
    attestation.scrub?.result !== "CLEAN" ||
    attestation.scrub?.finalState !== "ABSENT"
  )
    return invalid("SELF_HOSTED_SCRUB_PROOF_REQUIRED");
  if (attestation.staleState === true || attestation.tampered === true)
    return invalid(attestation.tampered === true ? "SELF_HOSTED_TAMPER_REJECTED" : "SELF_HOSTED_STALE_STATE_REJECTED");
  return { valid: true };
}

/** A deterministic JSON artifact store.  Writes use exclusive creation, so evidence is never mutable state. */
export class FileEvidenceStore {
  constructor(root) {
    this.root = root;
  }
  async #directory(kind) {
    const directory = path.join(this.root, kind);
    await mkdir(directory, { recursive: true });
    return directory;
  }
  async #write(kind, record) {
    const sealed = sealedRecord(kind, { ...record, id: recordId(record), createdAt: record.createdAt ?? now() });
    await writeFile(path.join(await this.#directory(kind), `${sealed.id}.json`), `${canonicalJson(sealed)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    return sealed;
  }
  writeFreshReceipt(receipt) {
    assert(
      receipt?.obligationId && receipt?.fingerprint && receipt?.producer && receipt?.planDigest,
      "MISSING_IDENTITY",
    );
    assert(receipt.authorityVersion === V14_EVIDENCE_FINGERPRINT_VERSION, "AUTHORITY_VERSION_MISMATCH");
    const body = { ...receipt };
    for (const field of ["version", "kind", "immutable", "digest", "createdAt"]) delete body[field];
    return this.#write("receipts", {
      ...body,
      disposition: receipt.disposition ?? "FRESH",
      current: receipt.current ?? true,
    });
  }
  async readReceipt(id) {
    return this.#read("receipts", id);
  }
  async #read(kind, id) {
    const parsed = JSON.parse(await readFile(path.join(this.root, kind, `${id}.json`), "utf8"));
    const check = verifySealedRecord(parsed, kind);
    if (!check.valid) throw new Error(check.code);
    return parsed;
  }
  async writeDerivation({
    originalReceiptId,
    currentReceiptId,
    priorFingerprint,
    currentFingerprint,
    decision,
    changedInterval,
  }) {
    const original = await this.readReceipt(originalReceiptId);
    if (currentReceiptId) await this.readReceipt(currentReceiptId);
    const lineage = createEvidenceLineage({
      originalReceiptId,
      priorFingerprint,
      currentFingerprint,
      decision,
      changedInterval,
    });
    return this.#write("derivations", {
      originalReceiptId,
      currentReceiptId,
      obligationId: original.obligationId,
      disposition: decision.disposition,
      lineage,
      current: true,
      supersedes: originalReceiptId,
    });
  }
  async deriveReceipt({ originalReceiptId, receipt, priorFingerprint, currentFingerprint, decision, changedInterval }) {
    const original = await this.readReceipt(originalReceiptId);
    assert(["PRESERVED", "REBOUND", "CONSERVATIVE_FALLBACK"].includes(decision?.disposition), "MISSING_IDENTITY");
    const derived = await this.writeFreshReceipt({
      ...original,
      ...receipt,
      id: receipt?.id,
      disposition: decision.disposition,
      originalReceiptId,
      fingerprint: currentFingerprint,
      current: true,
    });
    await this.writeDerivation({
      originalReceiptId,
      currentReceiptId: derived.id,
      priorFingerprint,
      currentFingerprint,
      decision,
      changedInterval,
    });
    return derived;
  }
  async readLineage(receiptId) {
    const derivations = await this.enumerate("derivations");
    const chain = derivations.filter(
      (entry) => entry.currentReceiptId === receiptId || entry.originalReceiptId === receiptId,
    );
    for (const entry of chain) {
      const original = await this.readReceipt(entry.originalReceiptId);
      assert(
        original.fingerprint?.fingerprintDigest === entry.lineage.priorFingerprintDigest ||
          entry.lineage.priorFingerprintDigest === null,
        "CORRUPT_RECEIPT",
      );
      const unsignedLineage = { ...entry.lineage };
      delete unsignedLineage.lineageDigest;
      assert(entry.lineage.lineageDigest === digest(unsignedLineage), "CORRUPT_RECEIPT");
    }
    return chain;
  }
  async enumerate(kind, predicate = () => true) {
    try {
      const entries = await readdir(path.join(this.root, kind));
      const records = await Promise.all(
        entries.filter((entry) => entry.endsWith(".json")).map((entry) => this.#read(kind, entry.slice(0, -5))),
      );
      return records.filter(predicate).sort((a, b) => a.id.localeCompare(b.id));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }
  async resolveCurrentProducer(obligationId, identity) {
    const receipts = await this.enumerate(
      "receipts",
      (entry) =>
        entry.obligationId === obligationId &&
        entry.current !== false &&
        ["FRESH", "PRESERVED", "REBOUND", "CONSERVATIVE_FALLBACK"].includes(entry.disposition),
    );
    const superseded = new Set(
      (await this.enumerate("derivations", (entry) => entry.current === true)).map((entry) => entry.supersedes),
    );
    const compatible = receipts.filter(
      (entry) =>
        !superseded.has(entry.id) &&
        entry.candidateSha === identity.candidateSha &&
        entry.gate === identity.gate &&
        entry.policyDigest === identity.policyDigest &&
        entry.fingerprint?.fingerprintDigest === identity.fingerprintDigest,
    );
    if (!compatible.length) throw new Error("MISSING_PRODUCER");
    if (compatible.length !== 1) throw new Error("DUPLICATE_PRODUCER");
    return compatible[0];
  }
  async exportBundle(obligationIds) {
    const receipts = await this.enumerate("receipts", (entry) => obligationIds.includes(entry.obligationId));
    return sealedRecord("bundle", { receipts, bundleDigest: digest(receipts) });
  }
  async importBundle(bundle) {
    const check = verifySealedRecord(bundle, "bundle");
    assert(check.valid && bundle.bundleDigest === digest(bundle.receipts), "CORRUPT_RECEIPT");
    return Promise.all(bundle.receipts.map((receipt) => this.writeFreshReceipt({ ...receipt, current: false })));
  }
}

export function selectV14Mainline({
  changedPaths,
  suites,
  changedContracts = [],
  mappingDebt = [],
  impact = {},
  requiredSuiteIds = [],
  conditionalSuiteIds = [],
  recordOnly = false,
  identity = {},
  policyDigest = null,
  inventoryDigest = null,
}) {
  const selectedByFloor = new Map();
  const rules = recordOnly
    ? []
    : V14_RISK_FLOORS.filter((rule) => changedPaths.some((changed) => matches(changed, rule.paths)));
  for (const rule of rules)
    for (const suite of suites)
      if (
        rule.suiteKinds.some(
          (kind) => suite.id.includes(kind) || suite.domains?.some((domain) => rule.domains.includes(domain)),
        )
      )
        selectedByFloor.set(suite.id, rule.id);
  const unknown =
    changedPaths.some((changed) => !impact.pathMappings?.some((mapping) => matches(changed, [mapping.path]))) ||
    changedContracts.some((id) => !impact.contractMappings?.some((mapping) => mapping.contractId === id)) ||
    mappingDebt.some((debt) => changedContracts.includes(debt.contractId));
  const directlyAffected = new Set();
  for (const mapping of impact.pathMappings ?? [])
    if (changedPaths.some((changed) => matches(changed, [mapping.path])))
      for (const id of mapping.suiteIds ?? []) directlyAffected.add(id);
  for (const mapping of impact.contractMappings ?? [])
    if (changedContracts.includes(mapping.contractId))
      for (const id of mapping.suiteIds ?? []) directlyAffected.add(id);
  const candidates = unknown
    ? new Set(suites.map((suite) => suite.id))
    : new Set([...requiredSuiteIds, ...directlyAffected, ...selectedByFloor.keys()]);
  const ledger = suites
    .filter((suite) => conditionalSuiteIds.includes(suite.id))
    .map((suite) => ({
      suiteId: suite.id,
      selected: candidates.has(suite.id),
      selectionReason: unknown
        ? "CONSERVATIVE_FALLBACK"
        : selectedByFloor.has(suite.id)
          ? `RISK_FLOOR:${selectedByFloor.get(suite.id)}`
          : directlyAffected.has(suite.id)
            ? "SEMANTIC_IMPACT"
            : "SEMANTICALLY_UNCHANGED",
      affectedContracts: sorted(changedContracts),
      affectedPaths: sorted(changedPaths),
      closureConfidence: unknown ? "UNKNOWN" : "EXACT",
      evidenceDisposition: candidates.has(suite.id) ? (unknown ? "CONSERVATIVE_FALLBACK" : "FRESH") : "PRESERVED",
      debt: unknown
        ? mappingDebt
            .filter((debt) => changedContracts.includes(debt.contractId))
            .map((debt) => ({ id: debt.contractId, owner: debt.owner }))
        : [],
    }));
  const suiteById = new Map(suites.map((suite) => [suite.id, suite]));
  const visiting = new Set();
  const includeDependencies = (suiteId) => {
    if (visiting.has(suiteId)) throw new Error(`V14_SUITE_DEPENDENCY_CYCLE:${suiteId}`);
    const suite = suiteById.get(suiteId);
    if (!suite) throw new Error(`V14_UNKNOWN_SUITE:${suiteId}`);
    visiting.add(suiteId);
    for (const dependency of suite.dependencies ?? []) {
      candidates.add(dependency);
      includeDependencies(dependency);
    }
    visiting.delete(suiteId);
  };
  for (const suiteId of [...candidates]) includeDependencies(suiteId);
  const selectedSuiteIds = sorted([...candidates]);
  const nodes = suites
    .filter((suite) => candidates.has(suite.id))
    .map((suite) => ({
      id: suite.id,
      dependencies: (suite.dependencies ?? []).filter((dependency) => candidates.has(dependency)),
      adapter: suite.adapter ?? null,
      resources: suite.resources ?? [],
      preparedLayers: suite.preparedLayers ?? [],
      execution: { mode: "parallel", wave: 0 },
    }));
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const waveFor = (node, chain = new Set()) => {
    if (node.execution.wave) return node.execution.wave;
    if (chain.has(node.id)) throw new Error(`V14_SUITE_DEPENDENCY_CYCLE:${node.id}`);
    chain.add(node.id);
    node.execution.wave = node.dependencies.length
      ? Math.max(...node.dependencies.map((dependency) => waveFor(nodesById.get(dependency), chain))) + 1
      : 0;
    chain.delete(node.id);
    return node.execution.wave;
  };
  for (const node of nodes) waveFor(node);
  return sealedRecord("plan", {
    authorityBoundary: V14_AUTHORITY_BOUNDARY,
    authorityVersion: V14_EVIDENCE_FINGERPRINT_VERSION,
    ...identity,
    policyDigest,
    inventoryDigest,
    changedInterval: {
      changedPaths: sorted(changedPaths),
      changedContracts: sorted(changedContracts),
      mappingDigest: digest(impact),
      riskRegistryDigest: digest(V14_RISK_FLOORS),
    },
    selectedSuiteIds,
    nodes,
    ledger,
    fallback: unknown
      ? { disposition: "CONSERVATIVE_FALLBACK", failure: mappingDebt.length ? "MAPPING_DEBT" : "UNKNOWN_IMPACT" }
      : null,
  });
}

export function closeReleaseCandidate({ mandatoryObligationIds, producers, unresolvedDebt = [] }) {
  const byObligation = new Map();
  for (const producer of producers) {
    const values = byObligation.get(producer.obligationId) ?? [];
    values.push(producer);
    byObligation.set(producer.obligationId, values);
  }
  const errors = unresolvedDebt.length ? ["MAPPING_DEBT"] : [];
  const ledger = mandatoryObligationIds.map((obligationId) => {
    const values = byObligation.get(obligationId) ?? [];
    if (!values.length) errors.push(`MISSING_PRODUCER:${obligationId}`);
    if (values.length > 1) errors.push(`DUPLICATE_PRODUCER:${obligationId}`);
    return { obligationId, producerIds: values.map((value) => value.id), closed: values.length === 1 };
  });
  const normalizedErrors = sorted(errors);
  return sealedRecord("release-closure", {
    exhaustive: true,
    ledger,
    decision: normalizedErrors.length ? "REJECT" : "QUALIFIED",
    errors: normalizedErrors,
    failureRoutes: normalizedErrors.map((entry) => typedFailure(entry.split(":")[0])),
  });
}

/** Finalization is a v1.4 shadow qualification result, never RELEASE_GO. */
export function finalizeV14({ plan, requiredObligationIds, producers, cleanup, runId }) {
  const errors = [];
  const planCheck = verifySealedRecord(plan, "plan");
  if (!planCheck.valid || plan.authorityBoundary !== V14_AUTHORITY_BOUNDARY) errors.push("AUTHORITY_VERSION_MISMATCH");
  const cleanupCheck = validateCleanupManifest(cleanup, { owner: runId });
  if (!cleanupCheck.valid) errors.push("CLEANUP_INCOMPLETE");
  const byObligation = new Map();
  for (const producer of producers ?? []) {
    const check = verifySealedRecord(producer, "receipts");
    if (!check.valid) {
      errors.push("CORRUPT_RECEIPT");
      continue;
    }
    if (
      producer.authorityVersion !== V14_EVIDENCE_FINGERPRINT_VERSION ||
      producer.planDigest !== plan?.digest ||
      producer.candidateSha !== plan?.candidateSha ||
      producer.policyDigest !== plan?.policyDigest
    )
      errors.push("MISSING_IDENTITY");
    const records = byObligation.get(producer.obligationId) ?? [];
    records.push(producer);
    byObligation.set(producer.obligationId, records);
  }
  const closure = (requiredObligationIds ?? []).map((obligationId) => {
    const records = byObligation.get(obligationId) ?? [];
    if (!records.length) errors.push("MISSING_PRODUCER");
    if (records.length > 1) errors.push("DUPLICATE_PRODUCER");
    return { obligationId, producerIds: records.map((record) => record.id), qualified: records.length === 1 };
  });
  const normalizedErrors = sorted(errors);
  return sealedRecord("finalization", {
    authorityBoundary: V14_AUTHORITY_BOUNDARY,
    authorityVersion: V14_EVIDENCE_FINGERPRINT_VERSION,
    planDigest: plan?.digest ?? null,
    runId,
    closure,
    decision: normalizedErrors.length ? "V14_QUALIFICATION_NO_GO" : "V14_QUALIFIED",
    errors: normalizedErrors,
    failureRoutes: normalizedErrors.map(typedFailure),
  });
}

export function validateV14Binding({ plan, finalization, evidence, cleanup, layers = [], trustedProducers = [] }) {
  const errors = [];
  const planCheck = verifySealedRecord(plan, "plan");
  if (!planCheck.valid || plan.authorityBoundary !== V14_AUTHORITY_BOUNDARY) errors.push("AUTHORITY_VERSION_MISMATCH");
  if (
    !finalization ||
    finalization.planDigest !== plan?.digest ||
    finalization.authorityVersion !== V14_EVIDENCE_FINGERPRINT_VERSION
  )
    errors.push("MISSING_IDENTITY");
  if (
    !validSha(plan?.candidateSha) ||
    !validSha(plan?.candidateTreeSha) ||
    !validSha(plan?.qualifiedBaseSha) ||
    !validSha(plan?.qualifiedBaseTreeSha)
  )
    errors.push("TREE_IDENTITY_MISMATCH");
  const cleanupCheck = validateCleanupManifest(cleanup, { owner: finalization?.runId });
  if (!cleanupCheck.valid) errors.push("CLEANUP_INCOMPLETE");
  for (const item of evidence ?? []) {
    const check = verifySealedRecord(item, "receipts");
    if (!check.valid || item.planDigest !== plan?.digest) errors.push("CORRUPT_RECEIPT");
  }
  for (const layer of layers) {
    const check = verifyPreparedLayerManifest(layer.manifest, layer.contentManifest);
    if (!check.valid) errors.push("CORRUPT_LAYER");
    if (!trustedProducers.includes(layer.manifest?.producer)) errors.push("UNTRUSTED_PRODUCER");
  }
  const normalizedErrors = sorted(errors);
  return sealedRecord("binding", {
    authorityBoundary: V14_AUTHORITY_BOUNDARY,
    decision: normalizedErrors.length ? "REJECT" : "QUALIFIED",
    errors: normalizedErrors,
    failureRoutes: normalizedErrors.map(typedFailure),
    heavyProofExecuted: false,
    bindingDigest: digest({ plan: plan?.digest, finalization, evidence: (evidence ?? []).map((item) => item.digest) }),
  });
}

export class FileLayerTransport {
  constructor(root, { trustedProducers = [], platform = { os: process.platform, architecture: process.arch } } = {}) {
    this.root = root;
    this.trustedProducers = new Set(trustedProducers);
    this.platform = platform;
  }
  async publish(manifest, sourceDirectory) {
    const consumption = validateLayerConsumption(manifest, {
      trustedProducers: [...this.trustedProducers],
      platform: this.platform,
    });
    assert(consumption.valid, consumption.code);
    assert(manifest?.mutable === false, "CORRUPT_LAYER");
    const observed = await contentManifestFromDirectory(sourceDirectory);
    const check = verifyPreparedLayerManifest(manifest, observed);
    assert(check.valid, check.reason ?? "CORRUPT_LAYER");
    const directory = path.join(this.root, manifest.identityDigest);
    await mkdir(directory, { recursive: true });
    await cp(sourceDirectory, path.join(directory, "content"), { recursive: true, force: false, errorOnExist: true });
    await writeFile(path.join(directory, "manifest.json"), `${canonicalJson(manifest)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    return {
      transport: "content-addressed-filesystem",
      identity: manifest.identityDigest,
      bytes: (await stat(path.join(directory, "manifest.json"))).size,
    };
  }
  async restore(identity, destination) {
    try {
      const directory = path.join(this.root, identity);
      const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
      const consumption = validateLayerConsumption(manifest, {
        trustedProducers: [...this.trustedProducers],
        platform: this.platform,
      });
      assert(consumption.valid, consumption.code);
      const source = path.join(directory, "content");
      const check = verifyPreparedLayerManifest(manifest, await contentManifestFromDirectory(source));
      assert(check.valid, check.reason ?? "CORRUPT_LAYER");
      await cp(source, destination, { recursive: true, force: false, errorOnExist: true });
      const restored = verifyPreparedLayerManifest(manifest, await contentManifestFromDirectory(destination));
      assert(restored.valid, restored.reason ?? "CORRUPT_LAYER");
      return { hit: true, manifest };
    } catch (error) {
      if (["ENOENT", "EEXIST"].includes(error.code)) return { hit: false, action: "NORMAL_GOVERNED_PREPARATION" };
      throw error;
    }
  }
}

export function prepareV14Worker({
  planNode,
  layers = [],
  restoreResults = [],
  runId,
  mutableResources = [],
  authorityBoundary = V14_AUTHORITY_BOUNDARY,
}) {
  assert(planNode?.id && runId, "MISSING_IDENTITY");
  assert(
    [V14_AUTHORITY_BOUNDARY, "CURRENT_AUTHORITATIVE_V14", "V14_CANDIDATE_QUALIFICATION"].includes(authorityBoundary),
    "V14_WORKER_AUTHORITY_BOUNDARY_REQUIRED",
  );
  const required = new Set(layers.map((layer) => layer.identity));
  const restored = new Set(
    restoreResults.filter((result) => result.hit).map((result) => result.manifest.identityDigest),
  );
  return sealedRecord("worker-preparation", {
    suiteId: planNode.id,
    runId,
    authorityBoundary,
    layerResults: layers.map((layer) => ({
      identity: layer.identity,
      hit: restored.has(layer.identity),
      action: restored.has(layer.identity) ? "RESTORE_VERIFIED_READ_ONLY" : "NORMAL_GOVERNED_PREPARATION",
    })),
    requiredLayerCount: required.size,
    mutableResources: mutableResources.map((resource) => ({ ...resource, leaseOwner: runId, runId, mutable: true })),
  });
}

export function importLegacyEvidence({ receipt, immutableFacts, currentFingerprint, compatibility }) {
  assert(
    compatibility?.v13AuthorityIdentity &&
      compatibility?.v14AuthorityIdentity &&
      compatibility?.suiteIdentity &&
      Array.isArray(compatibility.requiredReconstructedInputs),
    "MISSING_IDENTITY",
  );
  const result = reconstructLegacyEvidence({ receipt, immutableFacts, currentFingerprint });
  return sealedRecord("legacy-adoption", {
    compatibility,
    classification: result.classification,
    disposition: result.adoptionDisposition,
    reasonCodes: result.reasonCodes,
    requiredAction:
      result.classification === "RECONSTRUCTABLE"
        ? "ADOPT"
        : result.classification === "PARTIALLY_RECONSTRUCTABLE"
          ? "RUN_FRESH"
          : "CONSERVATIVE_EXPAND",
    fingerprint: result.fingerprint ?? null,
  });
}
