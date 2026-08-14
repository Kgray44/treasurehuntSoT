/* Persistent semantic identities for active Sounding Line test cases. */
import { createHash } from "node:crypto";

const digest = (value) => createHash("sha256").update(value).digest("hex");
const slug = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 64) || "case";

export const identityKey = ({ project = "", file, title, ordinal = 0 }) =>
  `${project}\u0000${file}\u0000${title}\u0000${ordinal}`;

export const proposedStableId = ({ suiteId, title, identityKey: key }) =>
  `sl-${slug(suiteId).replace(/^unit-|^component-|^browser-/u, "")}-${slug(title)}-${digest(key).slice(0, 10)}-v1`;

export function normalizeManifest(manifest) {
  if (!manifest || manifest.schemaVersion !== "1.0.0" || !Array.isArray(manifest.identities))
    throw new Error("STABLE_IDENTITY_MANIFEST_INVALID");
  const byStableId = new Map();
  const bySourceKey = new Map();
  const aliases = new Set();
  for (const entry of manifest.identities) {
    if (!/^sl-[a-z0-9][a-z0-9-]*-v\d+$/u.test(entry.stableId ?? ""))
      throw new Error(`STABLE_ID_FORMAT_INVALID:${entry.stableId ?? "missing"}`);
    if (byStableId.has(entry.stableId)) throw new Error(`DUPLICATE_STABLE_TEST_ID:${entry.stableId}`);
    byStableId.set(entry.stableId, entry);
    for (const key of entry.sourceKeys ?? []) {
      if (bySourceKey.has(key)) throw new Error(`DUPLICATE_STABLE_SOURCE_KEY:${key}`);
      bySourceKey.set(key, entry);
    }
    for (const alias of entry.legacyTestIds ?? []) {
      if (aliases.has(alias)) throw new Error(`DUPLICATE_STABLE_ALIAS:${alias}`);
      aliases.add(alias);
    }
  }
  const visiting = new Set();
  const complete = new Set();
  const visitSupersession = (stableId) => {
    if (complete.has(stableId)) return;
    if (visiting.has(stableId)) throw new Error(`STABLE_SUPERSESSION_CYCLE:${stableId}`);
    visiting.add(stableId);
    const predecessor = byStableId.get(stableId)?.supersedesId;
    if (predecessor) {
      if (!byStableId.has(predecessor)) throw new Error(`UNKNOWN_STABLE_SUPERSESSION:${predecessor}`);
      visitSupersession(predecessor);
    }
    visiting.delete(stableId);
    complete.add(stableId);
  };
  for (const stableId of byStableId.keys()) visitSupersession(stableId);
  return { byStableId, bySourceKey };
}

export function resolveStableIdentity({ manifest, sourceKey, suiteId, title, explicitStableId = null }) {
  const index = normalizeManifest(manifest);
  const sourceEntry = index.bySourceKey.get(sourceKey);
  const explicitEntry = explicitStableId ? index.byStableId.get(explicitStableId) : null;
  if (explicitStableId && !explicitEntry) throw new Error(`UNKNOWN_EXPLICIT_STABLE_TEST_ID:${explicitStableId}`);
  if (sourceEntry && explicitEntry && sourceEntry.stableId !== explicitEntry.stableId)
    throw new Error(`STABLE_IDENTITY_SOURCE_EXPLICIT_CONFLICT:${sourceKey}`);
  const entry = explicitEntry ?? sourceEntry;
  if (!entry) throw new Error(`MISSING_STABLE_TEST_ID:${sourceKey}`);
  if (entry.status && entry.status !== "ACTIVE") throw new Error(`STABLE_IDENTITY_NOT_ACTIVE:${entry.stableId}`);
  return {
    stableId: entry.stableId,
    historicalAliases: [...(entry.legacyTestIds ?? [])],
    relocated: Boolean(explicitEntry && !sourceEntry),
    expectedStableId: proposedStableId({ suiteId, title, identityKey: sourceKey }),
  };
}

export function previewStableIdentity({ sourceKey, suiteId, title, legacyTestId }) {
  return {
    stableId: proposedStableId({ suiteId, title, identityKey: sourceKey }),
    sourceKeys: [sourceKey],
    legacyTestIds: legacyTestId ? [legacyTestId] : [],
    status: "ACTIVE",
  };
}

export function assertNoSilentDisappearance(manifest, discoveredStableIds) {
  for (const entry of manifest.identities ?? []) {
    if ((entry.status ?? "ACTIVE") === "ACTIVE" && !discoveredStableIds.has(entry.stableId))
      throw new Error(`STABLE_TEST_ID_DISAPPEARED:${entry.stableId}`);
  }
}
