import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const HANDOFF_VERSION = 1;
export const STATES = ["ACTIVE", "READY", "WAITING", "CONFLICT", "BLOCKED", "MERGED"];

const stateSet = new Set(STATES);
const shaPattern = /^[0-9a-f]{7,64}$/iu;

function fail(code) {
  throw new Error(`PARALLEL_COORDINATOR_${code}`);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringField(value, name) {
  if (typeof value !== "string" || !value.trim()) fail(`HANDOFF_${name}_INVALID`);
  return value.trim();
}

function shaField(value, name) {
  const sha = stringField(value, name).toLowerCase();
  if (!shaPattern.test(sha)) fail(`HANDOFF_${name}_INVALID`);
  return sha;
}

function stringList(value, name, normalize = (item) => item) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail(`HANDOFF_${name}_INVALID`);
  const values = value.map((item) => normalize(stringField(item, name)));
  return [...new Set(values)].sort();
}

export function normalizePath(value) {
  const normalized = stringField(value, "PATH")
    .replace(/\\/gu, "/")
    .replace(/^\.\/+|\/+$/gu, "");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    /^[a-z]:/iu.test(normalized) ||
    normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")
  )
    fail("HANDOFF_PATH_INVALID");
  return normalized;
}

function normalizeToken(value) {
  const normalized = stringField(value, "TOKEN").toLowerCase();
  if (/\s/iu.test(normalized)) fail("HANDOFF_TOKEN_INVALID");
  return normalized;
}

function normalizePr(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) fail(`HANDOFF_${name}_INVALID`);
  return value;
}

export function validateHandoff(value, source = "handoff") {
  if (!isRecord(value)) fail("HANDOFF_INVALID");
  if (value.version !== HANDOFF_VERSION) fail("HANDOFF_VERSION_INVALID");
  const handoff = {
    version: HANDOFF_VERSION,
    project: stringField(value.project, "PROJECT"),
    pr: normalizePr(value.pr, "PR"),
    candidateSha: shaField(value.candidateSha, "CANDIDATE_SHA"),
    baseSha: shaField(value.baseSha, "BASE_SHA"),
    status: stringField(value.status, "STATUS").toUpperCase(),
    touches: stringList(value.touches, "TOUCHES", normalizeToken),
    paths: stringList(value.paths, "PATHS", normalizePath),
    migrationFamilies: stringList(value.migrationFamilies, "MIGRATION_FAMILIES", normalizeToken),
    dependencies: [],
    source,
  };
  if (!stateSet.has(handoff.status)) fail("HANDOFF_STATUS_INVALID");
  if (value.dependencies !== undefined && !Array.isArray(value.dependencies)) fail("HANDOFF_DEPENDENCIES_INVALID");
  handoff.dependencies = [...new Set((value.dependencies ?? []).map((pr) => normalizePr(pr, "DEPENDENCIES")))].sort(
    (left, right) => left - right,
  );
  if (handoff.dependencies.includes(handoff.pr)) fail("HANDOFF_DEPENDENCY_SELF_REFERENTIAL");
  if (value.readyAt !== undefined) {
    const readyAt = stringField(value.readyAt, "READY_AT");
    if (Number.isNaN(Date.parse(readyAt))) fail("HANDOFF_READY_AT_INVALID");
    handoff.readyAt = new Date(readyAt).toISOString();
  }
  return handoff;
}

export async function discoverHandoffs(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return [];
    throw error;
  }
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
  const handoffs = await Promise.all(
    files.map(async (file) => {
      const source = path.join(directory, file);
      let parsed;
      try {
        parsed = JSON.parse(await readFile(source, "utf8"));
      } catch {
        fail(`HANDOFF_JSON_INVALID:${file}`);
      }
      return validateHandoff(parsed, source);
    }),
  );
  const seenPrs = new Set();
  const seenCandidates = new Set();
  for (const handoff of handoffs) {
    if (seenPrs.has(handoff.pr)) fail(`HANDOFF_PR_DUPLICATE:${handoff.pr}`);
    if (seenCandidates.has(handoff.candidateSha)) fail(`HANDOFF_CANDIDATE_SHA_DUPLICATE:${handoff.candidateSha}`);
    seenPrs.add(handoff.pr);
    seenCandidates.add(handoff.candidateSha);
  }
  return handoffs;
}

