import {
  TIDEGLASS_COMPARISON_POLICY_VERSION,
  TIDEGLASS_SEMANTIC_SCHEMA_VERSION,
  canonicalJson,
  semanticDigest,
  type EditionPair,
  type TideglassChangeSet,
} from "./core";

export type TideglassCanonicalCacheKey = {
  chronicleId: string;
  sourceEditionId: string;
  sourceChecksum: string;
  targetEditionId: string;
  targetChecksum: string;
  semanticSchemaVersion: typeof TIDEGLASS_SEMANTIC_SCHEMA_VERSION;
  comparisonPolicyVersion: typeof TIDEGLASS_COMPARISON_POLICY_VERSION;
};

export type TideglassCanonicalCacheEntry = {
  changeSet: TideglassChangeSet;
  sourceAdapters: string[];
  targetAdapters: string[];
};

export interface TideglassComparisonCache {
  getCanonicalChangeSet(key: TideglassCanonicalCacheKey): TideglassCanonicalCacheEntry | undefined;
  setCanonicalChangeSet(key: TideglassCanonicalCacheKey, value: TideglassCanonicalCacheEntry): void;
  invalidatePolicyVersion(version: string): number;
  clearCorruptEntry(key: TideglassCanonicalCacheKey): void;
}

function cacheIdentity(key: TideglassCanonicalCacheKey) {
  return canonicalJson(key);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function canonicalCacheKey(pair: EditionPair): TideglassCanonicalCacheKey {
  return {
    chronicleId: pair.chronicleId,
    sourceEditionId: pair.source.editionId,
    sourceChecksum: pair.source.editionChecksum,
    targetEditionId: pair.target.editionId,
    targetChecksum: pair.target.editionChecksum,
    semanticSchemaVersion: TIDEGLASS_SEMANTIC_SCHEMA_VERSION,
    comparisonPolicyVersion: TIDEGLASS_COMPARISON_POLICY_VERSION,
  };
}

export function hasValidChangeSetDigest(changeSet: TideglassChangeSet) {
  const { deterministicDigest: _digest, ...body } = changeSet;
  void _digest;
  return semanticDigest(body) === changeSet.deterministicDigest;
}

export class BoundedTideglassComparisonCache implements TideglassComparisonCache {
  private readonly entries = new Map<string, TideglassCanonicalCacheEntry>();

  constructor(private readonly capacity = 100) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1_000)
      throw new Error("INVALID_TIDEGLASS_CACHE_CAPACITY");
  }

  getCanonicalChangeSet(key: TideglassCanonicalCacheKey) {
    const identity = cacheIdentity(key);
    const entry = this.entries.get(identity);
    if (!entry) return undefined;
    if (!hasValidChangeSetDigest(entry.changeSet)) {
      this.entries.delete(identity);
      return undefined;
    }
    this.entries.delete(identity);
    this.entries.set(identity, entry);
    return clone(entry);
  }

  setCanonicalChangeSet(key: TideglassCanonicalCacheKey, value: TideglassCanonicalCacheEntry) {
    if (!hasValidChangeSetDigest(value.changeSet)) throw new Error("INVALID_TIDEGLASS_CACHE_DIGEST");
    const identity = cacheIdentity(key);
    this.entries.delete(identity);
    this.entries.set(identity, clone(value));
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (!oldest) break;
      this.entries.delete(oldest);
    }
  }

  invalidatePolicyVersion(version: string) {
    let removed = 0;
    for (const identity of this.entries.keys()) {
      const key = JSON.parse(identity) as TideglassCanonicalCacheKey;
      if (key.comparisonPolicyVersion === version) {
        this.entries.delete(identity);
        removed += 1;
      }
    }
    return removed;
  }

  clearCorruptEntry(key: TideglassCanonicalCacheKey) {
    this.entries.delete(cacheIdentity(key));
  }
}

export const tideglassComparisonCache = new BoundedTideglassComparisonCache();
