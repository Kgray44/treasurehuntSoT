import { createSpatialDraft, draftSchema, editSpatialDraft, type SpatialDraft } from "./authoring";
import { identityTransform, type SpatialEntity } from "./contracts";
import { physicalAssets, type ModelId } from "./asset-catalog";
import { spatialElementSchema, type SpatialElement } from "./element-contracts";

export const effectPresets = [
  {
    id: "point-light",
    name: "Point light",
    family: "Lights",
    description: "Local light with physical distance falloff.",
    element: {
      kind: "LIGHT",
      enabled: true,
      type: "POINT",
      color: "#79baff",
      intensity: 12,
      range: 6,
      decay: 2,
      angle: 0.6,
      penumbra: 0.5,
      pulseHz: 0,
    },
  },
  {
    id: "spot-light",
    name: "Spot light",
    family: "Lights",
    description: "Directional cone aimed along local −Z. Rotate to aim.",
    element: {
      kind: "LIGHT",
      enabled: true,
      type: "SPOT",
      color: "#ffe3b3",
      intensity: 18,
      range: 8,
      decay: 2,
      angle: 0.6,
      penumbra: 0.5,
      pulseHz: 0,
    },
  },
  {
    id: "ambient-light",
    name: "Ambient light",
    family: "Lights",
    description: "Scene-wide fill light; position and range have no effect.",
    element: {
      kind: "LIGHT",
      enabled: true,
      type: "AMBIENT",
      color: "#8b9bbd",
      intensity: 0.4,
      range: 6,
      decay: 2,
      angle: 0.6,
      penumbra: 0.5,
      pulseHz: 0,
    },
  },
  {
    id: "mist",
    name: "Soft mist",
    family: "Atmosphere",
    description: "Local translucent mist layers; not volumetric ray-marched fog.",
    element: { kind: "ATMOSPHERE", enabled: true, color: "#a6c3d9", density: 0.028, radius: 1.2 },
  },
  ...(["MAGIC", "EMBERS", "DUST"] as const).map((style, i) => ({
    id: style.toLowerCase(),
    name: style === "MAGIC" ? "Floating magic" : style === "EMBERS" ? "Drifting embers" : "Drifting dust",
    family: "Particles",
    description: "Seeded particles follow the simulation playhead; pause, seek and replay are deterministic.",
    element: {
      kind: "PARTICLES" as const,
      enabled: true,
      style,
      color: ["#83c8ff", "#ff9c4b", "#c9b99b"][i],
      count: 96,
      radius: 0.6,
      speed: 0.2,
      size: 0.018,
      seed: 173,
    },
  })),
  ...(["SYMBOL", "FOOTPRINTS", "WRITING"] as const).map((pattern, i) => ({
    id: pattern.toLowerCase(),
    name: ["Projected symbol", "Spectral footprints", "Projected writing"][i],
    family: "Projected Effects",
    description:
      "Surface-aligned luminous overlay. Place on a wall or floor; this is not an occlusion-aware projector.",
    element: { kind: "PROJECTED_EFFECT" as const, enabled: true, pattern, color: "#80cfff", opacity: 0.75 },
  })),
  {
    id: "spatial-ambience",
    name: "Spatial ambience",
    family: "Spatial Audio",
    description:
      "Synthesized ether, wind or hum with positional attenuation. Requires Enable preview audio; no recorded whisper is included.",
    element: {
      kind: "SPATIAL_AUDIO",
      enabled: true,
      sound: "ETHER",
      gain: 0.08,
      refDistance: 1,
      maxDistance: 10,
      rolloff: 1,
    },
  },
  {
    id: "portal",
    name: "Portal phenomenon",
    family: "Spatial Phenomena",
    description:
      "Layered luminous aperture with deterministic motion. A presentation effect, with no travel or progression authority.",
    element: { kind: "SPATIAL_PHENOMENON", enabled: true, style: "PORTAL", color: "#8db5ff", speed: 0.2 },
  },
  {
    id: "reveal",
    name: "Supernatural reveal",
    family: "Spatial Phenomena",
    description: "Expanding luminous rings controlled by the authored simulation envelope.",
    element: { kind: "SPATIAL_PHENOMENON", enabled: true, style: "REVEAL", color: "#b9e2ff", speed: 0.3 },
  },
  {
    id: "interaction-region",
    name: "Interaction region",
    family: "Interaction Volumes",
    description:
      "Inspectable region, visible in Editor. Proximity triggers require a future qualified runtime; no automatic puzzle action.",
    element: { kind: "INTERACTION_VOLUME", enabled: true, shape: "BOX", radius: 0.6 },
  },
] satisfies { id: string; name: string; family: string; description: string; element: SpatialElement }[];
export const compositionPresets = [
  {
    id: "ghostly-presence",
    name: "Ghostly Presence",
    family: "Compositions",
    description:
      "Editable group: blue light, mist, magic particles and synthesized spatial ambience, with a two-second entrance.",
  },
  {
    id: "haunted-treasure",
    name: "Haunted treasure",
    family: "Compositions",
    description: "Articulated chest with blue illumination, reveal rings and drifting dust.",
  },
  {
    id: "lantern-embers",
    name: "Lantern & embers",
    family: "Compositions",
    description: "Detailed oil lantern, warm point light and embers as individually editable elements.",
  },
] as const;
export const spatialCatalog = [
  ...physicalAssets.map((a) => ({ ...a, type: "PHYSICAL_ASSET", thumbnail: `/parallax/sc02/thumbnails/${a.id}.png` })),
  ...effectPresets.map((a) => ({ ...a, type: a.element.kind, thumbnail: null })),
  ...compositionPresets.map((a) => ({ ...a, type: "COMPOSITION", thumbnail: null })),
];

