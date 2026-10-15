import { beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalChecksum } from "@/drydock/canonical";
import { DraftConflictError } from "@/chronicle/studio-service";
import { environmentVersionSchema } from "./legacy-scene-environment-contracts";
import { checkedLegacyEnvironmentWorking } from "./legacy-environment-working-contracts";
import { resolvePinnedEnvironment } from "./environment-version-resolution";
import {
  archiveLegacyEnvironment,
  beginLegacyEnvironmentEdit,
  copyLegacyEnvironment,
  legacyEnvironmentItemKind,
  releaseLegacyEnvironmentVersion,
  saveLegacyEnvironmentToLibrary,
  saveLegacyEnvironmentWorking,
} from "./legacy-environment-service";
import legacyBuiltins from "./builtin-environments.v1.json";

vi.mock("@/lib/db", () => ({ db: {} }));
type Item = {
  id: string;
  ownerAccountId: string;
  kind: string;
  name: string;
  description: string;
  tags: string;
  status: string;
  currentVersionNumber: number;
  archivedAt: Date | null;
};
type Version = { id: string; itemId: string; versionNumber: number; envelope: string; checksum: string };
const items = new Map<string, Item>();
const versions = new Map<string, Version>();
const accountId = "synthetic-creator";
const id = "legacy-owned-room";
const tx = {
  reusableAuthoringItem: {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      const item = items.get(where.id);
      return item
        ? {
            ...structuredClone(item),
            versions: [...versions.values()]
              .filter((row) => row.itemId === item.id)
              .sort((a, b) => b.versionNumber - a.versionNumber)
              .map((row) => structuredClone(row)),
          }
        : null;
    }),
    create: vi.fn(
      async ({
        data,
      }: {
        data: Omit<Item, "tags" | "archivedAt"> & {
          versions: { create: Omit<Version, "itemId"> };
        };
      }) => {
        if (items.has(data.id)) throw new Error("Duplicate definition identity");
        const { versions: nested, ...item } = data;
        if (versions.has(nested.create.id)) throw new Error("Duplicate version identity");
        items.set(item.id, { ...item, tags: "[]", archivedAt: null });
        versions.set(nested.create.id, { ...nested.create, itemId: item.id });
        return item;
      },
    ),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: Partial<Omit<Item, "status">> & { status?: string | { not: string } };
        data: Partial<Omit<Item, "currentVersionNumber">> & { currentVersionNumber: { increment: number } };
      }) => {
        const item = items.get(where.id!);
        if (
          !item ||
          !Object.entries(where).every(([key, value]) =>
            key === "status" && typeof value === "object" && value !== null && "not" in value
              ? item.status !== value.not
              : item[key as keyof Item] === value,
          )
        )
          return { count: 0 };
        const { currentVersionNumber, ...patch } = data;
        Object.assign(item, patch);
        item.currentVersionNumber += currentVersionNumber.increment;
        return { count: 1 };
      },
    ),
  },
  reusableAuthoringItemVersion: {
    findFirst: vi.fn(async ({ where }: { where: Partial<Version> }) => {
      const row = [...versions.values()].find((value) =>
        Object.entries(where).every(([key, expected]) => value[key as keyof Version] === expected),
      );
      return row ? structuredClone(row) : null;
    }),
    create: vi.fn(async ({ data }: { data: Version }) => {
      if (versions.has(data.id)) throw new Error("Duplicate version identity");
      if ([...versions.values()].some((row) => row.itemId === data.itemId && row.versionNumber === data.versionNumber))
        throw new Error("Duplicate version ordinal");
      versions.set(data.id, structuredClone(data));
      return data;
    }),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { itemId_versionNumber: { itemId: string; versionNumber: number } };
        data: Pick<Version, "envelope" | "checksum">;
      }) => {
        const row = [...versions.values()].find(
          (value) =>
            value.itemId === where.itemId_versionNumber.itemId &&
            value.versionNumber === where.itemId_versionNumber.versionNumber,
        );
        if (!row) throw new Error("Working version unavailable");
        Object.assign(row, data);
        return row;
      },
    ),
  },
};
const store = {
  $transaction: vi.fn(async (run: (transaction: typeof tx) => Promise<unknown>) => {
    const beforeItems = structuredClone(items);
    const beforeVersions = structuredClone(versions);
    try {
      return await run(tx);
    } catch (failure) {
      items.clear();
      versions.clear();
      for (const [key, value] of beforeItems) items.set(key, value);
      for (const [key, value] of beforeVersions) versions.set(key, value);
      throw failure;
    }
  }),
};
const client = store as never;
const positiveRows = () => [...versions.values()].filter((row) => row.itemId === id && row.versionNumber > 0);
const workingRow = () => [...versions.values()].find((row) => row.itemId === id && row.versionNumber === 0)!;
const beginInput = { definitionId: id, revision: 19, operationId: "begin-existing-room" };
const begin = () => beginLegacyEnvironmentEdit(accountId, beginInput, client);

