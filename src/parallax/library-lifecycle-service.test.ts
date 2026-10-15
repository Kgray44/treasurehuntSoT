import { beforeEach, describe, it, expect, vi } from "vitest";
import { canonicalChecksum } from "@/drydock/canonical";
import { createSpatialDraft, type SpatialDraft } from "./authoring";
import { createRoomEnvironment } from "./environment-authoring";
import { simulationEnvironments } from "./studio-validation";
import { createEnvironmentDraft } from "./library-lifecycle-contracts";
import { createReusableSpatialAsset, insertReusableSpatialAsset } from "./reusable-assets";
import { materializeLibraryMoment, saveSpatialDraftInTransaction } from "./library-service";
import {
  saveEnvironmentDraft,
  saveDefinitionToLibrary,
  saveSpatialAs,
  mutateLibraryDefinition,
  reconcileLegacySpatialMembership,
  useEnvironmentDefinition,
  releaseEnvironmentVersion,
  restoreDefinitionVersion,
} from "./library-lifecycle-service";

const state = vi.hoisted(() => ({ rows: new Map<string, any>() }));
const tx = vi.hoisted(() => {
  const match = (row: any, where: any) =>
    Object.entries(where).every(([key, value]) =>
      typeof value === "object" && value !== null ? true : row[key] === value,
    );
  return {
    aIUsageLedger: { findMany: vi.fn(async () => []), updateMany: vi.fn(async () => ({ count: 0 })) },
    reusableAuthoringItem: {
      findUnique: vi.fn(async ({ where }: any) => state.rows.get(where.id) ?? null),
      findFirst: vi.fn(async ({ where }: any) => [...state.rows.values()].find((row) => match(row, where)) ?? null),
      findMany: vi.fn(async ({ where }: any) => [...state.rows.values()].filter((row) => match(row, where))),
      create: vi.fn(async ({ data }: any) => {
        if (state.rows.has(data.id)) throw new Error("Unique constraint");
        const { versions, ...rest } = data;
        const row = {
          ...rest,
          archivedAt: null,
          updatedAt: new Date(),
          versions: [{ ...versions.create, itemId: data.id, createdAt: new Date() }],
          _count: { usages: 0 },
        };
        state.rows.set(data.id, row);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const rows = [...state.rows.values()].filter((row) => match(row, where));
        for (const row of rows) {
          const { currentVersionNumber, ...rest } = data;
          Object.assign(row, rest, {
            currentVersionNumber: row.currentVersionNumber + (currentVersionNumber?.increment ?? 0),
            updatedAt: new Date(),
          });
        }
        return { count: rows.length };
      }),
    },
    reusableAuthoringItemVersion: {
      update: vi.fn(async ({ where, data }: any) => {
        const query = where.itemId_versionNumber;
        const row = state.rows.get(query.itemId).versions.find((v: any) => v.versionNumber === query.versionNumber);
        Object.assign(row, data);
        return row;
      }),
      create: vi.fn(async ({ data }: any) => {
        const row = { ...data, createdAt: new Date() };
        state.rows.get(data.itemId).versions.unshift(row);
        return row;
      }),
    },
    protectedMedia: { count: vi.fn(async () => 0) },
  };
});
vi.mock("@/lib/db", () => ({ db: { ...tx, $transaction: async (run: any) => run(tx) } }));
vi.mock("@/chronicle/studio-authorization", () => ({ requireOwnedStudioTale: vi.fn(async () => ({})) }));
vi.mock("./field-service", () => ({ assertCalibrationClaim: vi.fn(async () => {}) }));
const store = { ...tx, $transaction: async (run: any) => run(tx) } as any;
const owner = "synthetic-creator";
const save = (draft: SpatialDraft, revision: number) =>
  saveSpatialDraftInTransaction(owner, draft, revision, tx as any);
