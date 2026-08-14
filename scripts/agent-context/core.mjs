import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const GENERATOR_VERSION = "project-trim-mscp-1.0";
export const ESTIMATOR_VERSION = "project-trim-r1-bands-1.0";
export const EXPANSION_CLASSES = [
  "AUTHORITY",
  "SOURCE",
  "SCHEMA",
  "TEST",
  "HISTORY",
  "ADJACENT_PROJECT",
  "OPERATIONS",
  "SECURITY",
];
const SECRET = /secret|password|token|credential|cookie|authorization|private.?key/i;
const unique = (values) => [...new Set(values.filter(Boolean))];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const posix = (value) => value.split(path.sep).join("/");
const gitCache = new Map();

function git(root, args, fallback = null) {
  const key = `${root}\0${args.join("\0")}`;
  if (gitCache.has(key)) return gitCache.get(key);
  try {
    const result = execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    gitCache.set(key, result);
    return result;
  } catch {
    return fallback;
  }
}
function readJson(root, relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
}
function globMatches(pattern, candidate) {
  const escape = (value) => value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
  const expression = `^${pattern
    .split("**")
    .map((part) => part.split("*").map(escape).join("[^/]*"))
    .join(".*")}$`;
  return new RegExp(expression).test(candidate);
}
function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, SECRET.test(key) ? "[REDACTED]" : sanitize(item)]),
    );
  return typeof value === "string" && SECRET.test(value) ? "[REDACTED]" : value;
}
function classify(input) {
  if (input.taskClass) return input.taskClass;
  const text = `${input.id ?? ""} ${input.objective ?? ""}`.toLowerCase();
  if (/release|closure|finali[sz]e/.test(text)) return "release-closure";
  if (/integrat|reconcile|merge/.test(text)) return "integration";
  if (/security|privacy|auth/.test(text)) return "security-sensitive";
  if (/doc|record|index/.test(text)) return "documentation-only";
  if (/infra|workflow|runtime|deploy/.test(text)) return "infrastructure";
  if (/fix|bug|repair|regression/.test(text)) return "bug-repair";
  return "product-phase";
}
function sourceIdentity(root) {
  const [head, headTreeSha, originMainSha] = (
    git(root, ["rev-parse", "HEAD", "HEAD^{tree}", "origin/main"], "\n\n") ?? "\n\n"
  ).split(/\r?\n/);
  return {
    originMainSha: originMainSha || null,
    baseSha: originMainSha || head || null,
    headSha: head || null,
    headTreeSha: headTreeSha || null,
    worktree: posix(root),
  };
}
function sourceRef(root, source) {
  return {
    path: source,
    blobSha: existsSync(path.join(root, source)) ? sha256(readFileSync(path.join(root, source))) : null,
  };
}
function registrySlice(root, input) {
  const ownership = readJson(root, "testing/ownership.json");
  const contracts = readJson(root, "testing/contracts.json");
  const impact = readJson(root, "testing/impact-map.json");
  const suites = readJson(root, "testing/suites.json");
  const resources = readJson(root, "testing/resources.json");
  const debt = readJson(root, "testing/validation-debt.json");
  const paths = unique(input.paths ?? []);
  const mappings = paths.flatMap((candidate) =>
    (impact.pathMappings ?? [])
      .filter((entry) => globMatches(entry.path, candidate))
      .map((entry) => ({ candidate, ...entry })),
  );
  const unmapped = paths.filter((candidate) => !mappings.some((entry) => entry.candidate === candidate));
  const owners = (ownership.owners ?? []).filter((owner) =>
    paths.some((candidate) => (owner.sourcePaths ?? []).some((pattern) => globMatches(pattern, candidate))),
  );
  const contractIds = unique([
    ...owners.flatMap((owner) => owner.contractIds ?? []),
    ...mappings.flatMap((entry) => entry.contractIds ?? []),
  ]);
  const suiteIds = unique(mappings.flatMap((entry) => entry.suiteIds ?? []));
  const selectedContracts = (contracts.contracts ?? []).filter((contract) => contractIds.includes(contract.id));
  const selectedSuites = (suites.suites ?? []).filter((suite) => suiteIds.includes(suite.id));
  return {
    paths,
    mappings,
    unmapped,
    owners,
    contractIds,
    suiteIds,
    selectedContracts,
    selectedSuites,
    resources: resources.resources ?? [],
    debt: debt.entries ?? [],
  };
}
function confidence(slice, input) {
  if (input.authorityConflict) return "STALE_REQUIRES_ESCALATION";
  if (slice.unmapped.length || (!slice.owners.length && slice.paths.length)) return "PARTIAL_REQUIRES_EXPANSION";
  return "BOUNDED";
}
function packetMarkdown(packet) {
  const list = (items) =>
    items.length
      ? items.map((item) => `- ${typeof item === "string" ? item : (item.path ?? item.id)}`).join("\n")
      : "- None supplied";
  return `# Minimum Sufficient Context Packet\n\n## Task identity\n- ID: ${packet.task.id}\n- Class: ${packet.task.taskClass}\n- Execution profile: ${packet.task.executionProfile}\n\n## Scope contract\n${packet.scope.objective}\n\n## Authority pointers\n${list(packet.authority)}\n\n## Ownership\n${list(packet.ownership.owners)}\n\n## Likely source slice\n${list(packet.sourceSlice)}\n\n## Verification / Sounding Line slice\n${list(packet.verificationSlice)}\n\n## Risks and mapping gaps\n${list(packet.knownRisks)}\n\n## Autonomous expansion policy\n${packet.autonomousExpansionPolicy}\n\n## Packet confidence\n${packet.confidence}\n`;
}

