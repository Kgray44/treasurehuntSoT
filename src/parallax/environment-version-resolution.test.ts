import { beforeEach, expect, it, vi } from "vitest";
import { canonicalChecksum } from "@/drydock/canonical";
import { createRoomEnvironment } from "./environment-authoring";
import {
  createEnvironmentDraft,
  environmentVersionSchema,
  type EnvironmentReleaseRow,
} from "./library-lifecycle-contracts";
import { simulationEnvironments } from "./studio-validation";
import {
  assertPinnedSceneEnvironment,
  environmentReleaseReference,
  resolvePinnedEnvironment,
} from "./environment-version-resolution";
import { createSpatialDraft, editSpatialDraft, draftSchema } from "./authoring";
import legacyBuiltins from "./builtin-environments.v1.json";

vi.mock("@/lib/db", () => ({ db: {} }));
const items = new Map<
  string,
  { id: string; ownerAccountId: string; kind: string; currentVersionNumber: number; archivedAt: Date | null }
>();
const releases: EnvironmentReleaseRow[] = [];
const store = {
  reusableAuthoringItem: {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => items.get(where.id) ?? null),
  },
  reusableAuthoringItemVersion: {
    findFirst: vi.fn(
      async ({ where }: { where: Record<string, unknown> }) =>
        releases.find((row) =>
          Object.entries(where).every(([key, value]) => row[key as keyof EnvironmentReleaseRow] === value),
        ) ?? null,
    ),
  },
};
const owner = "creator-synthetic";
const resolve = (pin: unknown, account = owner) => resolvePinnedEnvironment(account, pin, store as never);
function fixture() {
  const document = createEnvironmentDraft("rich-room", createRoomEnvironment(simulationEnvironments[0]));
  const table = document.room!.features.find((f) => ["TABLE", "DESK"].includes(f.classification))!;
  table.yawDegrees = 37;
  table.provenance = { basis: "INFERRED", confidence: 0.62, sourceMediaIds: ["opaque-private-photo"] };
  const envelope = environmentVersionSchema.parse({
    format: "PARALLAX_ENVIRONMENT_VERSION_1",
    id: "rich-room:v1",
    definitionId: document.id,
    number: 1,
    createdAt: "2026-10-15T00:00:00.000Z",
    notes: "Synthetic compatibility fixture",
    content: document,
  });
  const row = {
    id: envelope.id,
    itemId: document.id,
    versionNumber: 1,
    envelope: JSON.stringify(envelope),
    checksum: canonicalChecksum(envelope),
  };
  items.set(document.id, {
    id: document.id,
    ownerAccountId: owner,
    kind: "PARALLAX_STUDIO",
    currentVersionNumber: 19,
    archivedAt: null,
  });
  releases.push(row);
  return { document, row, pin: environmentReleaseReference(row) };
}
beforeEach(() => {
  items.clear();
  releases.length = 0;
  vi.clearAllMocks();
});