export function insertSpatialElement(input: SpatialDraft, catalogId: string, id: string): SpatialDraft {
  const composition = compositionPresets.find((a) => a.id === catalogId);
  if (composition) {
    if (input.content.adaptive)
      throw new Error(
        "Place a composition in a fixed scene, then configure its constituents for semantic placement individually.",
      );
    let next = insertOne(input, "interaction-region", id);
    const parent = next.content.entities.at(-1)!;
    parent.name = composition.name;
    parent.content = composition.description;
    const parts =
      catalogId === "ghostly-presence"
        ? ["point-light", "mist", "magic", "spatial-ambience"]
        : catalogId === "haunted-treasure"
          ? ["articulated-chest", "point-light", "reveal", "dust"]
          : ["lantern", "point-light", "embers"];
    for (const [i, part] of parts.entries()) {
      next = insertOne(next, part, `${id}:part${i}`);
      const child = next.content.entities.at(-1)!;
      child.name = `${composition.name} · ${child.name}`;
      child.parentEntityId = parent.id;
      child.anchorId = parent.anchorId;
      child.coordinateSpace = "ENTITY_RELATIVE";
      child.transform.position = { x: 0, y: part === "lantern" || part === "articulated-chest" ? 0 : 0.45, z: 0 };
      if (child.element) {
        child.element.playback = { startMs: 0, durationMs: 60000, fadeInMs: 2000, fadeOutMs: 1000, loop: false };
        if (child.element.kind === "LIGHT" && catalogId === "lantern-embers") child.element.color = "#ffc16e";
      }
    }
    return draftSchema.parse(next);
  }
  return insertOne(input, catalogId, id);
}

