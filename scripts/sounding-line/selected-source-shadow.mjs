import { digest } from "./evidence.mjs";
import { compileArtifactDependencyClosures } from "./artifact-dependency-graph.mjs";

const MAX_ENTRIES = 200000,
  MAX_REVISIONS = 16,
  MAX_PINS = 8192;
const oid = (value) => typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
const safe = (file) =>
  typeof file === "string" &&
  file.length > 0 &&
  file.length <= 4096 &&
  !/[\\\x00-\x1f\x7f]/u.test(file) &&
  file.split("/").every((part) => part && part !== "." && part !== "..");
const identity = (entry) => (entry ? `${entry.mode} ${entry.type} ${entry.blob}` : null);
const compare = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));

// This is an unhooked read-set proposal over B's logical graph. The graph and
// inventory digests are checked mathematical inputs, not authenticated source or
// a materialization certificate. Production continues to require FULL snapshots.
export function planSelectedSourceShadow({
  base,
  candidate,
  baseGraph,
  candidateGraph,
  roots,
  readerPaths = [],
  historical = [],
  historicalPins = [],
  prNumber,
}) {
  if (!Number.isSafeInteger(prNumber) || prNumber < 1 || [721, 776, 805].includes(prNumber))
    throw Error("SOUNDING_LINE_SELECTED_SOURCE_SHADOW_SCOPE");
  const full = (reason) =>
    Object.freeze({
      profile: "FULL_SNAPSHOT",
      reason,
      qualification: false,
      reuseAuthorized: false,
      productionMaterialization: "FULL_SNAPSHOT",
      certificate: "NOT_ISSUED",
    });
  if (
    !Array.isArray(historical) ||
    historical.length + 2 > MAX_REVISIONS ||
    !Array.isArray(historicalPins) ||
    historicalPins.length > MAX_PINS ||
    !Array.isArray(readerPaths) ||
    readerPaths.length > MAX_PINS ||
    !readerPaths.every(safe) ||
    new Set(readerPaths).size !== readerPaths.length ||
    !Array.isArray(roots) ||
    !roots.length ||
    roots.length > MAX_PINS ||
    roots.some((id) => typeof id !== "string") ||
    new Set(roots).size !== roots.length
  )
    return full("INVALID_OR_UNBOUNDED_INPUT");
  const snapshots = new Map();
  let entries = 0;
  for (const snapshot of [base, candidate, ...historical]) {
    if (!oid(snapshot?.revision) || !Array.isArray(snapshot.entries) || snapshot.entries.length > 100000)
      return full("UNKNOWN_SOURCE_INVENTORY");
    entries += snapshot.entries.length;
    if (entries > MAX_ENTRIES || digest(snapshot.entries) !== snapshot.sourceTreeDigest)
      return full("SOURCE_INVENTORY_BOUND_OR_DRIFT");
    const inventory = new Map();
    for (const entry of snapshot.entries) {
      if (
        !safe(entry.path) ||
        !oid(entry.blob) ||
        entry.type !== "blob" ||
        !["100644", "100755", "120000"].includes(entry.mode) ||
        inventory.has(entry.path)
      )
        return full("UNKNOWN_SOURCE_ENTRY");
      inventory.set(entry.path, { path: entry.path, mode: entry.mode, type: entry.type, blob: entry.blob });
    }
    const prior = snapshots.get(snapshot.revision);
    if (prior && prior.digest !== snapshot.sourceTreeDigest) return full("CONFLICTING_SOURCE_INVENTORY");
    snapshots.set(snapshot.revision, { inventory, digest: snapshot.sourceTreeDigest });
  }
  const previous = snapshots.get(base.revision).inventory,
    current = snapshots.get(candidate.revision).inventory;
  const selected = new Map(),
    reasons = new Map();
  const add = (revision, file, reason) => {
    const entry = snapshots.get(revision)?.inventory.get(file);
    if (!entry) return false;
    const key = `${revision}\0${file}`;
    selected.set(key, { revision, ...entry });
    if (!reasons.has(key)) reasons.set(key, new Set());
    reasons.get(key).add(reason);
    return true;
  };
  let closures;
  try {
    closures = [baseGraph, candidateGraph].map((graph) => compileArtifactDependencyClosures(graph).closure(roots));
    if (closures.some((closure) => closure.unknown)) return full("UNKNOWN_DEPENDENCY_CLOSURE");
    for (const [index, graph] of [baseGraph, candidateGraph].entries()) {
      const snapshot = index === 0 ? base : candidate,
        inventory = index === 0 ? previous : current;
      const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
      for (const id of closures[index].ids) {
        if (!id.startsWith("file:")) continue;
        const file = id.slice(5),
          entry = inventory.get(file),
          node = nodes.get(id);
        if (
          !entry ||
          !["100644", "100755"].includes(entry.mode) ||
          node.digest !== digest({ blob: entry.blob, mode: entry.mode })
        )
          return full("GRAPH_SOURCE_BINDING_MISMATCH");
        add(snapshot.revision, file, "DEPENDENCY_CLOSURE");
      }
    }
  } catch {
    return full("INVALID_DEPENDENCY_GRAPH");
  }
  // Deleted paths retain their base blob; additions and mode changes retain both
  // sides where present. Selection must not hide the formatter/security diff.
  const changedPaths = [];
  for (const file of new Set([...previous.keys(), ...current.keys()])) {
    if (identity(previous.get(file)) !== identity(current.get(file))) {
      changedPaths.push(file);
      add(base.revision, file, "CHANGED_PATH");
      add(candidate.revision, file, "CHANGED_PATH");
    }
    if (
      !file.includes("/") &&
      /^(?:package(?:-lock)?\.json|tsconfig[^/]*\.json|[\w.-]+\.config\.[\w]+|\.git(?:attributes|ignore)|\.prettier.*)$/u.test(
        file,
      )
    ) {
      add(base.revision, file, "ROOT_POLICY_OR_TOOLCHAIN");
      add(candidate.revision, file, "ROOT_POLICY_OR_TOOLCHAIN");
    }
  }
  for (const file of new Set(["package.json", "package-lock.json", ...readerPaths]))
    if (!add(base.revision, file, "INSTALLED_READER") || !add(candidate.revision, file, "INSTALLED_READER"))
      return full("READER_CLOSURE_MISSING");
  const pins = new Set();
  for (const pin of historicalPins) {
    if (!oid(pin?.revision) || !safe(pin.path) || !oid(pin.blob) || !["100644", "100755", "120000"].includes(pin.mode))
      return full("INVALID_HISTORICAL_PIN");
    const key = `${pin.revision}\0${pin.path}`;
    const entry = snapshots.get(pin.revision)?.inventory.get(pin.path);
    if (pins.has(key) || !entry || entry.blob !== pin.blob || entry.mode !== pin.mode)
      return full("HISTORICAL_PIN_MISSING_OR_CHANGED");
    pins.add(key);
    add(pin.revision, pin.path, "ORIGINAL_HISTORICAL_PIN");
  }
  if (selected.size > MAX_ENTRIES) return full("SELECTED_ENTRY_BOUND");
  const readSet = [...selected]
    .sort(([a], [b]) => compare(a, b))
    .map(([key, entry]) => ({ ...entry, reasons: [...reasons.get(key)].sort(compare) }));
  const baselineBlobs = new Set(
    [...previous.values(), ...current.values(), ...historicalPins].map((entry) => entry.blob),
  );
  const body = {
    version: 1,
    profile: "SELECTED_SOURCE_SHADOW",
    baseRevision: base.revision,
    candidateRevision: candidate.revision,
    sourceInventories: [...snapshots]
      .map(([revision, value]) => ({ revision, sourceTreeDigest: value.digest }))
      .sort((a, b) => compare(a.revision, b.revision)),
    baseGraphDigest: baseGraph.graphDigest,
    candidateGraphDigest: candidateGraph.graphDigest,
    baseClosureDigest: closures[0].closureDigest,
    candidateClosureDigest: closures[1].closureDigest,
    roots: [...roots].sort(compare),
    changedPaths: changedPaths.sort(compare),
    readSet,
    measurements: {
      baselineUniqueBlobs: baselineBlobs.size,
      selectedUniqueBlobs: new Set(readSet.map((entry) => entry.blob)).size,
      selectedVersionedPaths: readSet.length,
      rawByteSavings: null,
    },
    requiresCompleteCommitAndTreeMetadata: true,
    lateTransportAllowed: false,
    certificate: "NOT_ISSUED",
    authentication: "CHECKED_INPUTS_NOT_PROVIDER_AUTHENTICATED",
    productionMaterialization: "FULL_SNAPSHOT",
    qualification: false,
    reuseAuthorized: false,
  };
  return { ...body, proposalDigest: digest(body) };
}
