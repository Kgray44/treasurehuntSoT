import { describe, expect, it } from "vitest";
import { createSpatialDraft } from "./authoring";
import { builtinEnvironments } from "./environment-service";
import { buildSpatialLibrary, filterSpatialLibrary } from "./library-catalog";
import type { SpatialLibraryRecord } from "./library-service";

function saved(id: string, name: string): SpatialLibraryRecord {
  const draft = createSpatialDraft(id, "Desk Map");
  draft.content.title = name;
  return { id, draft, revision: 3, releases: [], usageCount: 0, updatedAt: "2026-10-15T12:00:00.000Z" };
}

describe("Spatial Library catalog", () => {
  it("separates insertable assets and effects from saved Scene definitions and Environments", () => {
    const environments = builtinEnvironments();
    const scene = saved("scene-1", "Hidden Letter");
    scene.draft.content.environment = environments[0].current.reference;
    const composition = saved("composition-1", "Ghost clue group");
    composition.draft.category = "SCENE_TEMPLATE";
    composition.draft.tags = ["composition"];
    const entries = buildSpatialLibrary([scene, composition], environments);
    expect(entries.find((item) => item.id === "saved:scene-1")).toMatchObject({
      kind: "SCENES",
      origin: "MY_CREATIONS",
      environmentName: environments[0].current.content.name,
    });
    expect(entries.find((item) => item.id === "saved:composition-1")).toMatchObject({ kind: "COMPOSITIONS" });
    expect(entries.find((item) => item.id === `environment:${environments[0].id}`)).toMatchObject({
      kind: "ENVIRONMENTS",
      origin: "BUILT_IN",
    });
    expect(entries.find((item) => item.id === "catalog:treasure-chest")).toMatchObject({
      kind: "ASSETS",
      preset: "sc02:treasure-chest",
    });
    expect(entries.find((item) => item.id === "catalog:point-light")).toMatchObject({ kind: "EFFECTS" });
  });

  it("filters by Environment, search and favorite without losing older saved content", () => {
    const environments = builtinEnvironments();
    const associated = saved("associated", "The haunting");
    associated.draft.content.environment = environments[0].current.reference;
    associated.draft.favorite = true;
    const legacy = saved("legacy", "Old spatial moment");
    const entries = buildSpatialLibrary([associated, legacy], environments);
    expect(filterSpatialLibrary(entries, { kind: "SCENES", search: "", origin: "ALL", sort: "NAME" })).toHaveLength(2);
    expect(
      filterSpatialLibrary(entries, {
        kind: "SCENES",
        search: "haunt",
        origin: "FAVORITES",
        environmentId: environments[0].id,
        sort: "RECENT",
      }).map((item) => item.id),
    ).toEqual(["saved:associated"]);
  });

  it("keeps installed Community content distinct from Creator-owned content", () => {
    const owned = saved("owned", "My clue");
    const installed = saved("installed", "Shared clue");
    installed.readOnly = true;
    installed.draft.category = "SCENE_TEMPLATE";
    installed.draft.tags = ["composition"];
    const entries = buildSpatialLibrary([owned, installed], []);
    expect(entries.find((item) => item.id === "saved:installed")).toMatchObject({
      kind: "COMPOSITIONS",
      origin: "COMMUNITY",
      family: "Installed composition",
    });
    expect(
      filterSpatialLibrary(entries, { kind: "COMPOSITIONS", search: "", origin: "MY_CREATIONS", sort: "NAME" }),
    ).toEqual([]);
    expect(
      filterSpatialLibrary(entries, { kind: "COMPOSITIONS", search: "", origin: "COMMUNITY", sort: "NAME" }).map(
        (item) => item.id,
      ),
    ).toEqual(["saved:installed"]);
  });

  it("keeps a saved procedural effect in Effects after a read-only Community installation", () => {
    const effect = saved("mist-effect", "Imaginary mist");
    effect.draft.category = "EFFECT";
    const installed = structuredClone(effect);
    installed.id = "installed-mist";
    installed.readOnly = true;
    const entries = buildSpatialLibrary([effect, installed], []);
    expect(entries.find((item) => item.id === "saved:mist-effect")).toMatchObject({
      kind: "EFFECTS",
      origin: "MY_CREATIONS",
      family: "Saved effect",
    });
    expect(entries.find((item) => item.id === "saved:installed-mist")).toMatchObject({
      kind: "EFFECTS",
      origin: "COMMUNITY",
      family: "Installed effect",
    });
  });

  it("keeps catalog queries bounded to matching lightweight entries at larger counts", () => {
    const items = Array.from({ length: 1200 }, (_, i) => saved(`scene-${i}`, `Room ${i}`));
    const entries = buildSpatialLibrary(items, []);
    expect(
      filterSpatialLibrary(entries, { kind: "SCENES", search: "Room 1199", origin: "ALL", sort: "NAME" }),
    ).toHaveLength(1);
    expect(filterSpatialLibrary(entries, { kind: "SCENES", search: "", origin: "ALL", sort: "NAME" })).toHaveLength(
      1200,
    );
  });
});