function insertOne(input: SpatialDraft, catalogId: string, id: string) {
  const asset = physicalAssets.find((a) => a.id === catalogId),
    preset = effectPresets.find((a) => a.id === catalogId);
  if (!asset && !preset) throw new Error("Unknown spatial catalog item.");
  const next = structuredClone(input),
    anchorId = `${next.content.definitionId}:elements`;
  if (!next.content.adaptive && !next.content.anchors.some((a) => a.id === anchorId))
    next.content.anchors.push({
      id: anchorId,
      kind: "LOCAL_WORLD",
      frameId: "sc02-local",
      transform: identityTransform(),
    });
  const element: SpatialElement = asset
    ? { kind: "PHYSICAL_ASSET", enabled: true, modelId: asset.id, packageVersion: "1.0.0", articulation: 0 }
    : structuredClone(preset!.element);
  const descriptor = asset ?? preset!;
  const entity: SpatialEntity = {
    id,
    name: descriptor.name,
    kind: "MARKER",
    anchorId: next.content.adaptive ? next.content.anchors[0].id : anchorId,
    coordinateSpace: "LOCAL_SESSION",
    transform: identityTransform(),
    widthMeters: asset?.dimensions[0] ?? 1,
    content: descriptor.description,
    alternativeText: descriptor.description,
    interactions: ["INSPECT", "PLACE"],
    visibility: "RELEASED",
    sharingScope: "PERSONAL",
    element: spatialElementSchema.parse(element),
  };
  entity.transform.position = {
    x: 0,
    y: asset?.support === "TABLE" ? 0.75 : asset?.support === "WALL" ? 0.8 : element.kind === "LIGHT" ? 1 : 0,
    z:
      asset?.support === "FLOOR"
        ? 1.5 + asset.dimensions[2] / 2
        : asset?.support === "TABLE"
          ? -1
          : asset?.support === "WALL"
            ? -1.9
            : 1.7,
  };
  if (element.kind === "PROJECTED_EFFECT") {
    entity.transform.position =
      element.pattern === "FOOTPRINTS" ? { x: 0, y: 0.02, z: 1.7 } : { x: 0, y: 1.2, z: -1.89 };
    if (element.pattern === "WRITING") entity.content = "The harbor remembers the Captain's promise.";
  }
  const result = editSpatialDraft(next, { type: "CREATE", entity });
  if (result.content.adaptive) {
    const r = result.content.adaptive.recipes.find((r) => r.entityId === id)!;
    if (asset) {
      r.preferredSurfaces =
        asset.support === "FLOOR" ? ["FLOOR"] : asset.support === "WALL" ? ["WALL"] : ["TABLE", "DESK"];
      r.alternateSurfaces = [];
      r.orientation = "UPRIGHT";
      if (asset.support === "FLOOR") {
        r.minimumHeightMeters = 0;
        r.preferredHeightMeters = 0;
        r.maximumHeightMeters = 0.2;
      }
      if (asset.support === "WALL") {
        r.minimumHeightMeters = 0.4;
        r.preferredHeightMeters = 1;
        r.maximumHeightMeters = 1.8;
      }
    }
  }
  return draftSchema.parse(result);
}

/** Synthetic reference scenes use the same authoring path as the visible library. */
export function createAssetShowcase(id: string, family?: string) {
  let draft = createSpatialDraft(id, "Desk Map");
  draft.content.entities = [];
  draft.content.anchors = [];
  draft.content.studio!.layers = [];
  const assets = physicalAssets.filter((a) => !family || a.family === family);
  let floorIndex = 0,
    tableIndex = 0,
    wallIndex = 0;
  const tableAssets = assets.filter((a) => a.support === "TABLE");
  for (const [i, asset] of assets.entries()) {
    draft = insertSpatialElement(draft, asset.id, `${id}:asset${i}`);
    const e = draft.content.entities.at(-1)!;
    if (asset.support === "TABLE") {
      const index = tableIndex++;
      e.transform.position = {
        x:
          tableAssets.length > 2
            ? index < 3
              ? (index - 1) * 0.55
              : (index - 3.5) * 0.65
            : (index - (tableAssets.length - 1) / 2) * 0.8,
        y: 0.76,
        z: tableAssets.length > 2 ? (index < 3 ? -0.2 : 0.2) : 0,
      };
    } else if (asset.support === "WALL") {
      e.transform.position = { x: wallIndex++ % 2 ? 1.3 : -1.3, y: asset.id === "curtains" ? 0.5 : 1, z: -3.85 };
    } else {
      const index = floorIndex++;
      e.transform.position = { x: ((index % 3) - 1) * 2.2, y: 0, z: Math.floor(index / 3) * 2.5 - 1.25 };
    }
  }
  if (tableAssets.length) {
    draft = insertSpatialElement(draft, "dining-table", `${id}:support`);
    const support = draft.content.entities.at(-1)!;
    support.name = "Showcase support table";
    support.transform.position = { x: 0, y: 0, z: 0 };
  }
  draft.content.title = family ? `${family} collection` : "SC-02 original asset showcase";
  return draftSchema.parse(draft);
}
export function modelDescriptor(id: ModelId) {
  return physicalAssets.find((a) => a.id === id)!;
}

