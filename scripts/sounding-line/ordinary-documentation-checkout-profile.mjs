// A transport read-set proposal, never a verification/custody grant. Production
// starts in shadow mode. The independently tested materialization path retains
// every commit/tree, every changed path, all source/config/public/fixture bytes,
// and all existing historical reader pins.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
export const DOCUMENTATION_CHECKOUT_ANCHOR = "caf86f42461201db8e6fe88e46a69c7c9e347d25";
export const DOCUMENTATION_CHECKOUT_MODE = "SHADOW";
export const DOCUMENTATION_CHECKOUT_CERTIFICATE_REVISION = "PENDING";
const profilePath = "scripts/sounding-line/ordinary-documentation-checkout-profile.mjs";
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const allowedAuthorityChanges = new Set([
  ".github/workflows/sounding-line-ordinary.yml",
  "scripts/sounding-line/ordinary-checkout.mjs",
  "scripts/sounding-line/ordinary-documentation-checkout-profile.mjs",
  "scripts/sounding-line/experience-selected-checkout.mjs",
  "scripts/sounding-line/experience-checkout-hydration.mjs",
  "scripts/sounding-line/ordinary-custody-probe.mjs",
  "scripts/sounding-line/experience-exception.mjs",
  "tests/sounding-line/ordinary-checkout.test.mjs",
  "tests/sounding-line/ordinary-documentation-checkout.test.mjs",
  "tests/sounding-line/ordinary-documentation-materialization.test.mjs",
  "tests/sounding-line/ordinary-documentation-certificate.test.mjs",
  "tests/sounding-line/ordinary-custody-probe.test.mjs",
  "Development_Docs/Programs/Sounding_Line/Sounding_Line_Modernization_A_Implementation_Record.md",
]);
const key = (entry) => `${entry.mode} ${entry.type} ${entry.sha ?? entry.blob}`;
const safe = (file) =>
  typeof file === "string" &&
  file.length > 0 &&
  file.length < 4096 &&
  !/[\\\u0000-\u001f\u007f]/u.test(file) &&
  !file.includes("\ufffd") &&
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