it("resolves rich immutable content losslessly without substituting the current CAS revision", async () => {
  const { document, row, pin } = fixture();
  const before = row.envelope;
  const result = await resolve(pin);
  expect(result.format).toBe("PARALLAX_ENVIRONMENT_VERSION_1");
  expect(result.room).toEqual(document.room);
  expect(result.reference.revision).toBe(1);
  expect(row.envelope).toBe(before);
  expect(store.reusableAuthoringItemVersion.findFirst).toHaveBeenCalledWith({
    where: { id: row.id, itemId: row.itemId, versionNumber: 1 },
  });
  await expect(resolve({ ...pin, revision: 19 })).rejects.toThrow("immutable Environment version is unavailable");
});
it("preserves large canonical rooms and long release identities without legacy-size projection", async () => {
  const { row } = fixture();
  const value = JSON.parse(row.envelope);
  value.id = "r".repeat(150);
  value.content.room.width = 30;
  value.content.room.depth = 40;
  row.id = value.id;
  row.envelope = JSON.stringify(value);
  row.checksum = canonicalChecksum(value);
  const pin = environmentReleaseReference(row);
  expect(pin.versionId).toHaveLength(150);
  const result = await resolve(pin);
  expect(result.room?.width).toBe(30);
  expect(result.room?.depth).toBe(40);
  expect(result.room).toEqual(value.content.room);
});
it("keeps archived exact releases available to their owner while rejecting another account", async () => {
  const { row, pin } = fixture();
  items.get(row.itemId)!.archivedAt = new Date();
  expect((await resolve(pin)).reference).toEqual(pin);
  await expect(resolve(pin, "other-creator")).rejects.toThrow("unavailable to this Creator");
});
it("does not turn a working snapshot into an immutable pin", async () => {
  const { document, row, pin } = fixture();
  row.versionNumber = 0;
  row.envelope = JSON.stringify(document);
  row.checksum = canonicalChecksum(document);
  expect(() => environmentReleaseReference(row)).toThrow();
  await expect(resolve(pin)).rejects.toThrow("immutable Environment version is unavailable");
});
it.each(["id", "itemId", "versionNumber", "checksum", "envelope"] as const)(
  "rejects tampered rich release %s",
  async (field) => {
    const { row, pin } = fixture();
    if (field === "versionNumber") row.versionNumber = 2;
    else if (field === "envelope") {
      const value = JSON.parse(row.envelope);
      value.content.room.features[0].yawDegrees = 10;
      row.envelope = JSON.stringify(value);
    } else row[field] = field === "checksum" ? "f".repeat(64) : "wrong-identity";
    await expect(resolve(pin)).rejects.toThrow();
  },
);
it("does not accept a changed pin checksum, extra fields or another item kind", async () => {
  const { pin } = fixture();
  await expect(resolve({ ...pin, checksum: "0".repeat(64) })).rejects.toThrow("binding");
  await expect(resolve({ ...pin, useLatest: true })).rejects.toThrow();
  items.get(pin.environmentId)!.kind = "UNRELATED";
  await expect(resolve(pin)).rejects.toThrow("unavailable");
});
it("validates pin/snapshot and semantic references without changing the original draft", async () => {
  const { pin, document } = fixture();
  const draft = createSpatialDraft("pinned-scene");
  draft.content.environment = pin;
  draft.content.studio!.environment = structuredClone(document.room!);
  draft.content.environmentPlacements = [
    { entityId: draft.content.entities[0].id, featureId: document.room!.features[0].id },
  ];
  const before = JSON.stringify(draft);
  await assertPinnedSceneEnvironment(owner, draft, store as never);
  expect(JSON.stringify(draft)).toBe(before);
  draft.content.studio!.environmentBinding = {
    definitionId: pin.environmentId,
    versionId: pin.versionId,
    checksum: pin.checksum,
    revision: 19,
    usedAt: "2026-10-15T00:00:00.000Z",
    policy: "INDEPENDENT_PINNED_SNAPSHOT",
  };
  await expect(assertPinnedSceneEnvironment(owner, draft, store as never)).resolves.toBeUndefined();
  draft.content.environmentPlacements[0].featureId = "missing-support";
  await expect(assertPinnedSceneEnvironment(owner, draft, store as never)).rejects.toThrow("missing or unsafe");
  draft.content.environmentPlacements = [];
  draft.content.studio!.environment!.features[0].yawDegrees = 18;
  await expect(assertPinnedSceneEnvironment(owner, draft, store as never)).rejects.toThrow("immutable Environment pin");
});
it("preserves omitted historical fields and removes placement links when deleting an entity", () => {
  const draft = createSpatialDraft("historic-scene");
  const serialized = JSON.stringify(draftSchema.parse(draft));
  expect(serialized).not.toContain('"environment"');
  expect(serialized).not.toContain("scenePresentation");
  const originalId = draft.content.entities[0].id;
  const duplicated = editSpatialDraft(draft, { type: "DUPLICATE", entityId: originalId, newId: "second-entity" });
  duplicated.content.environment = legacyBuiltins[0].reference;
  duplicated.content.environmentPlacements = [{ entityId: originalId, featureId: "legacy-support" }];
  const removed = editSpatialDraft(duplicated, { type: "DELETE", entityId: originalId });
  expect(removed.content.environmentPlacements).toEqual([]);
  expect(removed.content.environment).toEqual(legacyBuiltins[0].reference);
});
it("preserves every schema-one built-in checksum and never invents rich geometry", async () => {
  for (const builtin of legacyBuiltins) {
    const result = await resolve(builtin.reference);
    expect(result.format).toBe("SC01_SCHEMA1");
    expect(result.room).toBeNull();
    if (result.format === "SC01_SCHEMA1") expect(result.legacy).toEqual(builtin.content);
    expect(result.reference).toEqual(builtin.reference);
  }
  expect(store.reusableAuthoringItem.findUnique).not.toHaveBeenCalled();
});
it("resolves an owned schema-one legacy release without rewriting its envelope", async () => {
  const value = structuredClone(legacyBuiltins[0]);
  value.content.id = "legacy-owned";
  value.content.origin = "MANUAL";
  value.reference = {
    environmentId: value.content.id,
    versionId: "legacy-owned:e3",
    revision: 3,
    checksum: canonicalChecksum(value.content),
  };
  const row = {
    id: value.reference.versionId,
    itemId: value.content.id,
    versionNumber: 3,
    checksum: value.reference.checksum,
    envelope: JSON.stringify(value),
  };
  items.set(value.content.id, {
    id: value.content.id,
    ownerAccountId: owner,
    kind: "PARALLAX_ENVIRONMENT",
    currentVersionNumber: 8,
    archivedAt: null,
  });
  releases.push(row);
  const before = row.envelope;
  const result = await resolve(value.reference);
  expect(result.reference).toEqual(value.reference);
  expect(result.room).toBeNull();
  expect(row.envelope).toBe(before);
  const corrupted = JSON.parse(row.envelope);
  corrupted.content.fixtures.push({ id: "unexpected" });
  row.envelope = JSON.stringify(corrupted);
  await expect(resolve(value.reference)).rejects.toThrow();
});
