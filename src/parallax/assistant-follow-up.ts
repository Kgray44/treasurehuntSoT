import type { SpatialDraft } from "./authoring";
/** Resolve only identity references from retained, owner-bound turns; never replay their changes. */
export function assistantFollowUpFocus(
  draft: SpatialDraft,
  turns: readonly {
    requestId: string;
    operations: readonly {
      type?: string;
      entityId: string | null;
      groupId?: string | null;
      featureId?: string | null;
      trackId?: string | null;
      behaviorId?: string | null;
    }[];
  }[],
) {
  for (const turn of [...turns].reverse()) {
    const groups = [...new Set(turn.operations.flatMap((op) => (op.groupId ? [op.groupId] : [])))];
    const assets = [
      ...new Set(turn.operations.flatMap((op) => (op.entityId && !op.trackId && !op.behaviorId ? [op.entityId] : []))),
    ];
    const features = [...new Set(turn.operations.flatMap((op) => (op.featureId ? [op.featureId] : [])))];
    const groupedMembers = groups.flatMap(
      (id) => draft.content.studio?.editingGroups?.find((group) => group.id === id)?.members ?? [],
    );
    const tracks = [...new Set(turn.operations.flatMap((op) => (op.trackId ? [op.trackId] : [])))];
    const behaviors = [...new Set(turn.operations.flatMap((op) => (op.behaviorId ? [op.behaviorId] : [])))];
    const references = [
      ...(turn.operations.some((op) => ["SCENE_DETAILS", "FALLBACK"].includes(op.type ?? ""))
        ? [{ kind: "SCENE" as const, id: draft.content.definitionId, name: draft.content.title }]
        : []),
      ...tracks.map((id) => {
        const track = draft.content.studio?.animationTracks?.find((track) => track.id === id);
        return {
          kind: "ANIMATION" as const,
          id,
          name: track
            ? `${draft.content.entities.find((entity) => entity.id === track.entityId)?.name ?? "Asset"} ${track.property.toLowerCase()} animation`
            : null,
        };
      }),
      ...behaviors.map((id) => {
        const behavior = draft.content.studio?.behaviors.find((behavior) => behavior.id === id);
        return {
          kind: "INTERACTION" as const,
          id,
          name: behavior ? `${behavior.trigger.toLowerCase()} ${behavior.action.toLowerCase()}` : null,
        };
      }),
      ...groups.map((id) => ({
        kind: "GROUP" as const,
        id,
        name: draft.content.studio?.editingGroups?.find((group) => group.id === id)?.name ?? null,
      })),
      ...assets
        .filter((id) => !groupedMembers.some((member) => member.kind === "ASSET" && member.id === id))
        .map((id) => ({
          kind: "ASSET" as const,
          id,
          name: draft.content.entities.find((entity) => entity.id === id)?.name ?? null,
        })),
      ...features
        .filter((id) => !groupedMembers.some((member) => member.kind === "ROOM_FEATURE" && member.id === id))
        .map((id) => ({
          kind: "ROOM_FEATURE" as const,
          id,
          name: draft.content.studio?.environment?.features.find((feature) => feature.id === id)?.name ?? null,
        })),
    ];
    if (!references.length) continue;
    return {
      status:
        references.length !== 1
          ? ("AMBIGUOUS" as const)
          : references[0].name === null
            ? ("UNAVAILABLE" as const)
            : ("RESOLVED" as const),
      sourceRequestId: turn.requestId,
      references,
      authority: "REFERENCE_ONLY" as const,
    };
  }
  return { status: "NONE" as const, sourceRequestId: null, references: [], authority: "REFERENCE_ONLY" as const };
}
