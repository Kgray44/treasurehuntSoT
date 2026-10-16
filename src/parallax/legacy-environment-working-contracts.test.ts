import { describe, expect, it } from "vitest";
import { canonicalChecksum } from "@/drydock/canonical";
import { environmentReferenceSchema } from "./environment-reference";
import { environmentVersionSchema } from "./legacy-scene-environment-contracts";
import {
  checkedLegacyEnvironmentWorking,
  createLegacyEnvironmentWorking,
  legacyEnvironmentMembership,
  legacyEnvironmentWorkingRowId,
  legacyEnvironmentWorkingSchema,
  materializeLegacyEnvironmentVersion,
} from "./legacy-environment-working-contracts";
import legacyBuiltins from "./builtin-environments.v1.json";

function fixture() {
  const source = environmentVersionSchema.parse(legacyBuiltins[0]);
  const content = { ...structuredClone(source.content), id: "owned-legacy-room", origin: "MANUAL" as const };
  const working = createLegacyEnvironmentWorking(content, source.reference, {
    operationId: "synthetic-copy-operation",
    sourceDefinitionId: source.reference.environmentId,
    sourceRevision: 19,
    requestDigest: "a".repeat(64),
  });
  return {
    source,
    working,
    row: {
      id: legacyEnvironmentWorkingRowId(working.id),
      itemId: working.id,
      versionNumber: 0,
      envelope: JSON.stringify(working),
      checksum: canonicalChecksum(working),
    },
  };
}

describe("schema-one Environment working and release contracts", () => {
  it("retains content and explicit lineage without inventing a current immutable pin or organization metadata", () => {
    const { source, working } = fixture();
    expect(working.source).toEqual(source.reference);
    expect(working.metadata).toEqual({ tags: null, collection: null, favorite: null });
    expect(working).not.toHaveProperty("reference");
    expect(working).not.toHaveProperty("current");
    expect(working.content.fixtures).toEqual(source.content.fixtures);
    expect(working.content.evidence).toEqual(source.content.evidence);
    const before = canonicalChecksum(source);
    working.content.name = "Only this owned working copy";
    expect(canonicalChecksum(source)).toBe(before);
  });

  it("keeps mutable v0 separate from positive Environment release envelopes", () => {
    const { working, row } = fixture();
    expect(checkedLegacyEnvironmentWorking(row, working.id)).toEqual(working);
    expect(environmentVersionSchema.safeParse(working).success).toBe(false);
    expect(environmentReferenceSchema.safeParse({ ...working.source, revision: 0 }).success).toBe(false);
    expect(() => checkedLegacyEnvironmentWorking({ ...row, versionNumber: 1 }, working.id)).toThrow();
  });

  it.each(["id", "itemId", "checksum", "envelope"] as const)("rejects a corrupted working %s", (field) => {
    const { working, row } = fixture();
    if (field === "envelope") {
      const changed = structuredClone(working);
      changed.content.name = "Unverified change";
      row.envelope = JSON.stringify(changed);
    } else row[field] = field === "checksum" ? "0".repeat(64) : "another-definition";
    expect(() => checkedLegacyEnvironmentWorking(row, working.id)).toThrow();
  });

  it("uses the explicit positive ordinal and full opaque version ID without mutating working or source content", () => {
    const { source, working } = fixture();
    const before = canonicalChecksum(working);
    const sourceBefore = canonicalChecksum(source);
    const released = materializeLegacyEnvironmentVersion(working, 3, "v".repeat(150));
    expect(working.creation.sourceRevision).toBe(19);
    expect(released.reference.revision).toBe(3);
    expect(released.reference.versionId).toHaveLength(150);
    expect(released.reference.checksum).toBe(canonicalChecksum(working.content));
    expect(canonicalChecksum(working)).toBe(before);
    expect(canonicalChecksum(source)).toBe(sourceBefore);
    expect(() => materializeLegacyEnvironmentVersion(working, 0, "invalid-zero-version")).toThrow();
  });

  it("rejects a changed content identity or contradictory creation source", () => {
    const { working } = fixture();
    expect(legacyEnvironmentWorkingSchema.safeParse({ ...working, id: "different-definition" }).success).toBe(false);
    expect(
      legacyEnvironmentWorkingSchema.safeParse({
        ...working,
        creation: { ...working.creation, sourceDefinitionId: "different-source" },
      }).success,
    ).toBe(false);
  });

  it("classifies historical membership conservatively instead of inferring it from released versions", () => {
    expect(legacyEnvironmentMembership("ACTIVE")).toBe("LEGACY_REVIEW");
    expect(legacyEnvironmentMembership("UNKNOWN")).toBe("LEGACY_REVIEW");
    expect(legacyEnvironmentMembership("WORKING")).toBe("WORKING");
    expect(legacyEnvironmentMembership("SAVED")).toBe("SAVED");
  });
});