beforeEach(() => {
  state.rows.clear();
  vi.clearAllMocks();
});
describe("working identities, reusable definitions and immutable history", () => {
  it("twenty autosaves remain one working identity; explicit Library Save and ten more edits remain one saved definition", async () => {
    const draft = createSpatialDraft("scene-a");
    let revision = 0;
    for (let n = 0; n < 20; n++) {
      draft.content.title = `Edit ${n}`;
      revision = await save(draft, revision);
    }
    expect(state.rows.size).toBe(1);
    expect(state.rows.get("scene-a").status).toBe("WORKING");
    expect(state.rows.get("scene-a").versions).toHaveLength(1);
    revision = (await saveDefinitionToLibrary(owner, "scene-a", revision, store)).revision;
    for (let n = 0; n < 10; n++) {
      draft.content.title = `Saved edit ${n}`;
      revision = await save(draft, revision);
    }
    expect(state.rows.size).toBe(1);
    expect(state.rows.get("scene-a").status).toBe("SAVED");
    expect(state.rows.get("scene-a").versions).toHaveLength(1);
  });
  it("lost autosave response retries return the acknowledged revision; stale changed payload cannot overwrite", async () => {
    const draft = createSpatialDraft("retry");
    const revision = await save(draft, 0);
    expect(await save(draft, 0)).toBe(revision);
    const stale = structuredClone(draft);
    stale.content.title = "Stale tab";
    await expect(save(stale, 0)).rejects.toThrow();
    expect(state.rows.get("retry").name).toBe(draft.content.title);
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
    const copy = JSON.parse(state.rows.get("copy").versions[0].envelope);
    expect(copy.library.creation.sourceDefinitionId).toBe("original");
    expect(copy.content.title).toBe("Named copy");
    expect(state.rows.get("original").name).toBe(original.content.title);
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
    expect(JSON.parse(state.rows.get("room").versions[0].envelope).format).toBe("PARALLAX_ENVIRONMENT_DRAFT_1");
    expect(state.rows.get("room").status).toBe("WORKING");
  });
  it("one environment used by three scenes pins independent room snapshots; source edits do not change them", async () => {
    const document = createEnvironmentDraft("shared-room", createRoomEnvironment(simulationEnvironments[0]));
    await saveEnvironmentDraft(owner, document, 0, store);
    let envRevision = (await saveDefinitionToLibrary(owner, document.id, 1, store)).revision;
    for (let n = 0; n < 3; n++) {
      const scene = createSpatialDraft(`scene-${n}`);
      await save(scene, 0);
      const applied = await useEnvironmentDefinition(
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
    const historic = state.rows.get("organized").versions[0].envelope;
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
    expect(state.rows.get("organized").versions[0].envelope).toBe(historic);
    expect(
      JSON.parse(state.rows.get("organized").versions.find((v: any) => v.versionNumber === 0).envelope).collection,
    ).toBe("Pirate notes");
  });
  it("legacy reconciliation is forward-only and idempotent even for equal names and geometry", async () => {
    for (const id of ["legacy-a", "legacy-b"]) {
      await save(createSpatialDraft(id, "Same title"), 0);
      state.rows.get(id).status = "ACTIVE";
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
    const historical = state.rows.get(document.id).versions.find((v: any) => v.versionNumber === 1).envelope;
    expect((await releaseEnvironmentVersion(owner, document.id, first.revision, "Original", store)).reused).toBe(true);
    document.description = "Changed";
    const revision = await saveEnvironmentDraft(owner, document, first.revision, store);
    await restoreDefinitionVersion(owner, document.id, revision, first.versionId, store);
    expect(state.rows.get(document.id).versions.find((v: any) => v.versionNumber === 1).envelope).toBe(historical);
    expect(
      JSON.parse(state.rows.get(document.id).versions.find((v: any) => v.versionNumber === 0).envelope).description,
    ).toBe("");
  });
  it("cross-account definition access is rejected without mutation", async () => {
    await save(createSpatialDraft("private"), 0);
    await expect(saveDefinitionToLibrary("another-person", "private", 1, store)).rejects.toThrow("unavailable");
    expect(state.rows.get("private").status).toBe("WORKING");
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
    expect(JSON.parse(state.rows.get("retained-copy").versions[0].envelope).content.entities[0].content).toBe(
      "Retained local message",
    );
    expect(JSON.parse(state.rows.get("conflicted").versions[0].envelope).content.entities[0].content).toBe(
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
    const before = state.rows.get("bound-scene").versions[0].envelope;
    document
      .room!.features.filter((f) => f.classification === "DESK" || f.classification === "TABLE")
      .forEach((f) => {
        f.position.x += 0.5;
      });
    await saveEnvironmentDraft(owner, document, 2, store);
    await expect(
      useEnvironmentDefinition(owner, { draft: scene, revision: 1, definitionId: document.id }, store),
    ).rejects.toThrow(/attached support/);
    expect(state.rows.get("bound-scene").versions[0].envelope).toBe(before);
  });
});
