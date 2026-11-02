// Transport observations only. Production ordinary checkout never invokes this
// module's planner. No observation is a read-set or Mainline certificate.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

export const NONCAMPAIGN_CUSTODY_SHADOW_PROFILE = "NONCAMPAIGN_CUSTODY_METADATA_SHADOW_V1";
const policyPath = new URL("../../testing/noncampaign-custody-shadow-readers.json", import.meta.url);
const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
const observations = new WeakMap();
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const digest = (value) => hash(Buffer.from(JSON.stringify(value)));
const oid = (value) => typeof value === "string" && value.length === 40 && /^[a-f0-9]+$/u.test(value);
const safe = (value) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 4096 &&
  !/[\\\x00-\x1f\x7f\ufffd]/u.test(value) &&
  value.split("/").every((part) => part && part !== "." && part !== "..");
const need = (value, code) => {
  if (!value) throw Error(`SOUNDING_LINE_CUSTODY_SHADOW_${code}`);
};
need(
  policy.version === 1 &&
    policy.status === "SHADOW_NOT_A_READ_SET_CERTIFICATE" &&
    policy.readerObservationSource === "bfe39895d16562c68391a3279a1729ae3235bb3d" &&
    digest(policy.readers) === "c8014dc9ae0d53409917138448ddbbbaf4a75e42164c13d89f73b1b59c397e76" &&
    digest(policy.metadata) === "3b45f3cb53056ae24523a084741eabe4b8d3a37962a56f0a15b97fd154121412" &&
    JSON.stringify(policy.excludedPullRequests) === "[721,776,805,820]" &&
    policy.maximumMetadataPaths === 64,
  "FIXED_POLICY_CHANGED",
);
const full = (reason) =>
  Object.freeze({ profile: "FULL_SNAPSHOT", reason, applied: false, certificate: "NOT_ISSUED", qualification: false });
const identity = (row) => (row ? `${row.mode} ${row.type} ${row.blob}` : null);
function inventory(rows) {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 100000) return null;
  const result = new Map();
  for (const row of rows) {
    if (
      !row ||
      !safe(row.path) ||
      !oid(row.blob) ||
      row.type !== "blob" ||
      !["100644", "100755", "120000"].includes(row.mode) ||
      result.has(row.path)
    )
      return null;
    result.set(row.path, { path: row.path, mode: row.mode, type: row.type, blob: row.blob });
  }
  return result;
}
const byteOrder = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));
function frozenProposal(value) {
  for (const row of value.omissions) Object.freeze(row);
  Object.freeze(value.omissions);
  Object.freeze(value.metadataPaths);
  Object.freeze(value.changedPaths);
  return Object.freeze(value);
}
export function proposeNoncampaignCustodyShadow({
  baseSha,
  candidateSha,
  baseEntries,
  candidateEntries,
  purpose,
  prNumber,
}) {
  if (
    purpose !== "campaign-custody" ||
    !Number.isSafeInteger(prNumber) ||
    prNumber < 1 ||
    policy.excludedPullRequests.includes(prNumber)
  )
    return full("PURPOSE_OR_OWNER_EXCLUDED");
  if (!oid(baseSha) || !oid(candidateSha)) return full("UNBOUND_SOURCE");
  const base = inventory(baseEntries),
    candidate = inventory(candidateEntries);
  if (!base || !candidate) return full("UNKNOWN_COMPLETE_INVENTORY");
  for (const pin of policy.readers)
    if (
      base.get(pin.path)?.mode !== pin.mode ||
      base.get(pin.path)?.blob !== pin.blob ||
      candidate.get(pin.path)?.mode !== pin.mode ||
      candidate.get(pin.path)?.blob !== pin.blob
    )
      return full("INSTALLED_READER_CHANGED");
  for (const pin of policy.metadata)
    if (
      base.get(pin.path)?.mode !== pin.mode ||
      candidate.get(pin.path)?.mode !== pin.mode ||
      base.get(pin.path)?.blob !== pin.blob ||
      candidate.get(pin.path)?.blob !== pin.blob
    )
      return full("REGISTRY_OR_CONTRACT_CHANGED");
  const attributes = [
    ...new Set(
      [...base.keys(), ...candidate.keys()].filter(
        (file) => file === ".gitattributes" || file.endsWith("/.gitattributes"),
      ),
    ),
  ];
  if (
    attributes.some(
      (file) => base.get(file)?.mode !== "100644" || identity(base.get(file)) !== identity(candidate.get(file)),
    )
  )
    return full("ATTRIBUTE_POLICY_CHANGED");
  const metadataPaths = [...policy.metadata.map((row) => row.path), ...attributes].sort(byteOrder);
  if (metadataPaths.length > policy.maximumMetadataPaths) return full("METADATA_PATH_BOUND");
  const changedPaths = [...new Set([...base.keys(), ...candidate.keys()])]
    .filter((file) => identity(base.get(file)) !== identity(candidate.get(file)))
    .sort(byteOrder);
  if (!changedPaths.length) return full("UNCHANGED_CANDIDATE");
  const keep = new Set(metadataPaths),
    omissions = [...candidate.values()].filter((row) => !keep.has(row.path)).sort((a, b) => byteOrder(a.path, b.path));
  return frozenProposal({
    profile: NONCAMPAIGN_CUSTODY_SHADOW_PROFILE,
    purpose,
    baseSha,
    candidateSha,
    prNumber,
    readerObservationSource: policy.readerObservationSource,
    readerDigest: digest(policy.readers),
    metadataPaths,
    changedPaths,
    omissions,
    omittedInventoryDigest: digest(omissions),
    completePathnameInventoryDigest: digest([...candidate.keys()].sort(byteOrder)),
    historicalReaders: "NEGATIVE_ROUTE_PROOF_REQUIRED_NOT_ASSUMED",
    sourceCertificate: "NOT_ISSUED",
    applied: false,
    qualification: false,
    reuseAuthorized: false,
  });
}