export function documentationCheckoutProposal({
  baseEntries,
  candidateEntries,
  anchorEntries,
  prNumber,
  purpose = "verification",
  reviewedEntries,
  profileSourceMatchesReviewed = false,
}) {
  const full = (reason) => ({ profile: "FULL_SNAPSHOT", reason, qualification: false });
  if (!["verification", "campaign-custody"].includes(purpose)) return full("UNKNOWN_CHECKOUT_PURPOSE");
  if (!Number.isSafeInteger(prNumber) || prNumber < 1 || [721, 776].includes(prNumber))
    return full("FINITE_OR_UNBOUND_PROFILE");
  const base = inventory(baseEntries),
    candidate = inventory(candidateEntries),
    anchor = inventory(anchorEntries),
    reviewed = reviewedEntries === undefined ? null : inventory(reviewedEntries);
  if (!base || !candidate || !anchor || (reviewedEntries !== undefined && !reviewed)) return full("UNKNOWN_TREE_ENTRY");
  // The read-set certificate is source-bound, including all transitive readers,
  // unit definitions/fixtures, scanner policy, commands, lockfile and tool config.
  // Only the separately reviewed transport implementation may differ in main.
  for (const file of new Set([...anchor.keys(), ...base.keys()])) {
    if (key(anchor.get(file) ?? {}) === key(base.get(file) ?? {})) continue;
    if (!allowedAuthorityChanges.has(file)) return full("READER_OR_BASE_POLICY_DRIFT");
    if (
      base.get(file)?.mode !== "100644" ||
      reviewed?.get(file)?.mode !== "100644" ||
      (file === profilePath ? profileSourceMatchesReviewed !== true : key(base.get(file)) !== key(reviewed.get(file)))
    )
      return full("REVIEWED_TRANSPORT_SOURCE_CHANGED");
  }
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
  // The installed verifier adds migration validation even for a documentation
  // filename containing this token. That command lies outside this certificate.
  if (changed.some((file) => /migration/iu.test(file))) return full("MIGRATION_VALIDATION_REQUIRES_FULL");
  // File-system discovery must not lose a forbidden pathname even when that
  // binary's contents would never be read. Untracked files remain on disk and
  // are still scanned by the unchanged private-content implementation.
  if ([...candidate.keys()].some(ordinaryPrivatePathViolation)) return full("FORBIDDEN_PATH_REQUIRES_FULL_SCAN");
  const custody = purpose === "campaign-custody";
  const metadataPaths = custody
    ? [
        "testing/contracts.json",
        "testing/product-experience-exceptions.json",
        ...[...candidate.keys()].filter((file) => file === ".gitattributes" || file.endsWith("/.gitattributes")),
      ].sort()
    : [];
  if (
    custody &&
    metadataPaths.some(
      (file) => candidate.get(file)?.mode !== "100644" || key(base.get(file) ?? {}) !== key(candidate.get(file) ?? {}),
    )
  )
    return full("CUSTODY_READER_CHANGED_OR_MISSING");
  const metadataSet = new Set(metadataPaths);
  const omissions = [];
  for (const [file, entry] of candidate) {
    if (custody) {
      if (!metadataSet.has(file)) omissions.push({ path: file, mode: entry.mode, blob: entry.sha ?? entry.blob });
      continue;
    }
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
    profile: custody ? "DOCUMENTATION_CUSTODY_METADATA_V1" : "DOCUMENTATION_ONLY_SOURCE_BOUND_V1",
    purpose,
    metadataPaths,
    anchor: DOCUMENTATION_CHECKOUT_ANCHOR,
    transportCertificate: DOCUMENTATION_CHECKOUT_CERTIFICATE_REVISION,
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

export async function documentationCheckoutReadSet({
  command,
  readOnlyCommand,
  root,
  git,
  baseSha,
  candidateSha,
  prNumber,
  purpose = "verification",
}) {
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
  const baseEntries = await tree(baseSha),
    candidateEntries = await tree(candidateSha),
    anchorEntries = await tree(DOCUMENTATION_CHECKOUT_ANCHOR);
  const base = inventory(baseEntries),
    anchor = inventory(anchorEntries);
  let reviewedEntries,
    certificateReader,
    profileSourceMatchesReviewed = false;
  if (
    base &&
    anchor &&
    [...new Set([...base.keys(), ...anchor.keys()])].some(
      (file) => key(base.get(file) ?? {}) !== key(anchor.get(file) ?? {}),
    ) &&
    /^[a-f0-9]{40}$/u.test(DOCUMENTATION_CHECKOUT_CERTIFICATE_REVISION)
  ) {
    const ancestors = (await command(["rev-list", baseSha])).split(/\r?\n/u);
    if (ancestors.includes(DOCUMENTATION_CHECKOUT_CERTIFICATE_REVISION)) {
      reviewedEntries = await tree(DOCUMENTATION_CHECKOUT_CERTIFICATE_REVISION);
      const installed = readFileSync(fileURLToPath(import.meta.url));
      const normalized = normalizedProfileSource(installed.toString("utf8"));
      const expectedBytes = normalized === null ? null : Buffer.from(normalized, "utf8");
      const expectedBlob = expectedBytes && gitBlob(expectedBytes);
      const reviewedProfile = inventory(reviewedEntries)?.get(profilePath);
      if (reviewedProfile?.mode === "100644" && reviewedProfile.sha === expectedBlob) {
        // Metadata fetch is blob:none and lazy transport is forbidden. Fetch
        // this exact, locally size-bound certificate reader before reading it.
        await command([
          "fetch",
          "--filter=blob:none",
          "--no-tags",
          "--no-recurse-submodules",
          "--no-write-fetch-head",
          "origin",
          expectedBlob,
        ]);
        const type = await command(["cat-file", "-t", expectedBlob]);
        const expected = await command(["cat-file", "blob", expectedBlob], undefined, true);
        if (
          type === "blob" &&
          Buffer.byteLength(expected, "utf8") === expectedBytes.length &&
          gitBlob(Buffer.from(expected, "utf8")) === expectedBlob
        ) {
          profileSourceMatchesReviewed = reviewedProfileSourceMatches(installed, expected, base.get(profilePath)?.sha);
          if (profileSourceMatchesReviewed)
            certificateReader = {
              revision: DOCUMENTATION_CHECKOUT_CERTIFICATE_REVISION,
              path: profilePath,
              blob: expectedBlob,
            };
        }
      }
    }
  }
  let proposal = documentationCheckoutProposal({
    baseEntries,
    candidateEntries,
    anchorEntries,
    reviewedEntries,
    profileSourceMatchesReviewed,
    prNumber,
    purpose,
  });
  let custodyProbe;
  if (DOCUMENTATION_CHECKOUT_MODE === "ACTIVE" && proposal.profile === "DOCUMENTATION_CUSTODY_METADATA_V1") {
    const checked = await probeDocumentationCustody({
      proposal,
      command,
      readOnlyCommand,
      root,
      git,
      baseSha,
      candidateSha,
      prNumber,
      baseEntries,
      candidateEntries,
    });
    proposal = checked.proposal;
    custodyProbe = checked.custodyProbe;
  }
  return {
    applied:
      DOCUMENTATION_CHECKOUT_MODE === "ACTIVE" &&
      ["DOCUMENTATION_ONLY_SOURCE_BOUND_V1", "DOCUMENTATION_CUSTODY_METADATA_V1"].includes(proposal.profile),
    proposal,
    custodyProbe,
    certificateReader,
  };
}

// The immutable reviewed commit contains the bootstrap literal PENDING. Only
// that one literal may differ; mode, whitespace and every executable byte stay exact.
const gitBlob = (bytes) =>
  createHash("sha1")
    .update(Buffer.from(`blob ${bytes.length}\0`))
    .update(bytes)
    .digest("hex");
function normalizedProfileSource(value) {
  const expression = /^export const DOCUMENTATION_CHECKOUT_CERTIFICATE_REVISION = "(?:PENDING|[a-f0-9]{40})";$/gmu;
  return [...value.matchAll(expression)].length === 1
    ? value.replace(expression, 'export const DOCUMENTATION_CHECKOUT_CERTIFICATE_REVISION = "PENDING";')
    : null;
}
export function reviewedProfileSourceMatches(installedBytes, reviewedSource, expectedBlob) {
  const bytes = Buffer.from(installedBytes),
    source = bytes.toString("utf8");
  if (!Buffer.from(source, "utf8").equals(bytes)) return false;
  const blob = gitBlob(bytes);
  const actual = normalizedProfileSource(source),
    expected = normalizedProfileSource(reviewedSource);
  return blob === expectedBlob && actual !== null && expected !== null && actual === expected;
}

export async function probeDocumentationCustody({
  proposal,
  command,
  readOnlyCommand,
  root,
  git,
  baseSha,
  candidateSha,
  prNumber,
  baseEntries,
  candidateEntries,
}) {
  const full = (reason) => ({ proposal: { profile: "FULL_SNAPSHOT", reason, qualification: false } });
  if (
    proposal.profile !== "DOCUMENTATION_CUSTODY_METADATA_V1" ||
    !root ||
    !git ||
    typeof readOnlyCommand !== "function"
  )
    return full("CUSTODY_PROBE_CONTEXT_UNAVAILABLE");
  const base = inventory(baseEntries),
    candidate = inventory(candidateEntries);
  if (
    !base ||
    !candidate ||
    !Array.isArray(proposal.metadataPaths) ||
    proposal.metadataPaths.length > 32 ||
    !proposal.metadataPaths.includes("testing/contracts.json") ||
    !proposal.metadataPaths.includes("testing/product-experience-exceptions.json")
  )
    return full("CUSTODY_PROBE_INPUT_UNAVAILABLE");
  await command(["merge-base", "--is-ancestor", baseSha, candidateSha]);
  const readers = [
    ...new Set([base, candidate].flatMap((tree) => proposal.metadataPaths.map((file) => tree.get(file)?.sha))),
  ];
  if (readers.some((sha) => !/^[a-f0-9]{40}$/u.test(sha ?? ""))) return full("CUSTODY_PROBE_INPUT_UNAVAILABLE");
  // One explicit small reader fetch. No lazy reads, remote refs or retry loop.
  await command([
    "fetch",
    "--filter=blob:none",
    "--no-tags",
    "--no-recurse-submodules",
    "--no-write-fetch-head",
    "origin",
    ...readers,
  ]);
  const input = path.join(root, ".git/ordinary-custody-probe.json");
  await writeFile(
    input,
    JSON.stringify({
      root,
      git,
      baseSha,
      candidateSha,
      prNumber,
      registryBlob: base.get("testing/product-experience-exceptions.json").sha,
    }),
    { flag: "wx" },
  );
  let result;
  try {
    result = JSON.parse(
      await readOnlyCommand(
        [fileURLToPath(new URL("./ordinary-custody-probe.mjs", import.meta.url)), input],
        process.execPath,
      ),
    );
  } catch (error) {
    // Only a reaped child payload/local probe deadline may fall back. Global
    // cancellation, total deadline or cleanup failures remain terminal failures.
    if (
      error instanceof SyntaxError ||
      /SOUNDING_LINE_SELECTED_CHECKOUT_(?:GIT_FAILED|PROBE_DEADLINE)$/u.test(error.message)
    )
      return full("CUSTODY_PROBE_UNCERTAIN");
    throw error;
  }
  if (
    result?.status !== "PASS" ||
    typeof result.campaign !== "boolean" ||
    result.baseSha !== baseSha ||
    result.candidateSha !== candidateSha ||
    result.prNumber !== prNumber ||
    result.registryBlob !== base.get("testing/product-experience-exceptions.json").sha ||
    result.transport !== "DISABLED" ||
    result.authority !== "READ_ONLY_FULL_ROUTE_HINT"
  )
    return full("CUSTODY_PROBE_UNCERTAIN");
  if (result.campaign)
    return {
      proposal: {
        profile: "FULL_SNAPSHOT",
        reason: "CAMPAIGN_REQUIRES_FULL_RESERVATION_READERS",
        qualification: false,
      },
      custodyProbe: result,
    };
  return { proposal, custodyProbe: result };
}