export function buildPacket(root, rawInput = {}) {
  const input = sanitize(rawInput);
  const profiles = readJson(root, "agent-context-profiles.json").profiles;
  const taskClass = classify(input);
  const profile = profiles[taskClass];
  if (!profile) throw new Error(`UNKNOWN_TASK_CLASS:${taskClass}`);
  const slice = registrySlice(root, input);
  const authority = [
    "AGENTS.md",
    ".agents/context-workflow.md",
    ".agents/testing-workflow.md",
    "testing/sounding-line-authority.json",
  ].map((entry) => sourceRef(root, entry));
  const sourceSlice = unique([...slice.paths, ...(input.additionalPointers ?? [])]).map((entry) =>
    sourceRef(root, entry),
  );
  const knownRisks = [
    ...slice.unmapped.map((entry) => `UNMAPPED:${entry}: conservative SOURCE/TEST expansion required`),
    ...(input.authorityConflict
      ? ["AUTHORITY_CONFLICT: verify current primary source; escalation required if irreconcilable"]
      : []),
    ...slice.debt
      .filter((entry) => slice.contractIds.some((id) => (entry.affectedContracts ?? []).includes(id)))
      .map((entry) => `VALIDATION_DEBT:${entry.id}`),
  ];
  // A closure/slice is one startup pointer even when it contains several derived entries.
  // This is intentionally a packet-navigation count, not a hidden source count.
  const pointerCount =
    sourceSlice.length +
    1 +
    1 +
    1 +
    (["product-phase", "infrastructure", "integration", "release-closure"].includes(taskClass) ? 1 : 0) +
    (input.priorAcceptedStatusPath ? 1 : 0) +
    (input.schemaPointers?.length ?? 0);
  const packet = {
    schemaVersion: "1.0",
    packetType: "MINIMUM_SUFFICIENT_CONTEXT_PACKET",
    task: {
      id: input.id ?? "unidentified-task",
      project: input.project ?? null,
      increment: input.increment ?? null,
      taskClass,
      executionProfile: input.executionProfile ?? "STANDARD_AUTONOMOUS",
    },
    sourceIdentity: sourceIdentity(root),
    scope: {
      objective: input.objective ?? "Objective must be supplied by the authorized task.",
      nonGoals: input.nonGoals ?? [],
      completionContract: input.completionContract ?? [
        "Follow current source authority and Sounding Line acceptance path.",
      ],
    },
    profile: {
      id: taskClass,
      pointerGuidance: profile.pointerGuidance,
      initialContextEmphasis: profile.initialContextEmphasis,
      normallyDeferred: profile.normallyDeferred,
      expansionTriggers: profile.expansionTriggers,
      fallback: profile.fallback,
    },
    authority,
    priorAcceptedStatus: input.priorAcceptedStatusPath ? sourceRef(root, input.priorAcceptedStatusPath) : null,
    ownership: {
      owners: slice.owners.map((owner) => ({ id: owner.id, project: owner.project, contractIds: owner.contractIds })),
      contracts: slice.selectedContracts.map(({ id, authority: contractAuthority, owners, critical }) => ({
        id,
        authority: contractAuthority,
        owners,
        critical,
      })),
    },
    sourceSlice,
    schemaSlice: (input.schemaPointers ?? []).map((entry) => sourceRef(root, entry)),
    verificationSlice: [
      { authority: "SOUNDING_LINE", source: "testing/sounding-line-authority.json" },
      ...slice.selectedSuites.map(({ id, owner, contracts: suiteContracts, resources: suiteResources }) => ({
        id,
        owner,
        contracts: suiteContracts,
        resources: suiteResources,
      })),
    ],
    mainDelta: {
      from: input.deltaBaseSha ?? null,
      currentOriginMain: sourceIdentity(root).originMainSha,
      summary: input.mainDeltaSummary ?? "No task baseline supplied; regenerate after a material mainline advance.",
    },
    knownRisks,
    completionContract: input.completionContract ?? [
      "Complete authorized scope and use Sounding Line governed acceptance.",
    ],
    autonomousExpansionPolicy:
      "Classify the unresolved question; read the smallest useful AUTHORITY, SOURCE, SCHEMA, TEST, HISTORY, ADJACENT_PROJECT, OPERATIONS, or SECURITY set; record it; continue. Context expansion is not scope expansion.",
    confidence: confidence(slice, input),
    conservativeFallback: slice.unmapped.length
      ? "UNKNOWN_MAPPING_REQUIRES_TARGETED_SEARCH_AND_EXPANSION"
      : profile.fallback,
    generator: {
      version: GENERATOR_VERSION,
      profileSource: "agent-context-profiles.json",
      pointerCount,
      integrity: "derived-nonauthoritative; source authority prevails",
      secretPolicy: "obvious secret-bearing fields redacted",
    },
  };
  packet.ledgerTemplate = createLedger(packet);
  return packet;
}

