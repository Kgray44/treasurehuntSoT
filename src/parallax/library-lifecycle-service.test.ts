import { beforeEach, describe, it, expect, vi } from "vitest";
import type { Prisma, PrismaClient } from "@prisma/client";
import { canonicalChecksum } from "@/drydock/canonical";
import { createSpatialDraft, type SpatialDraft } from "./authoring";
import { createRoomEnvironment } from "./environment-authoring";
import { enableAdaptiveAuthoring } from "./adaptive-authoring";
import { simulationEnvironments } from "./studio-validation";
import { createEnvironmentDraft } from "./library-lifecycle-contracts";
import { createReusableSpatialAsset, insertReusableSpatialAsset } from "./reusable-assets";
import { materializeLibraryMoment, saveSpatialDraftInTransaction } from "./library-service";
import {
  saveEnvironmentDraft,
  listEnvironmentDefinitions,
  saveDefinitionToLibrary,
  saveSpatialAs,
  mutateLibraryDefinition,
  reconcileLegacySpatialMembership,
  useEnvironmentDefinition as applyEnvironmentDefinition,
  releaseEnvironmentVersion,
  restoreDefinitionVersion,
  spatialLibraryInventory,
} from "./library-lifecycle-service";

type TestVersion = {
  id: string;
  itemId: string;
  versionNumber: number;
  envelope: string;
  checksum: string;
  createdAt: Date;
};
type TestItem = {
  id: string;
  ownerAccountId: string;
  kind: string;
  status: string;
  name: string;
  tags: string;
  currentVersionNumber: number;
  archivedAt: Date | null;
  updatedAt: Date;
  versions: TestVersion[];
  _count: { usages: number };
  description?: string;
  lastUsedAt?: Date | null;
};
const state = vi.hoisted(() => ({ rows: new Map<string, TestItem>() }));
const tx = vi.hoisted(() => {
  const match = (row: object, where: Record<string, unknown>) => {
    const values: Record<string, unknown> = Object.fromEntries(Object.entries(row));
    return Object.entries(where).every(([key, value]) =>
      typeof value === "object" && value !== null
        ? "not" in value
          ? values[key] !== value.not
          : true
        : values[key] === value,
    );
  };
  return {
    reusableAuthoringItem: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => state.rows.get(where.id) ?? null),
      findFirst: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) =>
          [...state.rows.values()].find((row) => match(row, where)) ?? null,
      ),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        [...state.rows.values()].filter((row) => match(row, where)),
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: Omit<TestItem, "versions" | "archivedAt" | "updatedAt" | "_count"> & {
            versions: { create: Omit<TestVersion, "itemId" | "createdAt"> };
          };
        }) => {
          if (state.rows.has(data.id)) throw new Error("Unique constraint");
          const { versions, ...rest } = data;
          const row: TestItem = {
            ...rest,
            archivedAt: null,
            updatedAt: new Date(),
            versions: [{ ...versions.create, itemId: data.id, createdAt: new Date() }],
            _count: { usages: 0 },
          };
          state.rows.set(data.id, row);
          return row;
        },
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Partial<Omit<TestItem, "currentVersionNumber" | "versions">> & {
            currentVersionNumber?: { increment: number };
          };
        }) => {
          const rows = [...state.rows.values()].filter((row) => match(row, where));
          for (const row of rows) {
            const { currentVersionNumber, ...rest } = data;
            Object.assign(row, rest, {
              currentVersionNumber: row.currentVersionNumber + (currentVersionNumber?.increment ?? 0),
              updatedAt: new Date(),
            });
          }
          return { count: rows.length };
        },
      ),
    },
    reusableAuthoringItemVersion: {
      findFirst: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) =>
          [...state.rows.values()].flatMap((row) => row.versions).find((row) => match(row, where)) ?? null,
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { itemId_versionNumber: { itemId: string; versionNumber: number } };
          data: Partial<TestVersion>;
        }) => {
          const query = where.itemId_versionNumber;
          const row = state.rows
            .get(query.itemId)
            ?.versions.find((version) => version.versionNumber === query.versionNumber);
          if (!row) throw new Error("Working version unavailable");
          Object.assign(row, data);
          return row;
        },
      ),
      create: vi.fn(async ({ data }: { data: Omit<TestVersion, "createdAt"> }) => {
        const item = state.rows.get(data.itemId);
        if (!item) throw new Error("Definition unavailable");
        const row = { ...data, createdAt: new Date() };
        item.versions.unshift(row);
        return row;
      }),
    },
    protectedMedia: { count: vi.fn(async () => 0) },
    reusableAuthoringUsage: { findMany: vi.fn(async () => []) },
  };
});
vi.mock("@/lib/db", () => ({
  db: { ...tx, $transaction: async (run: (transaction: typeof tx) => Promise<unknown>) => run(tx) },
}));
vi.mock("@/chronicle/studio-authorization", () => ({ requireOwnedStudioTale: vi.fn(async () => ({})) }));
vi.mock("./field-service", () => ({ assertCalibrationClaim: vi.fn(async () => {}) }));
const store = {
  ...tx,
  $transaction: async (run: (transaction: typeof tx) => Promise<unknown>) => run(tx),
} as unknown as PrismaClient;
const owner = "synthetic-creator";
const save = (draft: SpatialDraft, revision: number) =>
  saveSpatialDraftInTransaction(owner, draft, revision, tx as unknown as Prisma.TransactionClient);
