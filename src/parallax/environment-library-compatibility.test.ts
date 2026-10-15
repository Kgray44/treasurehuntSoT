import { beforeEach, expect, it, vi } from "vitest";
import { canonicalChecksum } from "@/drydock/canonical";
import { createRoomEnvironment } from "./environment-authoring";
import { simulationEnvironments } from "./studio-validation";
import { createEnvironmentDraft, environmentVersionSchema } from "./library-lifecycle-contracts";
import legacyBuiltins from "./builtin-environments.v1.json";
import { listCompatibleEnvironments } from "./environment-library-compatibility";
import { createLegacyEnvironmentWorking, legacyEnvironmentWorkingRowId } from "./legacy-environment-working-contracts";
const probe = vi.hoisted(() => ({ list: vi.fn(), legacy: vi.fn() }));
vi.mock("./library-lifecycle-service", () => ({ listEnvironmentDefinitions: probe.list }));
vi.mock("@/lib/db", () => ({ db: {} }));
const store = { reusableAuthoringItem: { findMany: probe.legacy } };
beforeEach(() => {
  vi.clearAllMocks();
  probe.list.mockResolvedValue([]);
  probe.legacy.mockResolvedValue([]);
});
function working() {
  const draft = createEnvironmentDraft("large-working", createRoomEnvironment(simulationEnvironments[0]));
  draft.room!.width = 30;
  draft.room!.depth = 40;
  draft.collection = "Synthetic private collection";
  return {
    id: draft.id,
    revision: 19,
    draft,
    saveState: "WORKING",
    archived: false,
    updatedAt: "2026-10-15T00:00:00.000Z",
    lastUsedAt: null,
    usageCount: 0,
    releases: [],
  };
}
it("keeps working membership, metadata and geometry without inventing an immutable current pin", async () => {
  const original = working();
  probe.list.mockResolvedValue([original]);
  const results = await listCompatibleEnvironments("owner", store as never);
  const result = results.find((r) => r.id === original.id)!;
  expect(result.representation).toBe("LIFECYCLE_V1");
  expect(result.saveState).toBe("WORKING");
  expect(result.revision).toBe(19);
  expect(result.working).toEqual(original.draft);
  expect(result.versions).toEqual([]);
  expect(result).not.toHaveProperty("current");
  expect(probe.list).toHaveBeenCalledWith("owner", store);
  expect(probe.legacy).toHaveBeenCalledWith(
    expect.objectContaining({ where: { ownerAccountId: "owner", kind: "PARALLAX_ENVIRONMENT" } }),
  );
});
it("retains authoritative inventory usage metadata without rereading raw zero-count definitions", async () => {
  const enriched = { ...working(), saveState: "SAVED" as const, usageCount: 2, lastUsedAt: "2026-10-15T01:00:00.000Z" };
  const results = await listCompatibleEnvironments("owner", store as never, [enriched]);
  const result = results.find((record) => record.id === enriched.id)!;
  expect(result.representation).toBe("LIFECYCLE_V1");
  if (result.representation === "LIFECYCLE_V1") expect(result.lifecycle).toBe(enriched);
  expect(probe.list).not.toHaveBeenCalled();
});
it("retains long exact release pins without using mutable CAS revision or changing original bytes", async () => {
  const original = working();
  const value = environmentVersionSchema.parse({
    format: "PARALLAX_ENVIRONMENT_VERSION_1",
    id: "v".repeat(150),
    definitionId: original.id,
    number: 1,
    createdAt: original.updatedAt,
    notes: "Synthetic",
    content: original.draft,
  });
  const checksum = canonicalChecksum(value);
  probe.list.mockResolvedValue([
    { ...original, saveState: "SAVED", releases: [{ ...value, checksum, usageCount: 2 }] },
  ]);
  const results = await listCompatibleEnvironments("owner", store as never);
  const result = results.find((r) => r.id === original.id)!;
  expect(result.versions[0].reference).toEqual({
    environmentId: original.id,
    versionId: value.id,
    revision: 1,
    checksum,
  });
  if (result.representation === "LIFECYCLE_V1") expect(result.versions[0].room).toEqual(original.draft.room);
  expect(canonicalChecksum(value)).toBe(checksum);
});
it("keeps archived legacy releases discoverable without asserting private Library membership", async () => {
  const value = structuredClone(legacyBuiltins[0]);
  value.content.id = "legacy-room";
  value.content.origin = "MANUAL";
  value.reference = {
    environmentId: value.content.id,
    versionId: "legacy-room:e1",
    revision: 1,
    checksum: canonicalChecksum(value.content),
  };
  const envelope = JSON.stringify(value);
  probe.legacy.mockResolvedValue([
    {
      id: value.content.id,
      ownerAccountId: "owner",
      currentVersionNumber: 8,
      archivedAt: new Date(),
      versions: [
        {
          id: value.reference.versionId,
          itemId: value.content.id,
          versionNumber: 1,
          checksum: value.reference.checksum,
          envelope,
        },
      ],
    },
  ]);
  const results = await listCompatibleEnvironments("owner", store as never);
  const result = results.find((r) => r.id === value.content.id)!;
  expect(result.saveState).toBe("LEGACY_REVIEW");
  expect(result.archived).toBe(true);
  expect(result.working).toBeNull();
  expect(result.versions).toEqual([value]);
  expect(result).not.toHaveProperty("current");
});

it.each(["WORKING", "SAVED", "ACTIVE"])(
  "keeps typed v0 separate from positive versions and honors %s membership",
  async (status) => {
    const release = structuredClone(legacyBuiltins[0]);
    release.content.id = "legacy-working-room";
    release.content.origin = "MANUAL";
    release.reference = {
      environmentId: release.content.id,
      versionId: "v".repeat(150),
      revision: 1,
      checksum: canonicalChecksum(release.content),
    };
    const document = createLegacyEnvironmentWorking(release.content as never, release.reference, {
      operationId: "synthetic-begin",
      sourceDefinitionId: release.content.id,
      sourceRevision: 8,
      requestDigest: "a".repeat(64),
    });
    document.content.name = "Working name only";
    document.metadata.collection = "Owner selected collection";
    const releaseEnvelope = JSON.stringify(release);
    const workingEnvelope = JSON.stringify(document);
    const item = {
      id: document.id,
      ownerAccountId: "owner",
      currentVersionNumber: 19,
      status,
      archivedAt: null,
      versions: [
        {
          id: legacyEnvironmentWorkingRowId(document.id),
          itemId: document.id,
          versionNumber: 0,
          checksum: canonicalChecksum(document),
          envelope: workingEnvelope,
        },
        {
          id: release.reference.versionId,
          itemId: document.id,
          versionNumber: 1,
          checksum: release.reference.checksum,
          envelope: releaseEnvelope,
        },
      ],
    };
    probe.legacy.mockResolvedValue([item]);
    const result = (await listCompatibleEnvironments("owner", store as never)).find((r) => r.id === item.id)!;
    expect(result.saveState).toBe(status === "ACTIVE" ? "LEGACY_REVIEW" : status);
    expect(result.revision).toBe(19);
    expect(result.working).toEqual(document);
    expect(result.versions).toEqual([release]);
    expect(result).not.toHaveProperty("current");
    expect(item.versions[0].envelope).toBe(workingEnvelope);
    expect(item.versions[1].envelope).toBe(releaseEnvelope);
  },
);