export function createLedger(packet) {
  return {
    schemaVersion: "1.0",
    taskId: packet.task.id,
    packetIdentity: sha256(JSON.stringify({ task: packet.task, sourceIdentity: packet.sourceIdentity })),
    reads: [],
    expansions: [],
    usage: null,
    privacy: { prohibited: ["secrets", "credentials", "private content", "full prompts", "raw logs"] },
  };
}
export function addExpansion(ledger, event, root = process.cwd()) {
  if (!EXPANSION_CLASSES.includes(event.reasonClass)) throw new Error("INVALID_EXPANSION_CLASS");
  const source = sourceRef(root, event.source);
  const repeated = ledger.reads.some((read) => read.path === source.path && read.blobSha === source.blobSha);
  ledger.reads.push({ ...source, reason: event.reason, result: event.result, repeated });
  ledger.expansions.push({
    reasonClass: event.reasonClass,
    reason: event.reason,
    sourcesAdded: [source],
    resolution: event.result,
  });
  return ledger;
}
export function usageRecord(input = {}) {
  if (Number.isFinite(input.exactTokens) && input.exactTokens >= 0)
    return {
      state: "EXACT",
      exactTokens: input.exactTokens,
      taskId: input.taskId ?? null,
      taskClass: input.taskClass ?? null,
      durationMinutes: input.durationMinutes ?? null,
      provenance: input.provenance ?? "Codex exposed aggregate goal total",
      accountingMethod: "OFFICIAL_GOAL_TOTAL",
    };
  if (input.accountingState === "RECONSTRUCTED" && Number.isFinite(input.pointEstimate) && input.pointEstimate > 0)
    return {
      state: "RECONSTRUCTED",
      taskId: input.taskId ?? null,
      taskClass: input.taskClass ?? null,
      exactTokens: null,
      pointEstimate: input.pointEstimate,
      lowEstimate: input.lowEstimate ?? null,
      highEstimate: input.highEstimate ?? null,
      confidence: input.confidence ?? "LOW",
      provenance: input.provenance ?? "Reconstructed from retained task evidence; not official billing.",
      accountingMethod: "RECONSTRUCTED_EVIDENCE",
    };
  if (input.accountingState === "COARSE_ESTIMATE" && Number.isFinite(input.pointEstimate) && input.pointEstimate > 0)
    return {
      state: "COARSE_ESTIMATE",
      taskId: input.taskId ?? null,
      taskClass: input.taskClass ?? null,
      exactTokens: null,
      pointEstimate: input.pointEstimate,
      lowEstimate: input.lowEstimate ?? null,
      highEstimate: input.highEstimate ?? null,
      confidence: input.confidence ?? "LOW",
      provenance: input.provenance ?? "Coarse estimate; not official billing.",
      accountingMethod: "COARSE_METADATA",
    };
  if (!Number.isFinite(input.durationMinutes) || input.durationMinutes <= 0)
    return {
      state: "UNAVAILABLE",
      taskId: input.taskId ?? null,
      taskClass: input.taskClass ?? null,
      exactTokens: null,
      pointEstimate: null,
      lowEstimate: null,
      highEstimate: null,
      provenance: "Insufficient safe metadata; missing accounting is not zero.",
      accountingMethod: "NO_DEFENSIBLE_ESTIMATE",
    };
  const bands = {
    DENSE_CONTINUATION: [21500, 0.65, 1.4, "MEDIUM"],
    MIXED_ENGINEERING: [9000, 0.55, 1.55, "MEDIUM"],
    WAIT_MONITOR_HEAVY: [6000, 0.4, 1.8, "LOW"],
  };
  const [rate, low, high, confidence] = bands[input.activityRegime ?? "MIXED_ENGINEERING"] ?? bands.MIXED_ENGINEERING;
  const modifier = Number.isFinite(input.modifier) && input.modifier > 0 ? input.modifier : 1;
  const point = Math.round((rate * input.durationMinutes * modifier) / 100) * 100;
  return {
    state: "CALIBRATED_ESTIMATE",
    taskId: input.taskId ?? null,
    taskClass: input.taskClass ?? null,
    exactTokens: null,
    pointEstimate: point,
    lowEstimate: Math.max(1, Math.round((point * low) / 100) * 100),
    highEstimate: Math.round((point * high) / 100) * 100,
    durationMinutes: input.durationMinutes,
    activityRegime: input.activityRegime ?? "MIXED_ENGINEERING",
    confidence,
    estimatorVersion: ESTIMATOR_VERSION,
    calibrationEvidence: "Project Trim R1 Appendix I; seven exact samples totaling 9,883,558 tokens",
    modifiers: input.modifiers ?? [],
    provenance: "Transparent first-order estimate; not official billing.",
    accountingMethod: "CALIBRATED_ACTIVITY_BAND",
  };
}
export { packetMarkdown, sanitize };