beforeEach(() => {
  items.clear();
  versions.clear();
  vi.clearAllMocks();
  const content = {
    ...structuredClone(legacyBuiltins[0].content),
    id,
    name: "Original synthetic room",
    origin: "MANUAL" as const,
  };
  const version = environmentVersionSchema.parse({
    reference: {
      environmentId: id,
      versionId: "opaque-original-release",
      revision: 3,
      checksum: canonicalChecksum(content),
    },
    content,
  });
  items.set(id, {
    id,
    ownerAccountId: accountId,
    kind: legacyEnvironmentItemKind,
    name: content.name,
    description: content.description,
    tags: "[]",
    status: "ACTIVE",
    currentVersionNumber: 19,
    archivedAt: null,
  });
  versions.set(version.reference.versionId, {
    id: version.reference.versionId,
    itemId: id,
    versionNumber: 3,
    envelope: JSON.stringify(version),
    checksum: version.reference.checksum,
  });
});

describe("legacy Environment canonical working lifecycle", () => {
  it("rejects all direct mutations of installed read-only Environments before writes or replay acknowledgments", async () => {
    const opened = await begin();
    items.get(id)!.status = "INSTALLED_READ_ONLY";
    const beforeItems = structuredClone(items);
    const beforeVersions = structuredClone(versions);
    vi.clearAllMocks();
    const attempts = [
      () => begin(),
      () => saveLegacyEnvironmentWorking(accountId, opened.working, opened.revision, client),
      () =>
        releaseLegacyEnvironmentVersion(
          accountId,
          {
            definitionId: id,
            revision: opened.revision,
            operationId: "installed-release",
            contentChecksum: opened.contentChecksum,
          },
          client,
        ),
      () => saveLegacyEnvironmentToLibrary(accountId, id, opened.revision, client),
      () => archiveLegacyEnvironment(accountId, id, opened.revision, true, client),
      () => archiveLegacyEnvironment(accountId, id, opened.revision, false, client),
    ];
    for (const attempt of attempts) await expect(attempt()).rejects.toThrow("Installed Environments are read-only");
    expect(items).toEqual(beforeItems);
    expect(versions).toEqual(beforeVersions);
    expect(tx.reusableAuthoringItem.updateMany).not.toHaveBeenCalled();
    expect(tx.reusableAuthoringItemVersion.update).not.toHaveBeenCalled();
    expect(tx.reusableAuthoringItemVersion.create).not.toHaveBeenCalled();
  });

  it("refuses a write when an Environment becomes installed after the initial read", async () => {
    const opened = await begin();
    const changed = structuredClone(opened.working!);
    changed.content.name = "Must not save";
    const before = workingRow().envelope;
    const update = tx.reusableAuthoringItem.updateMany.getMockImplementation()!;
    tx.reusableAuthoringItem.updateMany.mockImplementationOnce(async (args) => {
      items.get(id)!.status = "INSTALLED_READ_ONLY";
      return update(args);
    });
    await expect(saveLegacyEnvironmentWorking(accountId, changed, opened.revision, client)).rejects.toBeInstanceOf(
      DraftConflictError,
    );
    expect(workingRow().envelope).toBe(before);
    expect(items.get(id)?.name).toBe("Original synthetic room");
    expect(items.get(id)?.currentVersionNumber).toBe(opened.revision);
    expect(tx.reusableAuthoringItemVersion.update).not.toHaveBeenCalled();
  });

  it("starts v0 explicitly while retaining positive bytes and conservative membership", async () => {
    const original = positiveRows()[0].envelope;
    const opened = await begin();
    expect(opened.revision).toBe(20);
    expect(opened.contentChecksum).toBe(canonicalChecksum(opened.working!.content));
    expect(opened.saveState).toBe("LEGACY_REVIEW");
    expect(opened.working?.source?.revision).toBe(3);
    expect(opened.working?.creation.sourceRevision).toBe(19);
    expect(checkedLegacyEnvironmentWorking(workingRow(), id)).toEqual(opened.working);
    expect(positiveRows()).toHaveLength(1);
    expect(positiveRows()[0].envelope).toBe(original);
  });

  it("replays a first-edit operation without overwriting later working edits or duplicating v0", async () => {
    const opened = await begin();
    const changed = structuredClone(opened.working!);
    changed.content.name = "Later working edit";
    await saveLegacyEnvironmentWorking(accountId, changed, opened.revision, client);
    const replay = await begin();
    expect(replay.revision).toBe(21);
    expect(replay.working?.content.name).toBe("Later working edit");
    expect([...versions.values()].filter((row) => row.versionNumber === 0)).toHaveLength(1);
    await expect(
      beginLegacyEnvironmentEdit(accountId, { ...beginInput, versionId: "another-version" }, client),
    ).rejects.toThrow("different Environment request");
  });

  it("updates only working content on ordinary save and safely acknowledges a lost-response retry", async () => {
    const original = positiveRows()[0].envelope;
    const opened = await begin();
    const changed = structuredClone(opened.working!);
    changed.content.width = 6;
    changed.metadata.tags = ["Synthetic shared layout"];
    const saved = await saveLegacyEnvironmentWorking(accountId, changed, opened.revision, client);
    const replay = await saveLegacyEnvironmentWorking(accountId, changed, opened.revision, client);
    expect(saved.revision).toBe(21);
    expect(replay.revision).toBe(21);
    expect(saved.saveState).toBe("LEGACY_REVIEW");
    expect(workingRow().checksum).toBe(canonicalChecksum(changed));
    expect(positiveRows()).toHaveLength(1);
    expect(positiveRows()[0].envelope).toBe(original);
    expect(tx.reusableAuthoringItemVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { itemId_versionNumber: { itemId: id, versionNumber: 0 } } }),
    );
  });

  it("rejects a stale competing payload without overwriting the winning working edit", async () => {
    const opened = await begin();
    const first = structuredClone(opened.working!);
    const competing = structuredClone(opened.working!);
    first.content.name = "Winning edit";
    competing.content.name = "Stale competing edit";
    await saveLegacyEnvironmentWorking(accountId, first, opened.revision, client);
    const winner = workingRow().envelope;
    await expect(saveLegacyEnvironmentWorking(accountId, competing, opened.revision, client)).rejects.toBeInstanceOf(
      DraftConflictError,
    );
    expect(workingRow().envelope).toBe(winner);
    expect(items.get(id)?.name).toBe("Winning edit");
    expect(positiveRows()).toHaveLength(1);
  });

  it("releases a new positive ordinal independently of CAS and retains all previous envelope bytes", async () => {
    const original = positiveRows()[0].envelope;
    const opened = await begin();
    const beforeWorking = workingRow().envelope;
    const released = await releaseLegacyEnvironmentVersion(
      accountId,
      {
        definitionId: id,
        revision: opened.revision,
        operationId: "explicit-release",
        contentChecksum: opened.contentChecksum,
      },
      client,
    );
    expect(released.revision).toBe(21);
    expect(released.version.reference.revision).toBe(4);
    expect(released.version.reference.versionId.length).toBeGreaterThan(128);
    expect(released.version.reference.versionId.length).toBeLessThanOrEqual(160);
    expect(released.saveState).toBe("LEGACY_REVIEW");
    expect(positiveRows()).toHaveLength(2);
    expect(versions.get("opaque-original-release")?.envelope).toBe(original);
    expect(workingRow().envelope).toBe(beforeWorking);
  });

  it("replays the exact release after later working changes without releasing those changes", async () => {
    const opened = await begin();
    const request = {
      definitionId: id,
      revision: opened.revision,
      operationId: "release-retry",
      contentChecksum: canonicalChecksum(opened.working!.content),
    };
    const released = await releaseLegacyEnvironmentVersion(accountId, request, client);
    const changed = structuredClone(opened.working!);
    changed.content.name = "Unreleased later room";
    await saveLegacyEnvironmentWorking(accountId, changed, released.revision, client);
    const later = workingRow().envelope;
    const replay = await releaseLegacyEnvironmentVersion(accountId, request, client);
    expect(replay.replayed).toBe(true);
    expect(replay.version.reference).toEqual(released.version.reference);
    expect(replay.revision).toBe(22);
    expect(positiveRows()).toHaveLength(2);
    expect(workingRow().envelope).toBe(later);
    await expect(
      releaseLegacyEnvironmentVersion(accountId, { ...request, contentChecksum: "0".repeat(64) }, client),
    ).rejects.toThrow("different request");
  });

  it("requires current reviewed content and rejects a competing stale release", async () => {
    const opened = await begin();
    const request = {
      definitionId: id,
      revision: opened.revision,
      operationId: "reviewed-release",
      contentChecksum: canonicalChecksum(opened.working!.content),
    };
    await expect(
      releaseLegacyEnvironmentVersion(accountId, { ...request, contentChecksum: "0".repeat(64) }, client),
    ).rejects.toThrow("working Environment changed");
    expect(positiveRows()).toHaveLength(1);
    await releaseLegacyEnvironmentVersion(accountId, request, client);
    await expect(
      releaseLegacyEnvironmentVersion(accountId, { ...request, operationId: "stale-other-release" }, client),
    ).rejects.toBeInstanceOf(DraftConflictError);
    expect(positiveRows()).toHaveLength(2);
  });

  it("copies a built-in into a working-only owned identity and preserves retries and the immutable preset", async () => {
    const before = JSON.stringify(legacyBuiltins);
    const request = {
      source: legacyBuiltins[0].reference,
      newId: "owned-builtin-copy",
      operationId: "copy-preset",
      name: "My own synthetic room",
    };
    const copied = await copyLegacyEnvironment(accountId, request, client);
    const replay = await copyLegacyEnvironment(accountId, request, client);
    expect(copied.saveState).toBe("WORKING");
    expect(copied.contentChecksum).toBe(canonicalChecksum(copied.working!.content));
    expect(copied.working?.content.origin).toBe("MANUAL");
    expect(copied.working?.source).toEqual(legacyBuiltins[0].reference);
    expect(replay.revision).toBe(1);
    expect(
      [...versions.values()].filter((row) => row.itemId === request.newId).map((row) => row.versionNumber),
    ).toEqual([0]);
    expect(JSON.stringify(legacyBuiltins)).toBe(before);
    await expect(
      copyLegacyEnvironment(accountId, { ...request, name: "Different copy request" }, client),
    ).rejects.toThrow("another operation");
  });

  it("keeps public builtin copy metadata independent of unrelated database rows", async () => {
    const builtinId = legacyBuiltins[0].reference.environmentId;
    items.set(builtinId, {
      ...structuredClone(items.get(id)!),
      id: builtinId,
      ownerAccountId: "another-creator",
      kind: "PARALLAX_STUDIO",
      currentVersionNumber: 55,
    });
    const copied = await copyLegacyEnvironment(
      accountId,
      {
        source: legacyBuiltins[0].reference,
        newId: "public-preset-copy",
        operationId: "copy-public-preset",
        name: "My public preset copy",
      },
      client,
    );
    expect(copied.working?.creation.sourceRevision).toBe(0);
  });

  it("rejects copying another Creator's private source before creating an owned target", async () => {
    const source = environmentVersionSchema.parse(JSON.parse(positiveRows()[0].envelope)).reference;
    const before = positiveRows()[0].envelope;
    await expect(
      copyLegacyEnvironment(
        "another-creator",
        { source, newId: "unauthorized-copy", operationId: "copy-private-room", name: "Unpermitted copy" },
        client,
      ),
    ).rejects.toThrow("unavailable");
    expect(items.has("unauthorized-copy")).toBe(false);
    expect(positiveRows()[0].envelope).toBe(before);
    expect([...versions.values()]).toHaveLength(1);
  });

  it("keeps Library membership and recoverable archive independent from versions", async () => {
    const opened = await begin();
    const before = [...versions.values()].map((row) => row.envelope);
    const member = await saveLegacyEnvironmentToLibrary(accountId, id, opened.revision, client);
    expect(member.saveState).toBe("SAVED");
    expect((await saveLegacyEnvironmentToLibrary(accountId, id, opened.revision, client)).revision).toBe(
      member.revision,
    );
    const archived = await archiveLegacyEnvironment(accountId, id, member.revision, true, client);
    expect(archived.archived).toBe(true);
    const pin = environmentVersionSchema.parse(JSON.parse(positiveRows()[0].envelope)).reference;
    expect((await resolvePinnedEnvironment(accountId, pin, tx as never)).reference).toEqual(pin);
    await expect(saveLegacyEnvironmentWorking(accountId, opened.working, archived.revision, client)).rejects.toThrow(
      "unavailable",
    );
    const restored = await archiveLegacyEnvironment(accountId, id, archived.revision, false, client);
    expect(restored.archived).toBe(false);
    expect([...versions.values()].map((row) => row.envelope)).toEqual(before);
  });

  it("rejects another owner, another kind, forged lineage and built-in mutation", async () => {
    await expect(beginLegacyEnvironmentEdit("another-owner", beginInput, client)).rejects.toThrow("unavailable");
    const opened = await begin();
    const before = workingRow().envelope;
    const changed = structuredClone(opened.working!);
    changed.creation.requestDigest = "0".repeat(64);
    await expect(saveLegacyEnvironmentWorking(accountId, changed, opened.revision, client)).rejects.toThrow(
      "lineage are immutable",
    );
    changed.creation = structuredClone(opened.working!.creation);
    changed.content.origin = "BUILTIN";
    await expect(saveLegacyEnvironmentWorking(accountId, changed, opened.revision, client)).rejects.toThrow(
      "immutable",
    );
    await expect(
      beginLegacyEnvironmentEdit(
        accountId,
        { ...beginInput, definitionId: legacyBuiltins[0].reference.environmentId },
        client,
      ),
    ).rejects.toThrow("owned copy");
    items.get(id)!.kind = "UNRELATED_KIND";
    await expect(
      beginLegacyEnvironmentEdit(accountId, { ...beginInput, revision: opened.revision }, client),
    ).rejects.toThrow("unavailable");
    expect(workingRow().envelope).toBe(before);
  });
});