const requireItem = (id: string) => {
  const item = state.rows.get(id);
  if (!item) throw new Error("Expected fixture definition " + id);
  return item;
};
beforeEach(() => {
  state.rows.clear();
  vi.clearAllMocks();
});
describe("working identities, reusable definitions and immutable history", () => {
  it.each(["SCENE", "ENVIRONMENT"] as const)(
    "protects installed %s content from lifecycle mutation and unlicensed Save As",
    async (type) => {
      const id = `installed-${type.toLowerCase()}`;
      const document =
        type === "ENVIRONMENT"
          ? createEnvironmentDraft(id, createRoomEnvironment(simulationEnvironments[0]))
          : createSpatialDraft(id);
      if (type === "ENVIRONMENT") await saveEnvironmentDraft(owner, document, 0, store);
      else await save(document as SpatialDraft, 0);
      requireItem(id).status = "INSTALLED_READ_ONLY";
      if (type === "ENVIRONMENT")
        expect((await listEnvironmentDefinitions(owner, store)).find((record) => record.id === id)?.readOnly).toBe(
          true,
        );
      const before = structuredClone(requireItem(id));
      vi.clearAllMocks();
      const attempts = [
        () => saveDefinitionToLibrary(owner, id, 1, store),
        () => mutateLibraryDefinition(owner, id, 1, { name: "Must not rename" }, store),
        () => mutateLibraryDefinition(owner, id, 1, { archive: true }, store),
        () => restoreDefinitionVersion(owner, id, 1, "some-release", store),
        () =>
          saveSpatialAs(
            owner,
            {
              definitionId: id,
              revision: 1,
              newId: "unlicensed-copy",
              operationId: "copy-installed",
              name: "Copy",
              destination: "WORKING",
              type,
            },
            store,
          ),
        ...(type === "ENVIRONMENT"
          ? [
              () => saveEnvironmentDraft(owner, document, 1, store),
              () => releaseEnvironmentVersion(owner, id, 1, "Must not release", store),
            ]
          : []),
      ];
      for (const attempt of attempts) await expect(attempt()).rejects.toThrow("Installed content is read-only");
      expect(requireItem(id)).toEqual(before);
      expect(state.rows.has("unlicensed-copy")).toBe(false);
      expect(tx.reusableAuthoringItem.updateMany).not.toHaveBeenCalled();
      expect(tx.reusableAuthoringItemVersion.update).not.toHaveBeenCalled();
      expect(tx.reusableAuthoringItemVersion.create).not.toHaveBeenCalled();
    },
  );
  it("counts exact Environment pins even when a Scene has no optional editor source binding", async () => {
    const document = createEnvironmentDraft("counted-room", createRoomEnvironment(simulationEnvironments[0]));
    await saveEnvironmentDraft(owner, document, 0, store);
    const released = await releaseEnvironmentVersion(owner, document.id, 1, "Shared release", store);
    for (const id of ["bound-consumer", "pin-only-consumer"]) {
      const draft = createSpatialDraft(id);
      await save(draft, 0);
      const applied = await applyEnvironmentDefinition(
        owner,
        { draft, revision: 1, definitionId: document.id, versionId: released.versionId },
        store,
      );
      if (id === "pin-only-consumer") {
        delete applied.draft.content.studio!.environmentBinding;
        const revision = await save(applied.draft, applied.revision);
        const moment = materializeLibraryMoment(applied.draft, owner, 1);
        await tx.reusableAuthoringItemVersion.create({
          data: {
            id: moment.version.id,
            itemId: id,
            versionNumber: 1,
            envelope: JSON.stringify(moment),
            checksum: moment.version.checksum,
          },
        });
        // The historical Scene release still uses the room after its working
        // draft becomes unbound; the Scene must count once, not once per version.
        delete applied.draft.content.environment;
        delete applied.draft.content.studio!.environment;
        await save(applied.draft, revision);
      }
    }
    const before = requireItem(document.id).versions.find(
      (v: { versionNumber: number }) => v.versionNumber === 1,
    )!.envelope;
    const inventory = await spatialLibraryInventory(owner);
    const environment = inventory.environments.find((record) => record.id === document.id)!;
    expect(environment.usageCount).toBe(2);
    expect(environment.releases[0].usageCount).toBe(2);
    expect(
      requireItem(document.id).versions.find((v: { versionNumber: number }) => v.versionNumber === 1)!.envelope,
    ).toBe(before);
  });
  it("copies a 150-character historical Environment release with exact lineage and unchanged source bytes", async () => {
    const document = createEnvironmentDraft("long-release-room", createRoomEnvironment(simulationEnvironments[0]));
    await saveEnvironmentDraft(owner, document, 0, store);
    const released = await releaseEnvironmentVersion(owner, document.id, 1, "Synthetic historical release", store);
    const row = requireItem(document.id).versions.find((v: { versionNumber: number }) => v.versionNumber === 1)!;
    const value = JSON.parse(row.envelope);
    value.id = "v".repeat(150);
    row.id = value.id;
    row.envelope = JSON.stringify(value);
    row.checksum = canonicalChecksum(value);
    const before = row.envelope;
    await saveSpatialAs(
      owner,
      {
        definitionId: document.id,
        revision: released.revision,
        versionId: row.id,
        newId: "historical-room-copy",
        operationId: "historical-copy-operation",
        name: "Historical room copy",
        destination: "WORKING",
        type: "ENVIRONMENT",
      },
      store,
    );
    const copy = requireItem("historical-room-copy");
    expect(copy.status).toBe("WORKING");
    expect(copy.versions).toHaveLength(1);
    expect(copy.versions[0].versionNumber).toBe(0);
    const copied = JSON.parse(copy.versions[0].envelope);
    expect(copied.lineage).toEqual({ definitionId: document.id, versionId: row.id });
    expect(copied.room.features).toEqual(document.room!.features);
    expect(row.envelope).toBe(before);
  });
  it("reserves built-in identities without creating an owned working record", async () => {
    const document = createEnvironmentDraft("builtin:bedroom");
    await expect(saveEnvironmentDraft(owner, document, 0, store)).rejects.toThrow("reserved");
    expect(state.rows.size).toBe(0);
  });
  it("pins two independent Scenes to the same exact rich release while working CAS continues separately", async () => {
    const document = createEnvironmentDraft("shared-room", createRoomEnvironment(simulationEnvironments[0]));
    await saveEnvironmentDraft(owner, document, 0, store);
    const released = await releaseEnvironmentVersion(owner, document.id, 1, "Shared original", store);
    const sourceEnvelope = requireItem(document.id).versions.find(
      (v: { versionNumber: number }) => v.versionNumber === 1,
    )!.envelope;
    const scenes = [];
    for (const id of ["independent-a", "independent-b"]) {
      const scene = createSpatialDraft(id);
      await save(scene, 0);
      scenes.push(
        await applyEnvironmentDefinition(
          owner,
          { draft: scene, revision: 1, definitionId: document.id, versionId: released.versionId },
          store,
        ),
      );
    }
    expect(scenes[0].draft.content.environment?.revision).toBe(1);
    expect(scenes[0].draft.content.studio?.environmentBinding?.revision).toBe(released.revision);
    expect(scenes[0].draft.content.studio?.environment).toEqual(document.room);
    const secondBefore = requireItem("independent-b").versions[0].envelope;
    document.description = "New working description";
    await saveEnvironmentDraft(owner, document, released.revision, store);
    scenes[0].draft.content.title = "Independent renamed Scene";
    await save(scenes[0].draft, scenes[0].revision);
    expect(requireItem("independent-b").versions[0].envelope).toBe(secondBefore);
    expect(
      requireItem(document.id).versions.find((v: { versionNumber: number }) => v.versionNumber === 1)!.envelope,
    ).toBe(sourceEnvelope);
    const savedScene = requireItem("independent-a").versions.find(
      (v: { versionNumber: number }) => v.versionNumber === 0,
    )!.envelope;
    for (const field of ["definitionId", "versionId", "checksum"] as const) {
      const contradictory = structuredClone(scenes[0].draft);
      contradictory.content.studio!.environmentBinding![field] =
        field === "checksum" ? "f".repeat(64) : "another-source";
      await expect(save(contradictory, 3)).rejects.toThrow("source identity conflicts");
      expect(requireItem("independent-a").currentVersionNumber).toBe(3);
      expect(
        requireItem("independent-a").versions.find((v: { versionNumber: number }) => v.versionNumber === 0)!.envelope,
      ).toBe(savedScene);
    }
    const changed = structuredClone(scenes[0].draft);
    changed.content.studio!.environment!.features[0].yawDegrees = 17;
    await expect(save(changed, 3)).rejects.toThrow("immutable Environment pin");
    expect(requireItem("independent-a").currentVersionNumber).toBe(3);
  });
  it("twenty autosaves remain one working identity; explicit Library Save and ten more edits remain one saved definition", async () => {
    const draft = createSpatialDraft("scene-a");
    let revision = 0;
    for (let n = 0; n < 20; n++) {
      draft.content.title = `Edit ${n}`;
      revision = await save(draft, revision);
    }
    expect(state.rows.size).toBe(1);
    expect(requireItem("scene-a").status).toBe("WORKING");
    expect(requireItem("scene-a").versions).toHaveLength(1);
    revision = (await saveDefinitionToLibrary(owner, "scene-a", revision, store)).revision;
    for (let n = 0; n < 10; n++) {
      draft.content.title = `Saved edit ${n}`;
      revision = await save(draft, revision);
    }
    expect(state.rows.size).toBe(1);
    expect(requireItem("scene-a").status).toBe("SAVED");
    expect(requireItem("scene-a").versions).toHaveLength(1);
  });
  it("lost autosave response retries return the acknowledged revision; stale changed payload cannot overwrite", async () => {
    const draft = createSpatialDraft("retry");
    const revision = await save(draft, 0);
    expect(await save(draft, 0)).toBe(revision);
    const stale = structuredClone(draft);
    stale.content.title = "Stale tab";
    await expect(save(stale, 0)).rejects.toThrow();
    expect(requireItem("retry").name).toBe(draft.content.title);
  });
  it("named Save As is independent, preserves lineage, and replays the same operation only", async () => {
    const original = createSpatialDraft("original");
    await save(original, 0);
    const input = {
      definitionId: "original",
      revision: 1,
      newId: "copy",
      operationId: "copy-operation",
      name: "Named copy",
      type: "SCENE" as const,
      destination: "SAVED" as const,
    };
    expect((await saveSpatialAs(owner, input, store)).replayed).toBe(false);
    expect((await saveSpatialAs(owner, input, store)).replayed).toBe(true);
    expect(state.rows.size).toBe(2);
    const copy = JSON.parse(requireItem("copy").versions[0].envelope);
    expect(copy.library.creation.sourceDefinitionId).toBe("original");
    expect(copy.content.title).toBe("Named copy");
    expect(requireItem("original").name).toBe(original.content.title);
    await expect(saveSpatialAs(owner, { ...input, name: "Another operation" }, store)).rejects.toThrow(
      "another operation",
    );
  });
  it("environment-only creation and repeated edits produce zero scene records", async () => {
    const document = createEnvironmentDraft("room", createRoomEnvironment(simulationEnvironments[0]));
    let revision = await saveEnvironmentDraft(owner, document, 0, store);
    for (let n = 0; n < 20; n++) {
      document.description = `Room edit ${n}`;
      revision = await saveEnvironmentDraft(owner, document, revision, store);
    }
    expect(state.rows.size).toBe(1);
    expect(JSON.parse(requireItem("room").versions[0].envelope).format).toBe("PARALLAX_ENVIRONMENT_DRAFT_1");
    expect(requireItem("room").status).toBe("WORKING");
  });
  it("one environment used by three scenes pins independent room snapshots; source edits do not change them", async () => {
    const document = createEnvironmentDraft("shared-room", createRoomEnvironment(simulationEnvironments[0]));
    await saveEnvironmentDraft(owner, document, 0, store);
    let envRevision = (await saveDefinitionToLibrary(owner, document.id, 1, store)).revision;
    for (let n = 0; n < 3; n++) {
      const scene = createSpatialDraft(`scene-${n}`);
      await save(scene, 0);
      const applied = await applyEnvironmentDefinition(
        owner,
        { draft: scene, revision: 1, definitionId: document.id },
        store,
      );
      expect(applied.draft.content.studio!.environmentBinding?.definitionId).toBe(document.id);
    }
    const before = [...state.rows.values()]
      .filter((row) => row.id.startsWith("scene-"))
      .map((row) => row.versions[0].envelope);
    document.room!.features[0].position.x += 0.2;
    envRevision = await saveEnvironmentDraft(owner, document, envRevision, store);
    expect(envRevision).toBe(3);
    expect(
      [...state.rows.values()].filter((row) => row.id.startsWith("scene-")).map((row) => row.versions[0].envelope),
    ).toEqual(before);
    expect(state.rows.size).toBe(4);
  });
  it("five asset placements pin one definition version and instance edits never mutate source or siblings", () => {
    const source = createSpatialDraft("source");
    const definition = createReusableSpatialAsset(
      source,
      source.content.entities[0].id,
      "asset",
      { name: "Footprint", description: "Trail marker", classification: "Clue" },
      simulationEnvironments[0],
    );
    const moment = materializeLibraryMoment(definition, owner, 1),
      sourceChecksum = canonicalChecksum(moment);
    let scene = createSpatialDraft("target");
    for (let n = 0; n < 5; n++) scene = insertReusableSpatialAsset(scene, moment.version, `instance-${n}`);
    expect(scene.content.studio!.assetInstances).toHaveLength(5);
    expect(new Set(scene.content.studio!.assetInstances!.map((i) => i.definitionId)).size).toBe(1);
    const other = structuredClone(scene.content.entities[2]);
    scene.content.entities[1].content = "Instance-only message";
    expect(scene.content.entities[2]).toEqual(other);
    expect(canonicalChecksum(moment)).toBe(sourceChecksum);
  });
  it("metadata and archive/restore keep immutable versions and preserve type and identity", async () => {
    const draft = createSpatialDraft("organized");
    await save(draft, 0);
    const moment = materializeLibraryMoment(draft, owner, 1);
    await tx.reusableAuthoringItemVersion.create({
      data: {
        id: moment.version.id,
        itemId: "organized",
        versionNumber: 1,
        envelope: JSON.stringify(moment),
        checksum: moment.version.checksum,
      },
    });
    const historic = requireItem("organized").versions[0].envelope;
    let revision = (
      await mutateLibraryDefinition(
        owner,
        "organized",
        1,
        { name: "Organized", collection: "Pirate notes", tags: ["Wall"], favorite: true },
        store,
      )
    ).revision;
    revision = (await mutateLibraryDefinition(owner, "organized", revision, { archive: true }, store)).revision;
    await mutateLibraryDefinition(owner, "organized", revision, { archive: false }, store);
    expect(requireItem("organized").versions[0].envelope).toBe(historic);
    expect(
      JSON.parse(
        requireItem("organized").versions.find((v: { versionNumber: number }) => v.versionNumber === 0)!.envelope,
      ).collection,
    ).toBe("Pirate notes");
  });
  it("legacy reconciliation is forward-only and idempotent even for equal names and geometry", async () => {
    for (const id of ["legacy-a", "legacy-b"]) {
      await save(createSpatialDraft(id, "Same title"), 0);
      requireItem(id).status = "ACTIVE";
    }
    const before = [...state.rows.values()].map((r) => r.versions[0].checksum);
    expect((await reconcileLegacySpatialMembership(owner, store)).migrated).toBe(2);
    expect((await reconcileLegacySpatialMembership(owner, store)).migrated).toBe(0);
    expect(state.rows.size).toBe(2);
    expect([...state.rows.values()].map((r) => r.versions[0].checksum)).toEqual(before);
    expect([...state.rows.values()].every((r) => r.status === "LEGACY_REVIEW")).toBe(true);
  });
  it("environment versions deduplicate identical content and restore only the working copy", async () => {
    const document = createEnvironmentDraft("versioned-room", createRoomEnvironment(simulationEnvironments[0]));
    await saveEnvironmentDraft(owner, document, 0, store);
    const first = await releaseEnvironmentVersion(owner, document.id, 1, "Original", store);
    const historical = requireItem(document.id).versions.find(
      (v: { versionNumber: number }) => v.versionNumber === 1,
    )!.envelope;
    expect((await releaseEnvironmentVersion(owner, document.id, first.revision, "Original", store)).reused).toBe(true);
    document.description = "Changed";
    const revision = await saveEnvironmentDraft(owner, document, first.revision, store);
    await restoreDefinitionVersion(owner, document.id, revision, first.versionId, store);
    expect(
      requireItem(document.id).versions.find((v: { versionNumber: number }) => v.versionNumber === 1)!.envelope,
    ).toBe(historical);
    expect(
      JSON.parse(
        requireItem(document.id).versions.find((v: { versionNumber: number }) => v.versionNumber === 0)!.envelope,
      ).description,
    ).toBe("");
  });
  it("cross-account definition access is rejected without mutation", async () => {
    await save(createSpatialDraft("private"), 0);
    await expect(saveDefinitionToLibrary("another-person", "private", 1, store)).rejects.toThrow("unavailable");
    expect(requireItem("private").status).toBe("WORKING");
  });
  it("an explicit retained-draft copy preserves conflicted local edits without overwriting the newer source", async () => {
    const base = createSpatialDraft("conflicted");
    await save(base, 0);
    const local = structuredClone(base);
    local.content.entities[0].content = "Retained local message";
    base.content.entities[0].content = "Another tab's saved message";
    await save(base, 1);
    const result = await saveSpatialAs(
      owner,
      {
        definitionId: "conflicted",
        revision: 1,
        newId: "retained-copy",
        operationId: "retained-operation",
        name: "My retained copy",
        destination: "WORKING",
        type: "SCENE",
        retainedSnapshot: local,
      },
      store,
    );
    expect(result.revision).toBe(1);
    expect(JSON.parse(requireItem("retained-copy").versions[0].envelope).content.entities[0].content).toBe(
      "Retained local message",
    );
    expect(JSON.parse(requireItem("conflicted").versions[0].envelope).content.entities[0].content).toBe(
      "Another tab's saved message",
    );
  });
  it("updating an environment with a moved attached support rejects without changing the scene", async () => {
    const document = createEnvironmentDraft("supported-room", createRoomEnvironment(simulationEnvironments[0]));
    await saveEnvironmentDraft(owner, document, 0, store);
    await saveDefinitionToLibrary(owner, document.id, 1, store);
    const scene = createSpatialDraft("bound-scene");
    scene.content.studio!.environment = structuredClone(document.room!);
    await save(scene, 0);
    const before = requireItem("bound-scene").versions[0].envelope;
    document
      .room!.features.filter((f) => f.classification === "DESK" || f.classification === "TABLE")
      .forEach((f) => {
        f.position.x += 0.5;
      });
    await saveEnvironmentDraft(owner, document, 2, store);
    await expect(
      applyEnvironmentDefinition(owner, { draft: scene, revision: 1, definitionId: document.id }, store),
    ).rejects.toThrow(/attached support/);
    expect(requireItem("bound-scene").versions[0].envelope).toBe(before);
  });
  it("invalidates a prior calibration review when explicitly applying a different Environment version", async () => {
    const document = createEnvironmentDraft("calibrated-environment", createRoomEnvironment(simulationEnvironments[0]));
    await saveEnvironmentDraft(owner, document, 0, store);
    await releaseEnvironmentVersion(owner, document.id, 1, "Original", store);
    const scene = enableAdaptiveAuthoring(createSpatialDraft("calibrated-scene"));
    scene.content.studio!.environment = structuredClone(document.room!);
    scene.content.adaptive!.calibration.maturity = "CALIBRATED";
    scene.content.adaptive!.calibration.reviewReceiptId = "previous-review";
    scene.content.placementPolicy = "CALIBRATED";
    await save(scene, 0);
    document.room!.light = "LOW";
    await saveEnvironmentDraft(owner, document, 2, store);
    const version = await releaseEnvironmentVersion(owner, document.id, 3, "Changed base", store);
    const result = await applyEnvironmentDefinition(
      owner,
      { draft: scene, revision: 1, definitionId: document.id, versionId: version.versionId },
      store,
    );
    expect(result.draft.content.adaptive!.calibration.maturity).toBe("SEMANTIC");
    expect(result.draft.content.adaptive!.calibration).not.toHaveProperty("reviewReceiptId");
    expect(result.draft.content.placementPolicy).toBe("ADAPTIVE_STICKY");
    expect(scene.content.adaptive!.calibration.reviewReceiptId).toBe("previous-review");
  });
});
