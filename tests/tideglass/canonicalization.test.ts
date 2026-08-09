import { describe, expect, it } from "vitest";
import { compareSemanticSnapshots } from "../../src/tideglass/comparison";
import {
  canonicalJson,
  TIDEGLASS_COMPARISON_POLICY_VERSION,
  TIDEGLASS_SEMANTIC_SCHEMA_VERSION,
} from "../../src/tideglass/core";
import { canonicalizePublishedSnapshot } from "../../src/tideglass/semantic";
import { anchor, baseSnapshot, clone } from "./fixtures";

function reverseObjectOrder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseObjectOrder);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .reverse()
        .map(([key, item]) => [key, reverseObjectOrder(item)]),
    );
  return value;
}

function semantic(snapshot: unknown, id: string, checksum = id, schemaVersion: number | string = 1) {
  const result = canonicalizePublishedSnapshot(JSON.stringify(snapshot), anchor(id, checksum, schemaVersion));
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

describe("Tideglass contracts and canonicalization", () => {
  it("F01 normalizes object/property ordering to identical semantics", () => {
    const original = baseSnapshot();
    const reordered = reverseObjectOrder(original);
    const result = compareSemanticSnapshots(
      semantic(original, "edition-a", "checksum-a"),
      semantic(reordered, "edition-b", "checksum-b"),
    );
    expect(result.status).toBe("NO_MEANINGFUL_CHANGE");
    expect(result.changes).toEqual([]);
  });

  it("F02 removes storage keys, derivative filenames, timestamps, and set ordering noise", () => {
    const source = baseSnapshot();
    const target = clone(source);
    target.publishedAt = "2030-12-31T23:59:59.999Z";
    target.assets[0].storageKey = "a/different/private/storage/key.webp";
    target.assets[0].filename = "regenerated-name.webp";
    target.assets[0].createdAt = "2030-01-01T00:00:00.000Z";
    target.assets[0].roles = ["BACKGROUND", "COVER"];
    (target.assets[0].variants as Array<Record<string, unknown>>)[0].storageKey = "different-variant-key";
    (target.assets[0].variants as Array<Record<string, unknown>>)[0].filename = "different-variant-name.webp";
    const result = compareSemanticSnapshots(semantic(source, "edition-a"), semantic(target, "edition-b"));
    expect(result.status).toBe("NO_MEANINGFUL_CHANGE");
  });

  it("F03 classifies public description and cover changes as presentation metadata", () => {
    const source = baseSnapshot();
    const target = clone(source);
    target.tale.shortDescription = "A different safe synthetic description.";
    target.tale.coverAssetId = "asset-cover-v2";
    const result = compareSemanticSnapshots(semantic(source, "edition-a"), semantic(target, "edition-b"));
    expect(result.changes).toHaveLength(2);
    expect(
      result.changes.every((change) => change.category === "PRESENTATION_METADATA" && change.kind === "MODIFIED"),
    ).toBe(true);
  });

  it("F05 preserves meaningful chapter ordering", () => {
    const source = baseSnapshot();
    const target = clone(source);
    const second = clone(target.chapters[0]);
    second.id = "chapter-second";
    second.title = "Second synthetic chapter";
    second.orderIndex = 1;
    second.blocks = [];
    second.entryBlockId = null;
    second.completionBlockId = null;
    target.chapters.push(second);
    const baseline = clone(target);
    target.chapters[0].orderIndex = 1;
    target.chapters[1].orderIndex = 0;
    const result = compareSemanticSnapshots(semantic(baseline, "edition-a"), semantic(target, "edition-b"));
    expect(result.changes.filter((change) => change.kind === "MOVED" && change.entityType === "CHAPTER")).toHaveLength(
      2,
    );
  });

  it("F06 preserves authored Story Block meaning and emits digests instead of raw prose", () => {
    const source = baseSnapshot();
    const target = clone(source);
    target.chapters[0].blocks[0].configuration = {
      ...(target.chapters[0].blocks[0].configuration as Record<string, unknown>),
      body: "A changed synthetic passage with a SECRET_SENTINEL value.",
    };
    const result = compareSemanticSnapshots(semantic(source, "edition-a"), semantic(target, "edition-b"));
    expect(result.changes.some((change) => change.category === "STORY_CONTENT" && change.kind === "MODIFIED")).toBe(
      true,
    );
    expect(JSON.stringify(result)).not.toContain("SECRET_SENTINEL");
  });

  it("F19 losslessly normalizes the supported historical fixture representation", () => {
    const current = baseSnapshot();
    const legacy = {
      schemaVersion: 0,
      chronicle: clone(current.tale),
      sections: clone(current.chapters),
      media: clone(current.assets),
      waypoints: clone(current.locations),
      artifacts: clone(current.artifacts),
    };
    const result = compareSemanticSnapshots(
      semantic(legacy, "edition-old", "checksum-old", 0),
      semantic(current, "edition-current", "checksum-current", 1),
    );
    expect(result.status).toBe("NO_MEANINGFUL_CHANGE");
  });

  it("F20 compares unaffected metadata while reporting an unsupported historical section", () => {
    const source = baseSnapshot();
    const target = clone(source);
    target.tale.title = "A changed catalog title";
    target.chapters[0].blocks[0].configuration = {
      ...(target.chapters[0].blocks[0].configuration as Record<string, unknown>),
      futureDrydockExpression: { dialect: "future" },
    };
    const result = compareSemanticSnapshots(semantic(source, "edition-a"), semantic(target, "edition-b"));
    expect(result.status).toBe("PARTIAL");
    expect(result.unsupportedSections.some((section) => section.code === "UNKNOWN_SEMANTICS")).toBe(true);
    expect(result.changes.some((change) => change.evidence.semanticPath === "metadata.title")).toBe(true);
  });

  it("does not infer removals or additions when either Chronicle semantic schema is wholly unavailable", () => {
    const unsupported = { schemaVersion: 99, unknowable: "PRIVATE_UNKNOWN_SENTINEL" };
    const result = compareSemanticSnapshots(
      semantic(baseSnapshot(), "edition-current", "checksum-current", 1),
      semantic(unsupported, "edition-unknown", "checksum-unknown", 99),
    );
    expect(result.status).toBe("PARTIAL");
    expect(result.changes).toEqual([]);
    expect(result.unsupportedSections).toContainEqual(
      expect.objectContaining({ section: "chronicle-semantics", code: "SCHEMA_UNSUPPORTED" }),
    );
    expect(JSON.stringify(result)).not.toContain("PRIVATE_UNKNOWN_SENTINEL");
  });

  it("reports missing artifact and location identity without inventing index-based matches", () => {
    const source = baseSnapshot();
    source.artifacts = [{ name: "Identity unavailable", persistentAfterUnlock: true }];
    source.locations = [{ name: "Identity unavailable", region: "Synthetic" }];
    const target = clone(source);
    target.artifacts[0].name = "Changed but still unidentified";
    target.locations[0].name = "Changed but still unidentified";
    const result = compareSemanticSnapshots(semantic(source, "edition-a"), semantic(target, "edition-b"));
    expect(result.status).toBe("PARTIAL");
    expect(result.unsupportedSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ section: "artifacts", code: "INVALID_SECTION" }),
        expect.objectContaining({ section: "locations", code: "INVALID_SECTION" }),
      ]),
    );
    expect(result.changes.some((change) => ["ARTIFACT", "LOCATION"].includes(change.entityType))).toBe(false);
  });

  it("preserves an explicit null configuration value instead of replacing it with a default", () => {
    const snapshot = baseSnapshot();
    (snapshot.chapters[0].blocks[0].configuration as Record<string, unknown>).heading = null;
    const normalized = semantic(snapshot, "edition-null");
    const heading = normalized.structure.blocks[0].facts.find((item) => item.path === "configuration.heading");
    expect(heading?.value).toBeNull();
  });

  it("rejects malformed current snapshots with a bounded contract failure", () => {
    const result = canonicalizePublishedSnapshot(
      '{"schemaVersion":1,"chapters":"invalid"}',
      anchor("edition-invalid", "checksum"),
    );
    expect(result).toMatchObject({ ok: false, code: "PUBLISHED_SNAPSHOT_INVALID" });
    expect(JSON.stringify(result)).not.toContain('chapters":"invalid');
  });

  it("binds every semantic result to explicit governed schema and policy versions", () => {
    const result = compareSemanticSnapshots(
      semantic(baseSnapshot(), "edition-a"),
      semantic(baseSnapshot(), "edition-b"),
    );
    expect(result.semanticSchemaVersion).toBe(TIDEGLASS_SEMANTIC_SCHEMA_VERSION);
    expect(result.comparisonPolicyVersion).toBe(TIDEGLASS_COMPARISON_POLICY_VERSION);
  });

  it("binds comparison identity to the exact Chronicle and edition anchors, not checksums alone", () => {
    const snapshot = baseSnapshot();
    const first = compareSemanticSnapshots(
      semantic(snapshot, "edition-source", "shared-source-checksum"),
      semantic(snapshot, "edition-target-a", "shared-target-checksum"),
    );
    const second = compareSemanticSnapshots(
      semantic(snapshot, "edition-source", "shared-source-checksum"),
      semantic(snapshot, "edition-target-b", "shared-target-checksum"),
    );
    expect(second.comparisonId).not.toBe(first.comparisonId);
  });

  it("F26 keeps canonical output byte-stable under shuffled property and set-like input order", () => {
    const source = baseSnapshot();
    const target = clone(source);
    target.tale.title = "Changed synthetic title";
    target.assets[0].roles = ["BACKGROUND", "COVER"];
    const first = compareSemanticSnapshots(
      semantic(source, "edition-a", "fixed-source-checksum"),
      semantic(target, "edition-b", "fixed-target-checksum"),
    );
    const second = compareSemanticSnapshots(
      semantic(reverseObjectOrder(source), "edition-a", "fixed-source-checksum"),
      semantic(reverseObjectOrder(target), "edition-b", "fixed-target-checksum"),
    );
    expect(second.deterministicDigest).toBe(first.deterministicDigest);
    expect(canonicalJson(second)).toBe(canonicalJson(first));
  });
});
