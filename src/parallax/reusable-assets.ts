import {
  createSpatialDraft,
  draftSchema,
  previewEntityTransform,
  worldTransform,
  type SpatialDraft,
  type DraftContent,
} from "./authoring";
import { identityTransform, versionContentSchema, type SpatialVersion, type Transform } from "./contracts";
import { composeTransform, inverseTransform } from "./transforms";
import { emptyStudioContent, type AnimationTrack } from "./studio-contracts";
import { authoredPreviewEnvironment, type PreviewEnvironment } from "./environment-authoring";
import { spatialPropStyle, spatialFootprintSide } from "./prop-style";

export type AssetMetadata = { name: string; description: string; classification: string };
export function spatialLibraryKind(draft: SpatialDraft) {
  if (draft.library)
    return ({ SCENE: "SCENES", ASSET: "ASSETS", ASSEMBLY: "ASSEMBLIES", TEMPLATE: "TEMPLATES" } as const)[
      draft.library.type
    ];
  const definition = draft.content.studio?.libraryDefinition;
  if (definition) return definition.kind === "ASSEMBLY" ? "ASSEMBLIES" : "ASSETS";
  return draft.category === "SCENE_TEMPLATE" ? "TEMPLATES" : "SCENES";
}

/** Flatten only the selected subtree into one reusable local frame. No room or private reference is copied. */
export function createReusableSpatialAsset(
  raw: SpatialDraft,
  rootId: string,
  identity: string,
  metadata: AssetMetadata,
  preview: PreviewEnvironment,
): SpatialDraft {
  const source = draftSchema.parse(raw);
  if (source.content.adaptive)
    throw new Error("Switch to manual placement before saving a reusable object or assembly.");
  const selected = source.content.entities.find((e) => e.id === rootId);
  if (!selected) throw new Error("Select the object or assembly to save.");
  const ids = new Set([rootId]);
  for (let n = 0; n < source.content.entities.length; n++)
    for (const entity of source.content.entities)
      if (entity.parentEntityId && ids.has(entity.parentEntityId)) ids.add(entity.id);
  const parts = source.content.entities.filter((e) => ids.has(e.id));
  const studio = source.content.studio;
  if ([...(studio?.assets ?? []), ...(studio?.visionReferences ?? [])].some((a) => ids.has(a.entityId)))
    throw new Error(
      "This selection has media or perception dependencies. Use supported built-in objects for reusable assets.",
    );
  if (studio?.behaviors.some((b) => b.sourceEntityId && ids.has(b.sourceEntityId) !== ids.has(b.targetEntityId)))
    throw new Error(
      "This behavior links objects outside the selection. Group its source and target before saving the assembly.",
    );
  const environment = authoredPreviewEnvironment(source.content, preview);
  const pose = previewEntityTransform(source.content, rootId, environment.id, environment);
  const origin = { ...identityTransform(), position: pose.position };
  const relative = composeTransform(inverseTransform(origin), pose);
  const parentFrame = composeTransform(pose, inverseTransform(selected.transform));
  const remap = new Map(parts.map((e, i) => [e.id, `${identity}:entity-${i}`]));
  const anchorId = `${identity}:anchor`;
  const next = createSpatialDraft(identity);
  next.content.title = metadata.name;
  next.category = "ENTITY";
  next.content.anchors = [
    { id: anchorId, kind: "LOCAL_WORLD", frameId: `${identity}:frame`, transform: identityTransform() },
  ];
  next.content.entities = parts.map((e) => ({
    ...structuredClone(e),
    ...(spatialPropStyle(e) === "FOOTPRINT" ? { footprintSide: spatialFootprintSide(e) } : {}),
    id: remap.get(e.id)!,
    anchorId,
    ...(e.id === rootId
      ? { parentEntityId: undefined, coordinateSpace: "LOCAL_SESSION" as const, transform: relative }
      : { parentEntityId: remap.get(e.parentEntityId!)!, coordinateSpace: "ENTITY_RELATIVE" as const }),
  }));
  next.content.fallback.narrative = selected.alternativeText;
  const targetStudio = next.content.studio!;
  targetStudio.provenance = structuredClone(studio?.provenance ?? targetStudio.provenance);
  targetStudio.libraryDefinition = {
    kind: parts.length > 1 ? "ASSEMBLY" : "ASSET",
    rootEntityId: remap.get(rootId)!,
    description: metadata.description,
    classification: metadata.classification,
  };
  next.library = { type: targetStudio.libraryDefinition.kind, description: metadata.description };
  targetStudio.layers = parts.map((e) => ({
    ...(structuredClone(studio?.layers.find((l) => l.entityId === e.id)) ?? {
      tags: [],
      visible: true,
      selectable: true,
      audience: "BOTH" as const,
    }),
    entityId: remap.get(e.id)!,
    locked: false,
  }));
  targetStudio.behaviors = (studio?.behaviors ?? [])
    .filter((b) => ids.has(b.targetEntityId))
    .map((b, i) => ({
      ...structuredClone(b),
      id: `${identity}:behavior-${i}`,
      targetEntityId: remap.get(b.targetEntityId)!,
      ...(b.sourceEntityId ? { sourceEntityId: remap.get(b.sourceEntityId)! } : {}),
    }));
  const tracks = (studio?.animationTracks ?? [])
    .filter((t) => ids.has(t.entityId))
    .map((track, i) => {
      const t = structuredClone(track);
      t.id = `${identity}:track-${i}`;
      t.entityId = remap.get(track.entityId)!;
      t.keyframes.forEach((frame, j) => {
        frame.id = `${identity}:key-${i}-${j}`;
      });
      // Root keyframes were authored in its previous parent/anchor frame.
      if (track.entityId === rootId) {
        const convert = (value: Transform) =>
          composeTransform(inverseTransform(origin), composeTransform(parentFrame, value));
        if (t.property === "POSITION")
          t.keyframes = t.keyframes.map((f) => ({
            ...f,
            value: convert({ ...selected.transform, position: f.value }).position,
          }));
        if (t.property === "ROTATION")
          t.keyframes = t.keyframes.map((f) => ({
            ...f,
            value: convert({ ...selected.transform, rotation: f.value }).rotation,
          }));
        if (t.property === "SCALE")
          t.keyframes = t.keyframes.map((f) => ({ ...f, value: f.value * parentFrame.scale }));
      }
      return t;
    });
  if (tracks.length) targetStudio.animationTracks = tracks;
  return draftSchema.parse(next);
}