/** A reusable prefab is an ordinary canonical Spatial Library draft with a dependency-closed subtree. */
export function extractComposition(input: SpatialDraft, rootId: string, definitionId: string): SpatialDraft {
  const root = input.content.entities.find((e) => e.id === rootId);
  if (!root) throw new Error("Choose a composition root.");
  const ids = new Set([rootId]);
  for (let i = 0; i < input.content.entities.length; i++)
    for (const e of input.content.entities) if (e.parentEntityId && ids.has(e.parentEntityId)) ids.add(e.id);
  const draft = createSpatialDraft(definitionId);
  const anchorId = `${definitionId}:anchor`;
  draft.content.anchors = [
    { id: anchorId, kind: "LOCAL_WORLD", frameId: "composition-local", transform: identityTransform() },
  ];
  draft.content.entities = input.content.entities
    .filter((e) => ids.has(e.id))
    .map((e) => {
      const copy = structuredClone(e);
      copy.anchorId = anchorId;
      if (e.id === rootId) {
        delete copy.parentEntityId;
        copy.coordinateSpace = "LOCAL_SESSION";
        copy.transform.position = { x: 0, y: 0, z: 0 };
      }
      return copy;
    });
  const studio = input.content.studio;
  draft.content.studio = {
    ...draft.content.studio!,
    layers: structuredClone(studio?.layers.filter((l) => ids.has(l.entityId)) ?? []),
    behaviors: structuredClone(
      studio?.behaviors.filter((b) => ids.has(b.targetEntityId) && (!b.sourceEntityId || ids.has(b.sourceEntityId))) ??
        [],
    ),
    assets: structuredClone(studio?.assets.filter((a) => ids.has(a.entityId)) ?? []),
    visionReferences: structuredClone(studio?.visionReferences.filter((a) => ids.has(a.entityId)) ?? []),
  };
  draft.content.title = root.name;
  draft.content.fallback.narrative = root.content;
  draft.category = "SCENE_TEMPLATE";
  draft.tags = ["composition"];
  draft.scope = "MY_LIBRARY";
  draft.lineage = { definitionId: input.content.definitionId, versionId: input.content.id };
  return draftSchema.parse(draft);
}

export function insertSavedComposition(input: SpatialDraft, composition: SpatialDraft, prefix: string) {
  if (input.content.adaptive)
    throw new Error("Insert a composition in a fixed scene before configuring semantic placement.");
  if (composition.category !== "SCENE_TEMPLATE" || !composition.tags.includes("composition"))
    throw new Error("Choose a saved composition.");
  const next = structuredClone(input),
    anchorId = `${prefix}:anchor`,
    ids = new Map(composition.content.entities.map((e, i) => [e.id, `${prefix}:e${i}`]));
  next.content.anchors.push({
    id: anchorId,
    kind: "LOCAL_WORLD",
    frameId: "composition-local",
    transform: identityTransform(),
  });
  for (const entity of composition.content.entities) {
    const copy = structuredClone(entity);
    copy.id = ids.get(entity.id)!;
    copy.anchorId = anchorId;
    if (copy.parentEntityId) copy.parentEntityId = ids.get(copy.parentEntityId)!;
    else {
      copy.transform.position.z += 1.7;
      copy.transform.position.x += 0.4;
    }
    next.content.entities.push(copy);
  }
  const s = next.content.studio!;
  s.layers.push(
    ...(composition.content.studio?.layers ?? []).map((l) => ({
      ...structuredClone(l),
      entityId: ids.get(l.entityId)!,
    })),
  );
  s.behaviors.push(
    ...(composition.content.studio?.behaviors ?? []).map((b, i) => ({
      ...structuredClone(b),
      id: `${prefix}:b${i}`,
      targetEntityId: ids.get(b.targetEntityId)!,
      ...(b.sourceEntityId ? { sourceEntityId: ids.get(b.sourceEntityId)! } : {}),
    })),
  );
  s.assets.push(
    ...(composition.content.studio?.assets ?? []).map((a, i) => ({
      ...structuredClone(a),
      id: `${prefix}:a${i}`,
      entityId: ids.get(a.entityId)!,
    })),
  );
  s.visionReferences.push(
    ...(composition.content.studio?.visionReferences ?? []).map((a) => ({
      ...structuredClone(a),
      entityId: ids.get(a.entityId)!,
    })),
  );
  return draftSchema.parse(next);
}
