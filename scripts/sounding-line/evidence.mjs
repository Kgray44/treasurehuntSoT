/*
 * Thin Sounding Line v1.4 evidence primitives for the direct qualification
 * runner.  The store is deliberately file-backed and additive: an absent,
 * unreadable, or incompatible store always means run the obligation fresh.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const EVIDENCE_VERSION = "1.4";
export const EVIDENCE_DISPOSITIONS = Object.freeze([
  "FRESH",
  "PRESERVED",
  "REBOUND",
  "INVALIDATED",
  "CONSERVATIVE_FALLBACK",
]);

const fingerprintFields = Object.freeze([
  "obligationId",
  "qualificationMode",
  "commandDigest",
  "semanticClosureDigest",
  "semanticClosureMembers",
  "testDefinitionDigest",
  "fixtureDigest",
  "schemaDigest",
  "packageLockDigest",
  "toolchainIdentity",
  "browserIdentity",
  "environmentClass",
  "soundingLinePolicyDigest",
  "authorityIdentity",
  "inapplicableDependencyClasses",
]);

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isObject(value))
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  return value;
}

export const canonicalJson = (value) => JSON.stringify(canonicalize(value));
export const digest = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : canonicalJson(value))
    .digest("hex");

export function digestFileEntries(entries = []) {
  return digest(
    entries
      .map((entry) => ({ path: entry.path.replaceAll("\\", "/"), blob: entry.blob ?? entry.digest ?? null }))
      .sort((left, right) => left.path.localeCompare(right.path)),
  );
}

export function createEvidenceFingerprint(input) {
  const missing = fingerprintFields.filter((field) => input[field] === undefined);
  if (missing.length) throw new Error(`SOUNDING_LINE_EVIDENCE_FINGERPRINT_FIELD_MISSING:${missing.join(",")}`);
  if (
    !input.obligationId ||
    !input.commandDigest ||
    !input.semanticClosureDigest ||
    !Array.isArray(input.semanticClosureMembers)
  )
    throw new Error("SOUNDING_LINE_EVIDENCE_FINGERPRINT_IDENTITY_INVALID");
  if (!Array.isArray(input.inapplicableDependencyClasses))
    throw new Error("SOUNDING_LINE_EVIDENCE_FINGERPRINT_INAPPLICABILITY_INVALID");
  const optional = new Set(input.inapplicableDependencyClasses);
  for (const field of ["fixtureDigest", "schemaDigest", "browserIdentity"]) {
    if (input[field] === null && !optional.has(field))
      throw new Error(`SOUNDING_LINE_EVIDENCE_FINGERPRINT_INAPPLICABILITY_UNEXPLAINED:${field}`);
  }
  const fingerprint = {
    version: EVIDENCE_VERSION,
    ...Object.fromEntries(fingerprintFields.map((field) => [field, input[field]])),
    semanticClosureMembers: [...new Set(input.semanticClosureMembers)].sort(),
    inapplicableDependencyClasses: [...new Set(input.inapplicableDependencyClasses)].sort(),
  };
  return { ...canonicalize(fingerprint), fingerprintDigest: digest(fingerprint) };
}

export function compareEvidenceFingerprints({ prior, current, priorReceiptId = null, corruption = false }) {
  if (corruption) return { disposition: "CONSERVATIVE_FALLBACK", reasonCodes: ["EVIDENCE_INTEGRITY_FAILURE"] };
  if (!prior) return { disposition: "FRESH", reasonCodes: ["NO_REUSABLE_EVIDENCE"] };
  if (!current) return { disposition: "CONSERVATIVE_FALLBACK", reasonCodes: ["FINGERPRINT_UNAVAILABLE"] };
  if (prior.version !== EVIDENCE_VERSION || current.version !== EVIDENCE_VERSION)
    return { disposition: "CONSERVATIVE_FALLBACK", reasonCodes: ["FINGERPRINT_VERSION_INCOMPATIBLE"] };
  const changedFields = fingerprintFields.filter(
    (field) => canonicalJson(prior[field]) !== canonicalJson(current[field]),
  );
  if (changedFields.length)
    return {
      disposition: "INVALIDATED",
      reasonCodes: ["FINGERPRINT_FIELD_CHANGED"],
      changedFields,
      priorReceiptId,
    };
  return {
    disposition: "PRESERVED",
    reasonCodes: ["SEMANTIC_FINGERPRINT_MATCH"],
    changedFields: [],
    priorReceiptId,
  };
}

export function verifyReceipt(receipt) {
  if (
    !receipt ||
    receipt.version !== EVIDENCE_VERSION ||
    receipt.kind !== "sounding-line-evidence-receipt" ||
    receipt.immutable !== true ||
    !receipt.id ||
    !/^[a-f0-9]{40}$/u.test(receipt.candidateSha ?? "") ||
    !receipt.obligationId ||
    !EVIDENCE_DISPOSITIONS.includes(receipt.disposition) ||
    receipt.result !== "PASSED" ||
    receipt.fingerprint?.version !== EVIDENCE_VERSION ||
    !receipt.fingerprint?.fingerprintDigest
  )
    return { valid: false, code: "CORRUPT_RECEIPT" };
  const { receiptDigest: observed, ...unsigned } = receipt;
  if (!observed || observed !== digest(unsigned)) return { valid: false, code: "CORRUPT_RECEIPT" };
  return { valid: true };
}

function receiptIdentity({ candidateSha, obligationId, fingerprint, disposition, originalReceiptId = null }) {
  return digest({
    candidateSha,
    obligationId,
    fingerprintDigest: fingerprint.fingerprintDigest,
    disposition,
    originalReceiptId,
  });
}

function sealedReceipt(payload) {
  const identity = receiptIdentity(payload);
  const unsigned = canonicalize({
    version: EVIDENCE_VERSION,
    kind: "sounding-line-evidence-receipt",
    immutable: true,
    id: `sl14-${identity.slice(0, 32)}`,
    ...payload,
  });
  return { ...unsigned, receiptDigest: digest(unsigned) };
}

export class FileEvidenceStore {
  constructor(root) {
    this.root = root;
  }

  receiptsRoot() {
    return path.join(this.root, "receipts");
  }

  async readAll() {
    try {
      const entries = await readdir(this.receiptsRoot());
      const records = [];
      const corruptions = [];
      for (const entry of entries.filter((name) => name.endsWith(".json")).sort()) {
        try {
          const receipt = JSON.parse(await readFile(path.join(this.receiptsRoot(), entry), "utf8"));
          const check = verifyReceipt(receipt);
          if (!check.valid)
            corruptions.push({ file: entry, code: check.code, obligationId: receipt?.obligationId ?? null });
          else records.push(receipt);
        } catch {
          corruptions.push({ file: entry, code: "CORRUPT_RECEIPT", obligationId: null });
        }
      }
      return { records, corruptions };
    } catch (error) {
      if (error?.code === "ENOENT") return { records: [], corruptions: [] };
      throw error;
    }
  }

  async findReusable({ obligationId, candidateSha, fingerprint }) {
    const { records, corruptions } = await this.readAll();
    const obligationCorruption = corruptions.filter(
      (entry) => entry.obligationId === null || entry.obligationId === obligationId,
    );
    if (obligationCorruption.length)
      return {
        ...compareEvidenceFingerprints({ current: fingerprint, corruption: true }),
        receipt: null,
        corruptions: obligationCorruption,
      };
    const candidates = records
      .filter(
        (receipt) =>
          receipt.obligationId === obligationId &&
          receipt.result === "PASSED" &&
          receipt.authorityVersion === EVIDENCE_VERSION &&
          receipt.fingerprint,
      )
      .sort((left, right) => left.id.localeCompare(right.id));
    const exact = candidates.filter(
      (receipt) => receipt.fingerprint.fingerprintDigest === fingerprint.fingerprintDigest,
    );
    if (exact.length) {
      const receipt = exact.find((entry) => entry.candidateSha === candidateSha) ?? exact.at(-1);
      return {
        ...compareEvidenceFingerprints({
          prior: receipt.fingerprint,
          current: fingerprint,
          priorReceiptId: receipt.id,
        }),
        disposition: receipt.candidateSha === candidateSha ? "PRESERVED" : "REBOUND",
        reasonCodes: [
          receipt.candidateSha === candidateSha ? "SEMANTIC_FINGERPRINT_MATCH" : "SEMANTIC_FINGERPRINT_REBOUND",
        ],
        receipt,
        corruptions: [],
      };
    }
    const prior = candidates.at(-1) ?? null;
    return {
      ...compareEvidenceFingerprints({
        prior: prior?.fingerprint ?? null,
        current: fingerprint,
        priorReceiptId: prior?.id ?? null,
      }),
      receipt: null,
      corruptions: [],
    };
  }

  async write(receipt) {
    const check = verifyReceipt(receipt);
    if (!check.valid) throw new Error(`SOUNDING_LINE_EVIDENCE_${check.code}`);
    await mkdir(this.receiptsRoot(), { recursive: true });
    const target = path.join(this.receiptsRoot(), `${receipt.id}.json`);
    try {
      await writeFile(target, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
      return receipt;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const existing = JSON.parse(await readFile(target, "utf8"));
      const existingCheck = verifyReceipt(existing);
      const sameSemanticIdentity =
        existing.candidateSha === receipt.candidateSha &&
        existing.obligationId === receipt.obligationId &&
        existing.fingerprint?.fingerprintDigest === receipt.fingerprint?.fingerprintDigest &&
        existing.disposition === receipt.disposition &&
        existing.originalReceiptId === receipt.originalReceiptId;
      if (!existingCheck.valid || !sameSemanticIdentity) throw new Error("SOUNDING_LINE_EVIDENCE_RECEIPT_ID_COLLISION");
      return existing;
    }
  }

  async writeFresh({ candidateSha, obligationId, fingerprint, planDigest, commands, durationMs }) {
    return this.write(
      sealedReceipt({
        candidateSha,
        obligationId,
        fingerprint,
        planDigest,
        commands,
        durationMs,
        authorityVersion: EVIDENCE_VERSION,
        producer: "SOUNDING_LINE_DIRECT",
        result: "PASSED",
        disposition: "FRESH",
        originalReceiptId: null,
      }),
    );
  }

  async rebind({ sourceReceipt, candidateSha, obligationId, fingerprint, planDigest, commands, decision }) {
    const sourceCheck = verifyReceipt(sourceReceipt);
    if (!sourceCheck.valid || sourceReceipt.result !== "PASSED")
      throw new Error("SOUNDING_LINE_EVIDENCE_CORRUPT_RECEIPT");
    return this.write(
      sealedReceipt({
        candidateSha,
        obligationId,
        fingerprint,
        planDigest,
        commands,
        durationMs: sourceReceipt.durationMs ?? null,
        authorityVersion: EVIDENCE_VERSION,
        producer: "SOUNDING_LINE_DIRECT",
        result: "PASSED",
        disposition: decision.disposition,
        originalReceiptId: sourceReceipt.id,
        lineage: canonicalize({
          version: EVIDENCE_VERSION,
          immutable: true,
          originalReceiptId: sourceReceipt.id,
          priorFingerprintDigest: sourceReceipt.fingerprint.fingerprintDigest,
          currentFingerprintDigest: fingerprint.fingerprintDigest,
          disposition: decision.disposition,
          reasonCodes: decision.reasonCodes,
          lineageDigest: digest({
            originalReceiptId: sourceReceipt.id,
            priorFingerprintDigest: sourceReceipt.fingerprint.fingerprintDigest,
            currentFingerprintDigest: fingerprint.fingerprintDigest,
            disposition: decision.disposition,
          }),
        }),
      }),
    );
  }
}

export function finalizeEvidence({ candidateSha, obligations, receipts, reconciliations }) {
  const errors = [];
  const byObligation = new Map();
  for (const receipt of receipts) {
    const check = verifyReceipt(receipt);
    if (!check.valid) {
      errors.push(`${check.code}:${receipt?.id ?? "unknown"}`);
      continue;
    }
    const values = byObligation.get(receipt.obligationId) ?? [];
    values.push(receipt);
    byObligation.set(receipt.obligationId, values);
  }
  const closure = obligations.map((obligation) => {
    const values = byObligation.get(obligation.id) ?? [];
    if (values.length !== 1)
      errors.push(`${values.length ? "DUPLICATE" : "MISSING"}_OBLIGATION_RECEIPT:${obligation.id}`);
    const receipt = values[0] ?? null;
    if (receipt && receipt.candidateSha !== candidateSha) errors.push(`CANDIDATE_BINDING_INVALID:${obligation.id}`);
    if (receipt && receipt.fingerprint?.fingerprintDigest !== obligation.fingerprint.fingerprintDigest)
      errors.push(`FINGERPRINT_INVALID:${obligation.id}`);
    if (receipt && receipt.result !== "PASSED") errors.push(`RESULT_INVALID:${obligation.id}`);
    return {
      obligationId: obligation.id,
      receiptId: receipt?.id ?? null,
      satisfied: Boolean(receipt) && receipt?.candidateSha === candidateSha && receipt?.result === "PASSED",
    };
  });
  const required = new Set(obligations.map((obligation) => obligation.id));
  for (const receipt of receipts)
    if (!required.has(receipt.obligationId)) errors.push(`UNKNOWN_OBLIGATION_RECEIPT:${receipt.obligationId}`);
  const counts = reconciliations.reduce(
    (total, entry) => ({ ...total, [entry.disposition]: (total[entry.disposition] ?? 0) + 1 }),
    { FRESH: 0, PRESERVED: 0, REBOUND: 0, INVALIDATED: 0, CONSERVATIVE_FALLBACK: 0 },
  );
  return {
    authority: "SOUNDING_LINE_EVIDENCE_FINALIZER",
    requiredObligations: obligations.length,
    closure,
    remainder: closure.filter((entry) => !entry.satisfied).map((entry) => entry.obligationId),
    counts,
    errors,
    decision: errors.length || closure.some((entry) => !entry.satisfied) ? "EVIDENCE_INVALID" : "PASS",
  };
}