/** Immutable definition is copied, never live-linked; ordinary scene history owns later instance edits. */
export function insertReusableSpatialAsset(
  draft: SpatialDraft,
  version: SpatialVersion,
  identity: string,
): SpatialDraft {
  const { checksum: _checksum, ...content } = version;
  void _checksum;
  const asset = versionContentSchema.parse(content);
  if (!asset.studio?.libraryDefinition) throw new Error("Choose a released reusable object or assembly.");
  if (draft.content.adaptive) throw new Error("Switch to manual placement to reuse this object or assembly.");
  if (asset.adaptive || asset.studio.assets.length || asset.studio.visionReferences.length || asset.studio.environment)
    throw new Error("This definition is not a supported self-contained reusable asset.");
  const next = structuredClone(draft);
  if (next.content.studio?.libraryDefinition)
    throw new Error("Open a scene before adding a reusable object or assembly.");
  const count = next.content.entities.length + asset.entities.length;
  if (count > 32) throw new Error("The scene object budget is full. Remove an object before adding this asset.");
  if (next.content.anchors.length + asset.anchors.length > 16)
    throw new Error("The scene anchor budget is full. Reuse an existing group or start another scene.");
  const map = new Map(asset.entities.map((e, i) => [e.id, `${identity}:entity-${i}`]));
  const anchors = new Map(asset.anchors.map((a, i) => [a.id, `${identity}:anchor-${i}`]));
  // Place at a reachable authoring height; Creator chooses the actual support with the existing surface tools.
  const at = { ...identityTransform(), position: { x: 0, y: 0.85, z: -0.5 } };
  next.content.anchors.push(
    ...asset.anchors.map((a) => ({
      ...structuredClone(a),
      id: anchors.get(a.id)!,
      frameId: `${identity}:frame`,
      transform: composeTransform(at, a.transform),
    })),
  );
  next.content.entities.push(
    ...asset.entities.map((e) => ({
      ...structuredClone(e),
      ...(spatialPropStyle(e) === "FOOTPRINT" ? { footprintSide: spatialFootprintSide(e) } : {}),
      id: map.get(e.id)!,
      anchorId: anchors.get(e.anchorId)!,
      ...(e.parentEntityId ? { parentEntityId: map.get(e.parentEntityId)! } : {}),
    })),
  );
  const studio = (next.content.studio ??= emptyStudioContent());
  studio.layers.push(
    ...asset.studio.layers.map((l) => ({ ...structuredClone(l), entityId: map.get(l.entityId)!, locked: false })),
  );
  studio.behaviors.push(
    ...asset.studio.behaviors.map((b, i) => ({
      ...structuredClone(b),
      id: `${identity}:behavior-${i}`,
      targetEntityId: map.get(b.targetEntityId)!,
      ...(b.sourceEntityId ? { sourceEntityId: map.get(b.sourceEntityId)! } : {}),
    })),
  );
  const tracks = (asset.studio.animationTracks ?? []).map((track, i): AnimationTrack => {
    const t = structuredClone(track);
    t.id = `${identity}:track-${i}`;
    t.entityId = map.get(track.entityId)!;
    t.keyframes.forEach((f, j) => {
      f.id = `${identity}:key-${i}-${j}`;
    });
    return t;
  });
  if (tracks.length) studio.animationTracks = [...(studio.animationTracks ?? []), ...tracks];
  studio.assetInstances = [
    ...(studio.assetInstances ?? []),
    {
      id: identity,
      definitionId: version.definitionId,
      versionId: version.id,
      checksum: version.checksum,
      entityIds: [...map.values()],
      insertedAt: new Date().toISOString(),
    },
  ];
  return draftSchema.parse(next);
}

/** Geometry-based schematic preview and dimensions for supported planar entity definitions. */
export function spatialAssetBounds(content: DraftContent) {
  const points = content.entities.flatMap((e) => {
    const world = worldTransform(content, e.id);
    return [-1, 1].flatMap((x) =>
      [-1, 1].map(
        (y) =>
          composeTransform(world, {
            ...identityTransform(),
            position: { x: (x * e.widthMeters) / 2, y: y * e.widthMeters * 0.375, z: 0 },
          }).position,
      ),
    );
  });
  const min = {
    x: Math.min(...points.map((p) => p.x)),
    y: Math.min(...points.map((p) => p.y)),
    z: Math.min(...points.map((p) => p.z)),
  };
  const max = {
    x: Math.max(...points.map((p) => p.x)),
    y: Math.max(...points.map((p) => p.y)),
    z: Math.max(...points.map((p) => p.z)),
  };
  return { min, max, dimensions: [max.x - min.x, max.y - min.y, max.z - min.z] };
}
