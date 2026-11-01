// A transport read-set proposal, never a verification/custody grant. Production
// starts in shadow mode. The independently tested materialization path retains
// every commit/tree, every changed path, all source/config/public/fixture bytes,
// and all existing historical reader pins.
import { createHash } from "node:crypto";
export const DOCUMENTATION_CHECKOUT_ANCHOR = "caf86f42461201db8e6fe88e46a69c7c9e347d25";
export const DOCUMENTATION_CHECKOUT_MODE = "SHADOW";
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const allowedAuthorityChanges = new Set([
  ".github/workflows/sounding-line-ordinary.yml",
  "scripts/sounding-line/ordinary-checkout.mjs",
  "scripts/sounding-line/ordinary-documentation-checkout-profile.mjs",
  "scripts/sounding-line/experience-selected-checkout.mjs",
  "scripts/sounding-line/experience-checkout-hydration.mjs",
  "scripts/sounding-line/authenticated-completed-evidence.mjs",
  "tests/sounding-line/ordinary-checkout.test.mjs",
  "tests/sounding-line/ordinary-documentation-checkout.test.mjs",
  "tests/sounding-line/authenticated-completed-evidence.test.mjs",
  "tests/sounding-line/fixtures/ordinary-documentation-source.json",
  "Development_Docs/Programs/Sounding_Line/Sounding_Line_Modernization_A_Implementation_Record.md",
]);
const key = (entry) => `${entry.mode} ${entry.type} ${entry.sha ?? entry.blob}`;
const safe = (file) =>
  typeof file === "string" &&
  file.length > 0 &&
  file.length < 4096 &&
  !/[\\\u0000-\u001f\u007f]/u.test(file) &&
  !file.startsWith("/") &&
  file.split("/").every((part) => part && part !== "." && part !== "..");
const inventory = (entries) => {
  if (!Array.isArray(entries) || entries.length > 100000) return null;
  const result = new Map();
  for (const entry of entries) {
    if (
      !safe(entry.path) ||
      entry.type !== "blob" ||
      !["100644", "100755", "120000"].includes(entry.mode) ||
      !/^[a-f0-9]{40}$/u.test(entry.sha ?? entry.blob ?? "") ||
      result.has(entry.path)
    )
      return null;
    result.set(entry.path, entry);
  }
  return result;
};
const generated = (file) =>
  file.split("/").some((part) => part === ".next" || part.startsWith(".next-") || part.startsWith(".sealed-build"));
const ignored = (file) => file.split("/").some((part) => part === ".git" || part === "node_modules") || generated(file);
// These are the exact installed pathname predicates at the pinned anchor. The
// whole security implementation is part of the anchor comparison below, so a
// changed reader disables the proposal instead of silently extending its scope.
export function ordinaryPrivatePathViolation(file) {
  if (ignored(file) || /^(src|scripts|tests)\/.*private-content\//u.test(file)) return false;
  return (
    /\.ftprivate$/iu.test(file) ||
    /\.ftkey$/iu.test(file) ||
    /(?:^|\/)(?:private-content|private-exports|decrypted-private-content)(?:\/|$)/iu.test(file)
  );
}

export function documentationCheckoutProposal({ baseEntries, candidateEntries, anchorEntries, prNumber }) {
  const full = (reason) => ({ profile: "FULL_SNAPSHOT", reason, qualification: false });
  if (!Number.isSafeInteger(prNumber) || prNumber < 1 || [721, 776].includes(prNumber))
    return full("FINITE_OR_UNBOUND_PROFILE");
  const base = inventory(baseEntries),
    candidate = inventory(candidateEntries),
    anchor = inventory(anchorEntries);
  if (!base || !candidate || !anchor) return full("UNKNOWN_TREE_ENTRY");
  // The read-set certificate is source-bound, including all transitive readers,
  // unit definitions/fixtures, scanner policy, commands, lockfile and tool config.
  // Only the separately reviewed transport implementation may differ in main.
  for (const file of new Set([...anchor.keys(), ...base.keys()]))
    if (!allowedAuthorityChanges.has(file) && key(anchor.get(file) ?? {}) !== key(base.get(file) ?? {}))
      return full("READER_OR_BASE_POLICY_DRIFT");
  const changed = [...new Set([...base.keys(), ...candidate.keys()])]
    .filter((file) => key(base.get(file) ?? {}) !== key(candidate.get(file) ?? {}))
    .sort();
  if (
    !changed.length ||
    changed.some(
      (file) => !(file === "Development_Docs/document-index.json" || /^Development_Docs\/.*\.md$/u.test(file)),
    )
  )
    return full("NOT_CLOSED_DOCUMENTATION_DELTA");
  for (const file of changed) {
    const before = base.get(file),
      after = candidate.get(file);
    if (!after || after.mode !== "100644" || (before && before.mode !== after.mode))
      return full("DELETION_OR_TYPE_CHANGE");
  }
  // File-system discovery must not lose a forbidden pathname even when that
  // binary's contents would never be read. Untracked files remain on disk and
  // are still scanned by the unchanged private-content implementation.
  if ([...candidate.keys()].some(ordinaryPrivatePathViolation)) return full("FORBIDDEN_PATH_REQUIRES_FULL_SCAN");
  const omissions = [];
  for (const [file, entry] of candidate) {
    if (
      entry.mode !== "100644" ||
      !file.startsWith("Development_Docs/") ||
      !/\.(?:png|jpe?g|webp|gif|webm|zip)$/iu.test(file) ||
      generated(file) ||
      ignored(file)
    )
      continue;
    if (key(base.get(file) ?? {}) !== key(entry) || changed.includes(file)) return full("MEDIA_INTERVAL_CHANGED");
    omissions.push({ path: file, mode: entry.mode, blob: entry.sha ?? entry.blob });
  }
  omissions.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const omittedPaths = new Set(omissions.map((entry) => entry.path));
  const retained = [...candidate.values()]
    .filter((entry) => !omittedPaths.has(entry.path))
    .map((entry) => [entry.path, key(entry)])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    profile: "DOCUMENTATION_ONLY_SOURCE_BOUND_V1",
    anchor: DOCUMENTATION_CHECKOUT_ANCHOR,
    changedPaths: changed,
    omissions,
    omittedInventoryDigest: hash(omissions),
    retainedInventoryDigest: hash(retained),
    completePathnameInventoryDigest: hash([...candidate.keys()].sort()),
    unitSelection: "UNCHANGED_WIDENED_APPLICATION_SELECTION",
    commandSelection: "UNCHANGED_PROTECTED_VERIFIER",
    qualification: false,
  };
}

export async function documentationCheckoutReadSet({ command, baseSha, candidateSha, prNumber }) {
  const tree = async (revision) =>
    (await command(["ls-tree", "-rz", revision]))
      .split("\0")
      .filter(Boolean)
      .map((row) => {
        const tab = row.indexOf("\t"),
          metadata = row.slice(0, tab),
          path = row.slice(tab + 1),
          [mode, type, sha] = metadata.split(" ");
        return { path, mode, type, sha };
      });
  const proposal = documentationCheckoutProposal({
    baseEntries: await tree(baseSha),
    candidateEntries: await tree(candidateSha),
    anchorEntries: await tree(DOCUMENTATION_CHECKOUT_ANCHOR),
    prNumber,
  });
  return {
    applied: DOCUMENTATION_CHECKOUT_MODE === "ACTIVE" && proposal.profile === "DOCUMENTATION_ONLY_SOURCE_BOUND_V1",
    proposal,
  };
}
