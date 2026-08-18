/* Durable identity rules for generated governed-test registry entries. */
import { createHash } from "node:crypto";

const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 20);
const normalize = (value) =>
  String(value ?? "")
    .replace(/\s+/gu, " ")
    .trim();

export function semanticTestId({ project = null, suiteId, file, title }) {
  if (!suiteId || !file || !title) throw new Error("SEMANTIC_TEST_ID_INPUT_REQUIRED");
  return `sl-semantic-${hash([project, suiteId, file.replaceAll("\\", "/"), normalize(title)])}`;
}

export function validateRegistryIdentity(cases) {
  const errors = [];
  const semanticOwners = new Map();
  const runtimeOwners = new Map();
  const aliases = new Map();
  for (const entry of cases ?? []) {
    if (!/^sl-test-[0-9a-f]{20}$/u.test(entry.id ?? ""))
      errors.push(`GENERATED_TEST_ID_INVALID:${entry.id ?? "missing"}`);
    if (!/^sl-semantic-[0-9a-f]{20}$/u.test(entry.semanticId ?? ""))
      errors.push(`SEMANTIC_TEST_ID_INVALID:${entry.id ?? "missing"}`);
    if (runtimeOwners.has(entry.id)) errors.push(`DUPLICATE_GENERATED_TEST_ID:${entry.id}`);
    runtimeOwners.set(entry.id, entry);
    if (semanticOwners.has(entry.semanticId)) errors.push(`DUPLICATE_SEMANTIC_TEST_ID:${entry.semanticId}`);
    semanticOwners.set(entry.semanticId, entry);
    for (const alias of entry.historicalAliases ?? []) {
      if (!/^sl-test-[0-9a-f]{20}$/u.test(alias)) errors.push(`HISTORICAL_ALIAS_INVALID:${alias}`);
      if (alias === entry.id) errors.push(`HISTORICAL_ALIAS_SELF_REFERENCE:${alias}`);
      const owner = aliases.get(alias);
      if (owner && owner.semanticId !== entry.semanticId) errors.push(`AMBIGUOUS_HISTORICAL_ALIAS:${alias}`);
      aliases.set(alias, entry);
    }
  }
  for (const alias of aliases.keys())
    if (runtimeOwners.has(alias)) errors.push(`HISTORICAL_ALIAS_COLLIDES_WITH_ACTIVE_ID:${alias}`);
  if (errors.length) throw new Error([...new Set(errors)].sort().join("\n"));
  return { semanticOwners, runtimeOwners, aliases };
}

// Generated IDs may include runtime discovery details such as a source line.
// Preserve every unambiguous prior representation under the unchanged
// semantic identity so historical ledgers keep resolving after regeneration.
export function carryForwardHistoricalAliases(cases, previousCases = []) {
  const previous = validateRegistryIdentity(previousCases);
  const errors = [];
  for (const entry of cases ?? []) {
    const prior = previous.semanticOwners.get(entry.semanticId);
    if (!prior) continue;
    const aliases = new Set([...(entry.historicalAliases ?? []), ...(prior.historicalAliases ?? [])]);
    if (prior.id !== entry.id) aliases.add(prior.id);
    aliases.delete(entry.id);
    entry.historicalAliases = [...aliases].sort();
  }
  try {
    validateRegistryIdentity(cases);
  } catch (error) {
    errors.push(String(error.message ?? error));
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return cases;
}

// v1.4.1 introduced semantic identities after some already-generated registry
// rows existed. A paused product branch may therefore contribute a legacy row
// with its stable generated ID but no semanticId. Rebind only an exact current
// generated ID; any missing correspondence remains a fail-closed migration
// error rather than being silently discarded.
export function reconcileLegacySemanticIds(cases, previousCases = []) {
  const currentById = new Map((cases ?? []).map((entry) => [entry.id, entry]));
  const errors = [];
  const reconciled = (previousCases ?? []).map((entry) => {
    if (/^sl-semantic-[0-9a-f]{20}$/u.test(entry.semanticId ?? "")) return entry;
    const current = currentById.get(entry.id);
    if (!current || !/^sl-semantic-[0-9a-f]{20}$/u.test(current.semanticId ?? "")) {
      errors.push(`LEGACY_SEMANTIC_MIGRATION_UNRESOLVED:${entry.id ?? "missing"}`);
      return entry;
    }
    return { ...entry, semanticId: current.semanticId };
  });
  if (errors.length) throw new Error([...new Set(errors)].sort().join("\n"));
  return reconciled;
}

export function resolveHistoricalTestIdentity(identity, cases) {
  const { semanticOwners, runtimeOwners, aliases } = validateRegistryIdentity(cases);
  const matches = [runtimeOwners.get(identity), semanticOwners.get(identity), aliases.get(identity)].filter(Boolean);
  const unique = [...new Map(matches.map((entry) => [entry.semanticId, entry])).values()];
  if (unique.length !== 1) throw new Error(`UNRESOLVED_HISTORICAL_TEST_IDENTITY:${identity}`);
  return unique[0];
}
