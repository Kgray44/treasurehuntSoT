/* Attribute generated-state drift to a frozen candidate or its trusted base. */
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const sorted = (values) => [...new Set(values ?? [])].sort();
const glob = (pattern) =>
  new RegExp(
    `^${String(pattern)
      .replace(/[|\\{}()[\]^$+?.]/gu, "\\$&")
      .replace(/\*\*/gu, "::DOUBLE_STAR::")
      .replace(/\*/gu, "[^/]*")
      .replace(/::DOUBLE_STAR::/gu, ".*")}$`,
    "u",
  );
export const matches = (file, patterns) => (patterns ?? []).some((pattern) => glob(pattern).test(file));

const invalid = (message) => {
  throw new Error(`GENERATED_STATE_POLICY_INVALID:${message}`);
};

export function generatedStateDeclarations(policy) {
  const attribution = policy?.generatedStateAttribution;
  if (
    attribution?.mode !== "TRUSTED_DECLARATION_WITH_CANDIDATE_ATTRIBUTION" ||
    attribution?.preexistingUnrelatedDisposition !== "ASYNC_QUARANTINE_NONBLOCKING" ||
    attribution?.candidateAffectedDisposition !== "CANDIDATE_RECONCILIATION_REQUIRED" ||
    !Array.isArray(attribution?.records) ||
    !attribution.records.length
  )
    invalid("ATTRIBUTION_BOUNDARY");
  const ids = new Set();
  for (const record of attribution.records) {
    if (
      !record ||
      typeof record.id !== "string" ||
      !record.id ||
      ids.has(record.id) ||
      typeof record.generator !== "string" ||
      !record.generator ||
      !Array.isArray(record.outputPaths) ||
      !record.outputPaths.length ||
      record.outputPaths.some((value) => typeof value !== "string" || !value || value.includes("*")) ||
      !Array.isArray(record.semanticInputPathGlobs) ||
      !record.semanticInputPathGlobs.length ||
      (record.impactDisposition === "DERIVED_RECORD_ONLY" &&
        (typeof record.validator !== "string" || !record.validator)) ||
      !["SEMANTIC_GENERATED_STATE", "DERIVED_RECORD_ONLY"].includes(record.impactDisposition)
    )
      invalid(`RECORD:${record?.id ?? "missing"}`);
    ids.add(record.id);
    const nonSemantic = record.nonSemanticOutputPaths ?? [];
    if (
      !Array.isArray(nonSemantic) ||
      nonSemantic.some((value) => !record.outputPaths.includes(value)) ||
      (record.impactDisposition === "DERIVED_RECORD_ONLY" && !nonSemantic.length) ||
      (record.impactDisposition === "SEMANTIC_GENERATED_STATE" && nonSemantic.length)
    )
      invalid(`NON_SEMANTIC_OUTPUTS:${record.id}`);
  }
  return attribution.records.map((record) => ({
    ...record,
    outputPaths: sorted(record.outputPaths),
    semanticInputPathGlobs: sorted(record.semanticInputPathGlobs),
    nonSemanticOutputPaths: sorted(record.nonSemanticOutputPaths ?? []),
  }));
}

export function attributeGeneratedState({ policy, changedPaths = [], generatedDriftPaths = [] }) {
  const declarations = generatedStateDeclarations(policy);
  const changed = sorted(changedPaths);
  const drift = sorted(generatedDriftPaths);
  const errors = [];
  const records = declarations.map((declaration) => {
    const candidateInputPaths = changed.filter((file) => matches(file, declaration.semanticInputPathGlobs));
    const candidateOutputPaths = changed.filter((file) => declaration.outputPaths.includes(file));
    const observedGeneratedDriftPaths = drift.filter((file) => declaration.outputPaths.includes(file));
    const candidateAffected = candidateInputPaths.length > 0 || candidateOutputPaths.length > 0;
    const derivedRecordOnly = declaration.impactDisposition === "DERIVED_RECORD_ONLY";
    let disposition = "UNCHANGED";
    if (observedGeneratedDriftPaths.length)
      disposition = derivedRecordOnly
        ? "DERIVED_RECORD_RECONCILIATION"
        : candidateAffected
          ? "CANDIDATE_RECONCILIATION_REQUIRED"
          : "PREEXISTING_UNRELATED";
    else if (candidateAffected) disposition = "CANDIDATE_RECONCILED";
    if (disposition === "CANDIDATE_RECONCILIATION_REQUIRED")
      errors.push(`GENERATED_STATE_CANDIDATE_DRIFT:${declaration.id}:${observedGeneratedDriftPaths.join(",")}`);
    return {
      id: declaration.id,
      generator: declaration.generator,
      validator: declaration.validator ?? null,
      impactDisposition: declaration.impactDisposition,
      candidateInputPaths,
      candidateOutputPaths,
      generatedDriftPaths: observedGeneratedDriftPaths,
      disposition,
      handling:
        disposition === "PREEXISTING_UNRELATED" || disposition === "DERIVED_RECORD_RECONCILIATION"
          ? "ASYNC_QUARANTINE_NONBLOCKING"
          : disposition === "CANDIDATE_RECONCILIATION_REQUIRED"
            ? "BLOCK_CANDIDATE"
            : "NONE",
    };
  });
  const declaredOutputs = new Set(declarations.flatMap((record) => record.outputPaths));
  const undeclaredDriftPaths = drift.filter((file) => !declaredOutputs.has(file));
  if (undeclaredDriftPaths.length) errors.push(`GENERATED_STATE_UNDECLARED_DRIFT:${undeclaredDriftPaths.join(",")}`);
  return {
    kind: "GENERATED_STATE_ATTRIBUTION",
    schemaVersion: "1.0",
    changedPaths: changed,
    generatedDriftPaths: drift,
    nonSemanticChangedPaths: sorted(
      changed.filter((file) => declarations.some((record) => record.nonSemanticOutputPaths.includes(file))),
    ),
    records,
    errors: sorted(errors),
    status: errors.length ? "CANDIDATE_RECONCILIATION_REQUIRED" : "ATTRIBUTED",
  };
}

const option = (args, name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const git = async (root, ...args) => (await exec("git", ["-C", root, ...args])).stdout.trim();

async function main() {
  const args = process.argv.slice(2);
  const root = path.resolve(option(args, "--root") ?? process.cwd());
  const policyPath = option(args, "--policy");
  const baseSha = option(args, "--base");
  const candidateSha = option(args, "--candidate");
  const output = option(args, "--out");
  if (!policyPath || !baseSha || !candidateSha || !output)
    throw new Error("GENERATED_STATE_ATTRIBUTION_ARGUMENTS_REQUIRED");
  if (!/^[0-9a-f]{40}$/u.test(baseSha) || !/^[0-9a-f]{40}$/u.test(candidateSha))
    throw new Error("GENERATED_STATE_ATTRIBUTION_IDENTITY_INVALID");
  const policy = JSON.parse(await readFile(path.resolve(root, policyPath), "utf8"));
  const changedPaths = (await git(root, "diff", "--name-only", "--no-renames", baseSha, candidateSha))
    .split(/\r?\n/u)
    .filter(Boolean);
  const generatedDriftPaths = (await git(root, "diff", "--name-only", "--")).split(/\r?\n/u).filter(Boolean);
  const result = {
    ...attributeGeneratedState({ policy, changedPaths, generatedDriftPaths }),
    trustedBaseSha: baseSha,
    candidateSha,
  };
  await writeFile(path.resolve(root, output), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.errors.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
