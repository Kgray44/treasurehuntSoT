import { canonicalJson } from "@/drydock/canonical";
import { matchEntities } from "@/tideglass/comparison";
import type { SemanticEntity } from "@/tideglass/core";
import type { SpatialDraft } from "./authoring";

export type SceneDifference = {
  category:
    | "ADDED_OBJECT"
    | "REMOVED_OBJECT"
    | "TRANSFORM"
    | "VISIBILITY"
    | "LIGHTING_EFFECT"
    | "ANIMATION"
    | "INTERACTION"
    | "ENVIRONMENT_REFERENCE"
    | "CONTENT";
  entityId?: string;
  message: string;
};
// Optional fields in comparison tuples use JSON's null representation; the
// authored canonicalizer correctly refuses raw undefined array elements.
const comparable = (value: unknown) => JSON.parse(JSON.stringify(value ?? null));
const equal = (a: unknown, b: unknown) =>
  canonicalJson(comparable(a), Number.MAX_SAFE_INTEGER) === canonicalJson(comparable(b), Number.MAX_SAFE_INTEGER);

/** A working snapshot source remains distinct from an exact immutable pin. */
function environmentAssociation(draft: SpatialDraft) {
  const pin = draft.content.environment;
  const binding = draft.content.studio?.environmentBinding;
  if (
    pin &&
    binding &&
    (binding.definitionId !== pin.environmentId ||
      binding.versionId !== pin.versionId ||
      binding.checksum !== pin.checksum)
  )
    throw new Error("Scene Environment source identity conflicts with its immutable pin.");
  if (pin) return { environmentId: pin.environmentId, reference: { kind: "IMMUTABLE_PIN", ...pin } };
  if (!binding) return null;
  return {
    environmentId: binding.definitionId,
    reference: {
      kind: "SNAPSHOT_SOURCE",
      definitionId: binding.definitionId,
      versionId: binding.versionId,
      checksum: binding.checksum,
      policy: binding.policy,
      ...(binding.versionId ? {} : { workingRevision: binding.revision }),
    },
  };
}
/** A spatial projection using Tideglass's stable identity matcher, not an edition engine. */
export function compareScenes(
  source: SpatialDraft,
  target: SpatialDraft,
): { sourceTitle: string; targetTitle: string; differences: SceneDifference[] } {
  const sourceEnvironment = environmentAssociation(source);
  const targetEnvironment = environmentAssociation(target);
  if (!sourceEnvironment || !targetEnvironment || sourceEnvironment.environmentId !== targetEnvironment.environmentId)
    throw new Error("Choose two Scenes associated with the same Environment.");
  const differences: SceneDifference[] = [];
  const adapter = (d: SpatialDraft): SemanticEntity[] =>
    d.content.entities.map((e) => ({ id: e.id, entityType: "ARTIFACT", facts: [] }));
  for (const match of matchEntities(adapter(source), adapter(target))) {
    if (match.kind === "UNMATCHED_SOURCE")
      differences.push({
        category: "REMOVED_OBJECT",
        entityId: match.source.id,
        message: `Removed ${source.content.entities.find((e) => e.id === match.source.id)!.name}`,
      });
    if (match.kind === "UNMATCHED_TARGET")
      differences.push({
        category: "ADDED_OBJECT",
        entityId: match.target.id,
        message: `Added ${target.content.entities.find((e) => e.id === match.target.id)!.name}`,
      });
    if (match.kind !== "EXACT_STABLE_ID" && match.kind !== "EXPLICIT_REPLACEMENT") continue;
    const a = source.content.entities.find((e) => e.id === match.source.id)!;
    const b = target.content.entities.find((e) => e.id === match.target.id)!;
    const changed = (category: SceneDifference["category"], before: unknown, after: unknown, label: string) => {
      if (!equal(before, after)) differences.push({ category, entityId: a.id, message: `${a.name}: ${label}` });
    };
    changed(
      "TRANSFORM",
      [a.transform, a.anchorId, a.parentEntityId, a.widthMeters],
      [b.transform, b.anchorId, b.parentEntityId, b.widthMeters],
      "transform or frame changed",
    );
    changed(
      "VISIBILITY",
      source.content.studio?.layers.find((l) => l.entityId === a.id),
      target.content.studio?.layers.find((l) => l.entityId === b.id),
      "visibility or layer settings changed",
    );
    changed("INTERACTION", a.interactions, b.interactions, "interactions changed");
    changed(
      "CONTENT",
      [a.name, a.kind, a.content, a.alternativeText],
      [b.name, b.kind, b.content, b.alternativeText],
      "object content changed",
    );
    // Optional SC-02 extension is inspected without assuming that renderer support exists.
    const ae = (a as unknown as { element?: Record<string, unknown> }).element;
    const be = (b as unknown as { element?: Record<string, unknown> }).element;
    const category =
      ae?.kind === "INTERACTION_VOLUME" || be?.kind === "INTERACTION_VOLUME" ? "INTERACTION" : "LIGHTING_EFFECT";
    changed(category, ae, be, "spatial element settings changed");
    changed("ANIMATION", ae?.articulation ?? ae?.pulse, be?.articulation ?? be?.pulse, "animation settings changed");
  }
  const groups: [SceneDifference["category"], unknown, unknown, string][] = [
    ["TRANSFORM", source.content.anchors, target.content.anchors, "Shared object frames or anchor transforms changed"],
    [
      "LIGHTING_EFFECT",
      source.content.scenePresentation,
      target.content.scenePresentation,
      "Scene presentation or lighting overrides changed",
    ],
    [
      "INTERACTION",
      source.content.studio?.behaviors,
      target.content.studio?.behaviors,
      "Behavior triggers, actions or timing changed",
    ],
    [
      "ANIMATION",
      source.content.studio?.behaviors.map((b) => [b.id, b.delayMs]),
      target.content.studio?.behaviors.map((b) => [b.id, b.delayMs]),
      "Authored behavior timing changed",
    ],
    [
      "ANIMATION",
      source.content.studio?.animationTracks ?? [],
      target.content.studio?.animationTracks ?? [],
      "Animation tracks or clip timing changed",
    ],
    [
      "LIGHTING_EFFECT",
      source.content.studio?.assets,
      target.content.studio?.assets,
      "Media or effect dependencies changed",
    ],
    [
      "ENVIRONMENT_REFERENCE",
      [
        sourceEnvironment.reference,
        source.content.studio?.environment,
        source.content.environmentPlacements,
        source.content.adaptive,
      ],
      [
        targetEnvironment.reference,
        target.content.studio?.environment,
        target.content.environmentPlacements,
        target.content.adaptive,
      ],
      "Environment revision or semantic references changed",
    ],
  ];
  for (const [category, a, b, message] of groups) if (!equal(a, b)) differences.push({ category, message });
  return { sourceTitle: source.content.title, targetTitle: target.content.title, differences };
}