export function parseCustodyShadowTree(bytes) {
  need(Buffer.isBuffer(bytes) && bytes.length <= 16 * 1024 ** 2, "TREE_BOUND");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  need(text.endsWith("\0"), "TREE_TERMINATOR");
  const rows = text
    .slice(0, -1)
    .split("\0")
    .map((row) => {
      const match = /^(100644|100755|120000) blob ([a-f0-9]{40})\t(.+)$/u.exec(row);
      need(match, "TREE_METADATA");
      return { mode: match[1], type: "blob", blob: match[2], path: match[3] };
    });
  need(inventory(rows), "TREE_INVENTORY");
  return rows;
}

// This performs the existing read-only hint only. The actual installed reserve
// command must independently return campaign=false in the native pilot. No
// caller boolean or serialized proposal can mint even this opaque observation.
export async function observeNoncampaignCustodyShadow({
  command,
  readOnlyCommand,
  root,
  git,
  baseSha,
  candidateSha,
  prNumber,
}) {
  if (!Number.isSafeInteger(prNumber) || prNumber < 1 || policy.excludedPullRequests.includes(prNumber))
    return { applied: false, proposal: full("PURPOSE_OR_OWNER_EXCLUDED") };
  if (!oid(baseSha) || !oid(candidateSha)) return { applied: false, proposal: full("UNBOUND_SOURCE") };
  let baseEntries, candidateEntries;
  try {
    baseEntries = parseCustodyShadowTree(await command(["ls-tree", "-rz", baseSha], undefined, true));
    candidateEntries = parseCustodyShadowTree(await command(["ls-tree", "-rz", candidateSha], undefined, true));
  } catch (error) {
    if (
      error.code === "ERR_ENCODING_INVALID_ENCODED_DATA" ||
      /^SOUNDING_LINE_CUSTODY_SHADOW_TREE_/u.test(error.message)
    )
      return { applied: false, proposal: full("UNKNOWN_COMPLETE_INVENTORY") };
    throw error;
  }
  const proposal = proposeNoncampaignCustodyShadow({
    baseSha,
    candidateSha,
    baseEntries,
    candidateEntries,
    purpose: "campaign-custody",
    prNumber,
  });
  if (proposal.profile === "FULL_SNAPSHOT") return { applied: false, proposal };
  need(path.isAbsolute(root) && path.isAbsolute(git) && typeof readOnlyCommand === "function", "PROBE_CONTEXT");
  await command(["merge-base", "--is-ancestor", baseSha, candidateSha]);
  const base = inventory(baseEntries),
    candidate = inventory(candidateEntries);
  const blobs = [
    ...new Set([base, candidate].flatMap((entries) => proposal.metadataPaths.map((file) => entries.get(file).blob))),
  ];
  await command([
    "fetch",
    "--filter=blob:none",
    "--no-tags",
    "--no-recurse-submodules",
    "--no-write-fetch-head",
    "origin",
    ...blobs,
  ]);
  const input = path.join(root, ".git/noncampaign-custody-shadow-probe.json");
  fs.writeFileSync(
    input,
    JSON.stringify({
      root,
      git,
      baseSha,
      candidateSha,
      prNumber,
      registryBlob: base.get("testing/product-experience-exceptions.json").blob,
    }),
    { flag: "wx" },
  );
  let hint;
  try {
    hint = JSON.parse(
      await readOnlyCommand(
        [fileURLToPath(new URL("./ordinary-custody-probe.mjs", import.meta.url)), input],
        process.execPath,
      ),
    );
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      /SOUNDING_LINE_SELECTED_CHECKOUT_(?:GIT_FAILED|PROBE_DEADLINE)$/u.test(error.message)
    )
      return { applied: false, proposal: full("CUSTODY_PROBE_UNCERTAIN") };
    throw error;
  }
  if (
    hint?.status !== "PASS" ||
    typeof hint.campaign !== "boolean" ||
    hint.baseSha !== baseSha ||
    hint.candidateSha !== candidateSha ||
    hint.prNumber !== prNumber ||
    hint.registryBlob !== base.get("testing/product-experience-exceptions.json").blob ||
    hint.transport !== "DISABLED" ||
    hint.authority !== "READ_ONLY_FULL_ROUTE_HINT"
  )
    return { applied: false, proposal: full("CUSTODY_PROBE_UNCERTAIN") };
  if (hint.campaign) return { applied: false, proposal: full("CAMPAIGN_REQUIRES_FULL"), custodyProbe: hint };
  const handle = Object.freeze({
    kind: "NONCAMPAIGN_CUSTODY_SHADOW_OBSERVATION",
    qualification: false,
    certificate: "NOT_ISSUED",
  });
  observations.set(handle, {
    root: path.resolve(root),
    baseSha,
    candidateSha,
    prNumber,
    proposal,
    hint: Object.freeze({ ...hint }),
  });
  return { applied: false, observed: true, proposal, custodyProbe: hint, shadowObservation: handle, shadowOnly: true };
}
export function inspectNoncampaignCustodyShadow(handle, { root, baseSha, candidateSha }) {
  const value = observations.get(handle);
  if (!value || value.root !== path.resolve(root) || value.baseSha !== baseSha || value.candidateSha !== candidateSha)
    return null;
  return Object.freeze({
    proposal: value.proposal,
    custodyProbe: value.hint,
    prNumber: value.prNumber,
    shadowOnly: true,
    qualification: false,
    certificate: "NOT_ISSUED",
  });
}
