import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BoundedTideglassComparisonCache, canonicalCacheKey, hasValidChangeSetDigest } from "../../src/tideglass/cache";
import { compareExactEditions } from "../../src/tideglass/service";
import { baseSnapshot, clone, edition, FixtureRepository } from "./fixtures";

async function comparison(cache: BoundedTideglassComparisonCache) {
  const source = edition("edition-a", baseSnapshot());
  const targetSnapshot = clone(baseSnapshot());
  targetSnapshot.tale.playerCountMax = 8;
  const target = edition("edition-b", targetSnapshot);
  const request = {
    chronicleId: "chronicle-tideglass",
    sourceEditionId: source.id,
    targetEditionId: target.id,
  };
  const first = await compareExactEditions(
    new FixtureRepository([source, target]),
    { kind: "ACCOUNT", accountId: "creator" },
    request,
    { cache },
  );
  const second = await compareExactEditions(
    new FixtureRepository([source, target]),
    { kind: "ACCOUNT", accountId: "creator" },
    request,
    { cache },
  );
  if (!first.ok || !second.ok) throw new Error("comparison failed");
  return { first: first.value, second: second.value };
}

describe("Tideglass Phase 2 cache and migration contracts", () => {
  it("keys immutable canonical comparisons by exact pair, checksums, and both Phase 1 policy versions", async () => {
    const cache = new BoundedTideglassComparisonCache(2);
    const { first, second } = await comparison(cache);
    expect(first.operation.cacheStatus).toBe("MISS");
    expect(second.operation.cacheStatus).toBe("HIT");
    const key = canonicalCacheKey(first.changeSet.pair);
    expect(key).toMatchObject({
      sourceChecksum: first.changeSet.pair.source.editionChecksum,
      targetChecksum: first.changeSet.pair.target.editionChecksum,
      semanticSchemaVersion: "tideglass.semantic.v1",
      comparisonPolicyVersion: "tideglass.policy.v1",
    });
    expect(JSON.stringify(key)).not.toMatch(/player|history|participant|memory|keepsake|draft/i);
  });

  it("detects and evicts a corrupt cache entry so immutable sources can rebuild it", async () => {
    const cache = new BoundedTideglassComparisonCache(2);
    const { first } = await comparison(cache);
    const key = canonicalCacheKey(first.changeSet.pair);
    const internal = cache as unknown as { entries: Map<string, { changeSet: typeof first.changeSet }> };
    const stored = internal.entries.values().next().value;
    if (!stored) throw new Error("missing test entry");
    stored.changeSet.status = "PARTIAL";
    expect(hasValidChangeSetDigest(stored.changeSet)).toBe(false);
    const rebuilt = await compareExactEditions(
      new FixtureRepository([
        edition("edition-a", baseSnapshot()),
        edition("edition-b", { ...baseSnapshot(), tale: { ...baseSnapshot().tale, playerCountMax: 8 } }),
      ]),
      { kind: "ACCOUNT", accountId: "creator" },
      { chronicleId: "chronicle-tideglass", sourceEditionId: "edition-a", targetEditionId: "edition-b" },
      { cache },
    );
    expect(rebuilt.ok && rebuilt.value.operation.cacheStatus).toBe("CORRUPT_REBUILT");
    expect(cache.readCanonicalChangeSet(key).status).toBe("HIT");
  });

  it("misses for the reverse pair and invalidates the exact comparison policy", async () => {
    const cache = new BoundedTideglassComparisonCache(2);
    const source = edition("edition-a", baseSnapshot());
    const targetSnapshot = clone(baseSnapshot());
    targetSnapshot.tale.playerCountMax = 8;
    const target = edition("edition-b", targetSnapshot);
    const repository = new FixtureRepository([source, target]);
    const principal = { kind: "ACCOUNT" as const, accountId: "creator" };
    const forward = await compareExactEditions(
      repository,
      principal,
      { chronicleId: "chronicle-tideglass", sourceEditionId: source.id, targetEditionId: target.id },
      { cache },
    );
    const reverse = await compareExactEditions(
      repository,
      principal,
      { chronicleId: "chronicle-tideglass", sourceEditionId: target.id, targetEditionId: source.id },
      { cache },
    );
    expect(forward.ok && forward.value.operation.cacheStatus).toBe("MISS");
    expect(reverse.ok && reverse.value.operation.cacheStatus).toBe("MISS");
    expect(cache.invalidatePolicyVersion("tideglass.policy.v1")).toBe(2);
    expect(forward.ok && cache.getCanonicalChangeSet(canonicalCacheKey(forward.value.changeSet.pair))).toBeUndefined();
  });

  it("evicts least-recently-used entries at the configured bound", async () => {
    const cache = new BoundedTideglassComparisonCache(1);
    const { first } = await comparison(cache);
    const firstKey = canonicalCacheKey(first.changeSet.pair);
    const secondKey = { ...firstKey, targetEditionId: "edition-c", targetChecksum: "c".repeat(64) };
    cache.setCanonicalChangeSet(secondKey, {
      changeSet: first.changeSet,
      sourceAdapters: [],
      targetAdapters: [],
    });
    expect(cache.getCanonicalChangeSet(firstKey)).toBeUndefined();
    expect(cache.getCanonicalChangeSet(secondKey)).toBeDefined();
  });

  it("declares provider-parity annotation models and additive migration SQL", async () => {
    const root = process.cwd();
    const [sqliteSchema, mysqlSchema, sqliteMigration, mysqlMigration] = await Promise.all([
      fs.readFile(path.join(root, "prisma/schema.sqlite.prisma"), "utf8"),
      fs.readFile(path.join(root, "prisma/schema.prisma"), "utf8"),
      fs.readFile(
        path.join(root, "prisma/migrations/20260809130000_tideglass_phase2_creator_annotations/migration.sql"),
        "utf8",
      ),
      fs.readFile(
        path.join(root, "prisma/mysql-migrations/0053_tideglass_phase2_creator_annotations/migration.sql"),
        "utf8",
      ),
    ]);
    for (const source of [sqliteSchema, mysqlSchema, sqliteMigration, mysqlMigration]) {
      expect(source).toContain("TideglassCreatorAnnotation");
      for (const field of [
        "annotationKey",
        "revision",
        "chronicleId",
        "sourceEditionId",
        "sourceEditionChecksum",
        "targetEditionId",
        "targetEditionChecksum",
        "comparisonPolicyVersion",
        "supersedesAnnotationId",
        "state",
      ])
        expect(source).toContain(field);
    }
    expect(sqliteMigration).not.toMatch(/DROP\s+TABLE|DROP\s+COLUMN|DELETE\s+FROM|TRUNCATE/iu);
    expect(mysqlMigration).not.toMatch(/DROP\s+TABLE|DROP\s+COLUMN|DELETE\s+FROM|TRUNCATE/iu);
  });
});
