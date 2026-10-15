import { expect, it } from "vitest";
import { createSpatialDraft } from "./authoring";
import type { SpatialLibraryRecord } from "./library-service";
import { environmentVersionSchema } from "./legacy-scene-environment-contracts";
import { projectEnvironmentForSpatialLibrary } from "./spatial-library-environment-catalog";
import type { CompatibleEnvironmentRecord } from "./environment-library-compatibility";
import { buildSpatialContentCatalog, filterSpatialContentCatalog } from "./spatial-content-catalog";
import legacyBuiltins from "./builtin-environments.v1.json";

function sceneRecord(id: string, type: "SCENE" | "ASSET" | "ASSEMBLY", archived = false): SpatialLibraryRecord {
  const draft = createSpatialDraft(id);
  draft.content.title = `${type} ${id}`;
  draft.library = { type, description: `Private ${type.toLowerCase()} with editable content` };
  draft.collection = "Harbor study";
  draft.tags = ["coastal"];
  draft.favorite = true;
  return {
    id,
    revision: 4,
    draft,
    releases: [],
    usageCount: 0,
    updatedAt: "2026-10-15T02:00:00.000Z",
    saveState: "WORKING",
    archived,
    lastUsedAt: null,
  };
}

it("projects current provider and owner definitions into distinct supported categories", () => {
  const entries = buildSpatialContentCatalog(
    [sceneRecord("scene", "SCENE"), sceneRecord("asset", "ASSET"), sceneRecord("group", "ASSEMBLY")],
    [],
  );
  expect(entries.find((item) => item.id === "saved:scene")?.kind).toBe("SCENES");
  expect(entries.find((item) => item.id === "saved:asset")?.kind).toBe("ASSETS");
  expect(entries.find((item) => item.id === "saved:group")?.kind).toBe("COMPOSITIONS");
  expect(entries.some((item) => item.kind === "EFFECTS")).toBe(false);
  expect(entries.find((item) => item.id === "classic:Ghost Footprint Trail")?.includedElements).toEqual([
    "Five footprint markers",
  ]);
});

it("retains exact legacy Environment reference while leaving unsupported organization unknown", () => {
  const version = environmentVersionSchema.parse(legacyBuiltins[0]);
  const record = {
    representation: "SC01_SCHEMA1" as const,
    id: version.reference.environmentId,
    builtin: true as const,
    ownerAccountId: null,
    revision: null,
    saveState: null,
    archived: false,
    working: null,
    versions: [version],
  } satisfies CompatibleEnvironmentRecord;
  const environment = projectEnvironmentForSpatialLibrary(record);
  const entry = buildSpatialContentCatalog([], [environment]).find((item) => item.kind === "ENVIRONMENTS");
  expect(entry?.environment?.immutableVersions).toEqual([version.reference]);
  expect(entry).toMatchObject({ origin: "BUILT_IN", collection: null, favorite: null, saveState: null });
  expect(entry).not.toHaveProperty("current");
});

it("searches owner metadata and keeps archived items out of active results", () => {
  const entries = buildSpatialContentCatalog(
    [sceneRecord("open", "SCENE"), sceneRecord("archived", "SCENE", true)],
    [],
  );
  const query = {
    kind: "SCENES" as const,
    search: "coastal",
    origin: "FAVORITES" as const,
    state: "ACTIVE" as const,
    sort: "NAME" as const,
  };
  expect(filterSpatialContentCatalog(entries, query).map((item) => item.id)).toEqual(["saved:open"]);
  expect(filterSpatialContentCatalog(entries, { ...query, state: "ARCHIVED" }).map((item) => item.id)).toEqual([
    "saved:archived",
  ]);
});