export function pathsOverlap(left, right) {
  const first = normalizePath(left);
  const second = normalizePath(right);
  return first === second || first.startsWith(`${second}/`) || second.startsWith(`${first}/`);
}

function shared(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

export function overlapBetween(left, right) {
  const paths = [];
  for (const leftPath of left.paths)
    for (const rightPath of right.paths) if (pathsOverlap(leftPath, rightPath)) paths.push(`${leftPath}~${rightPath}`);
  return {
    paths: [...new Set(paths)].sort(),
    touches: shared(left.touches, right.touches),
    migrationFamilies: shared(left.migrationFamilies, right.migrationFamilies),
  };
}

function hasCoordinationMetadata(handoff) {
  return Boolean(handoff.paths.length || handoff.touches.length || handoff.migrationFamilies.length);
}

function readyRank(left, right) {
  const leftDate = left.readyAt ? Date.parse(left.readyAt) : Number.POSITIVE_INFINITY;
  const rightDate = right.readyAt ? Date.parse(right.readyAt) : Number.POSITIVE_INFINITY;
  if (leftDate !== rightDate) return leftDate - rightDate;
  return left.pr - right.pr;
}

function setState(candidate, state, reason) {
  candidate.state = state;
  if (reason && !candidate.reasons.includes(reason)) candidate.reasons.push(reason);
}

function applyPrStates(candidates, prStates) {
  for (const candidate of candidates) {
    const prState = prStates?.[candidate.handoff.pr];
    if (prState?.state === "MERGED") setState(candidate, "MERGED", "PR_MERGED");
    if (prState?.state === "CLOSED") setState(candidate, "BLOCKED", "PR_CLOSED");
  }
}

function applyDependencies(candidates, byPr) {
  for (let pass = 0; pass < candidates.length; pass += 1) {
    let changed = false;
    for (const candidate of candidates) {
      if (candidate.state !== "READY") continue;
      for (const dependencyPr of candidate.handoff.dependencies) {
        const dependency = byPr.get(dependencyPr);
        if (!dependency) {
          setState(candidate, "BLOCKED", `DEPENDENCY_NOT_FOUND:PR#${dependencyPr}`);
          changed = true;
          break;
        }
        if (dependency.state === "MERGED") continue;
        setState(candidate, "WAITING", `DEPENDENCY_PENDING:PR#${dependencyPr}`);
        changed = true;
        break;
      }
    }
    if (!changed) return;
  }
}

function applyOverlapSerialization(candidates) {
  const ready = candidates
    .filter((candidate) => candidate.state === "READY")
    .sort((left, right) => readyRank(left.handoff, right.handoff));
  for (let index = 0; index < ready.length; index += 1) {
    const earlier = ready[index];
    for (const later of ready.slice(index + 1)) {
      if (later.state !== "READY") continue;
      const overlap = overlapBetween(earlier.handoff, later.handoff);
      if (overlap.migrationFamilies.length) {
        setState(
          later,
          "WAITING",
          `MIGRATION_FAMILY_SERIALIZED:${overlap.migrationFamilies.join(",")}:PR#${earlier.handoff.pr}`,
        );
      } else if (overlap.paths.length || overlap.touches.length) {
        const category = overlap.paths.length ? "PATH_OVERLAP" : "DOMAIN_OVERLAP";
        setState(later, "WAITING", `${category}:PR#${earlier.handoff.pr}`);
      }
    }
  }
}

function snapshot(candidate) {
  return {
    project: candidate.handoff.project,
    pr: candidate.handoff.pr,
    candidateSha: candidate.handoff.candidateSha,
    baseSha: candidate.handoff.baseSha,
    state: candidate.state,
    reasons: [...candidate.reasons].sort(),
  };
}

export function coordinate({ handoffs, mainSha = null, prStates = {} }) {
  const candidates = handoffs.map((handoff) => ({ handoff, state: handoff.status, reasons: [] }));
  const byPr = new Map(candidates.map((candidate) => [candidate.handoff.pr, candidate]));
  applyPrStates(candidates, prStates);
  for (const candidate of candidates)
    if (candidate.state === "READY" && !hasCoordinationMetadata(candidate.handoff))
      setState(candidate, "CONFLICT", "INSUFFICIENT_COORDINATION_METADATA");
  applyDependencies(candidates, byPr);
  applyOverlapSerialization(candidates);
  applyDependencies(candidates, byPr);
  const order = candidates
    .filter((candidate) => candidate.state === "READY")
    .sort((left, right) => readyRank(left.handoff, right.handoff))
    .map(snapshot);
  return {
    version: HANDOFF_VERSION,
    protectedMain: mainSha,
    readyOrder: order,
    candidates: candidates.map(snapshot).sort((left, right) => left.pr - right.pr),
  };
}

export function materiallyAffected({ merged, candidate, mergedPaths = [] }) {
  const reasons = [];
  const changedPaths = mergedPaths.map(normalizePath);
  if (
    changedPaths.some((changedPath) =>
      candidate.paths.some((candidatePath) => pathsOverlap(changedPath, candidatePath)),
    )
  )
    reasons.push("PATH_OVERLAP");
  if (merged) {
    if (shared(merged.touches, candidate.touches).length) reasons.push("DOMAIN_OVERLAP");
    if (shared(merged.migrationFamilies, candidate.migrationFamilies).length) reasons.push("MIGRATION_FAMILY_OVERLAP");
    if (candidate.dependencies.includes(merged.pr)) reasons.push(`EXPLICIT_DEPENDENCY:PR#${merged.pr}`);
  }
  return [...new Set(reasons)].sort();
}

export function evaluateAfterMerge({
  handoffs,
  mergeSha,
  mergedPaths,
  mergedPr = null,
  mainSha = null,
  prStates = {},
}) {
  if (!shaPattern.test(stringField(mergeSha, "MERGE_SHA"))) fail("MERGE_SHA_INVALID");
  const effectivePrStates = { ...prStates };
  if (mergedPr !== null)
    effectivePrStates[normalizePr(mergedPr, "MERGED_PR")] = { state: "MERGED", mergeCommit: mergeSha };
  const result = coordinate({ handoffs, mainSha, prStates: effectivePrStates });
  const byPr = new Map(handoffs.map((handoff) => [handoff.pr, handoff]));
  const merged =
    (mergedPr !== null ? byPr.get(mergedPr) : null) ??
    handoffs.find((handoff) => handoff.candidateSha === mergeSha.toLowerCase()) ??
    handoffs.find((handoff) => prStates?.[handoff.pr]?.mergeCommit?.toLowerCase() === mergeSha.toLowerCase()) ??
    null;
  const affected = [];
  const unaffected = [];
  for (const candidate of result.candidates) {
    if (candidate.pr === merged?.pr || candidate.state !== "READY") continue;
    const reasons = materiallyAffected({ merged, candidate: byPr.get(candidate.pr), mergedPaths });
    if (reasons.length) {
      candidate.state = "WAITING";
      candidate.reasons = [...new Set([...candidate.reasons, "RECONCILIATION_REQUIRED", ...reasons])].sort();
      affected.push({ pr: candidate.pr, project: candidate.project, reasons });
    } else {
      unaffected.push({ pr: candidate.pr, project: candidate.project, reason: "NO_RECONCILIATION_REQUIRED" });
    }
  }
  result.readyOrder = result.candidates
    .filter((candidate) => candidate.state === "READY")
    .sort((left, right) => readyRank(byPr.get(left.pr), byPr.get(right.pr)));
  return { ...result, mergeSha: mergeSha.toLowerCase(), mergedPr: merged?.pr ?? null, affected, unaffected };
}

function runGit(root, argumentsList) {
  return execFileSync("git", argumentsList, { cwd: root, encoding: "utf8" }).trim();
}

export function readCurrentMain(root) {
  return runGit(root, ["rev-parse", "origin/main"]);
}

export function readMergePaths(root, mergeSha) {
  return runGit(root, ["diff", "--name-only", `${mergeSha}^1`, mergeSha])
    .split(/\r?\n/gu)
    .filter(Boolean)
    .map(normalizePath);
}

export function readPrStates(root, handoffs) {
  const states = {};
  try {
    for (const handoff of handoffs) {
      const response = execFileSync(
        "gh",
        ["pr", "view", String(handoff.pr), "--json", "state,mergedAt,mergeCommit,headRefOid"],
        { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
      const parsed = JSON.parse(response);
      states[handoff.pr] = {
        state: parsed.state,
        mergedAt: parsed.mergedAt ?? null,
        mergeCommit: parsed.mergeCommit?.oid ?? null,
        headRefOid: parsed.headRefOid ?? null,
      };
    }
    return { available: true, states };
  } catch (error) {
    return { available: false, states: {}, error: error instanceof Error ? error.message : String(error) };
  }
}

export function handoffTemplate() {
  return {
    version: HANDOFF_VERSION,
    project: "Project Drydock Phase 4",
    pr: 198,
    candidateSha: "0123456789abcdef0123456789abcdef01234567",
    baseSha: "89abcdef0123456789abcdef0123456789abcdef",
    status: "READY",
    touches: ["drydock", "studio"],
    paths: ["src/drydock/", "src/components/studio/"],
    migrationFamilies: [],
    dependencies: [],
  };
}

function parseCli(argumentsList) {
  const positional = [];
  const options = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const value = argumentsList[index];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }
    const name = value.slice(2);
    if (name === "json") {
      options.json = true;
      continue;
    }
    const optionValue = argumentsList[index + 1];
    if (!optionValue || optionValue.startsWith("--")) fail(`OPTION_${name.toUpperCase()}_MISSING`);
    options[name] = optionValue;
    index += 1;
  }
  return { positional, options };
}

function reportHuman(result, prAvailable) {
  const lines = ["SIMPLE PARALLEL COORDINATOR", `protected main: ${result.protectedMain ?? "unavailable"}`];
  if (!prAvailable) lines.push("PR state: unavailable; use the ordinary Sounding Line path directly if needed.");
  lines.push("READY ORDER");
  if (result.readyOrder.length)
    result.readyOrder.forEach((candidate, index) =>
      lines.push(`${index + 1}. ${candidate.project} — PR #${candidate.pr}`),
    );
  else lines.push("none");
  for (const state of STATES.filter((value) => value !== "READY")) {
    const candidates = result.candidates.filter((candidate) => candidate.state === state);
    if (!candidates.length) continue;
    lines.push(state);
    candidates.forEach((candidate) =>
      lines.push(
        `${candidate.project} — PR #${candidate.pr}${candidate.reasons.length ? ` (${candidate.reasons.join(", ")})` : ""}`,
      ),
    );
  }
  for (const candidate of result.unaffected ?? [])
    lines.push(`NO RECONCILIATION REQUIRED: ${candidate.project} — PR #${candidate.pr}`);
  for (const candidate of result.affected ?? [])
    lines.push(`RECONCILIATION REQUIRED: ${candidate.project} — PR #${candidate.pr} (${candidate.reasons.join(", ")})`);
  return `${lines.join("\n")}\n`;
}

async function main() {
  const { positional, options } = parseCli(process.argv.slice(2));
  const [command = "status", ...argumentsList] = positional;
  if (command === "handoff-template") {
    process.stdout.write(`${JSON.stringify(handoffTemplate(), null, 2)}\n`);
    return;
  }
  const root = path.resolve(options.workspace ?? process.cwd());
  const handoffDirectory = path.resolve(
    root,
    argumentsList[command === "evaluate-after-merge" ? 1 : 0] ?? ".coordinator/candidates",
  );
  const handoffs = await discoverHandoffs(handoffDirectory);
  const mainSha = options.main ?? readCurrentMain(root);
  const pr = readPrStates(root, handoffs);
  let result;
  if (command === "status" || command === "plan") {
    result = coordinate({ handoffs, mainSha, prStates: pr.states });
  } else if (command === "evaluate-after-merge") {
    const [mergeSha] = argumentsList;
    if (!mergeSha) fail("MERGE_SHA_MISSING");
    result = evaluateAfterMerge({
      handoffs,
      mergeSha,
      mergedPaths: readMergePaths(root, mergeSha),
      mergedPr: options["merged-pr"] ? Number(options["merged-pr"]) : null,
      mainSha,
      prStates: pr.states,
    });
  } else {
    fail("COMMAND_INVALID");
  }
  const output = { ...result, prStateAvailable: pr.available };
  process.stdout.write(options.json ? `${JSON.stringify(output, null, 2)}\n` : reportHuman(output, pr.available));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
