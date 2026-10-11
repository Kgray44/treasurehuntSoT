import type { Prisma } from "@prisma/client";
import { parsePublishedSnapshot } from "@/chronicle/types";
import { projectPlayerBlock } from "@/chronicle/journal-contract";
import { projectPlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
import { CrossdeckError } from "./contracts";
import type { ObjectRef, Continuity } from "./sync-contracts";
import type { Actor } from "./service";
import type { LandfallMapScene } from "@/landfall/map-projection";

/** Resolve through pinned canonical Chronicle truth, never sender-supplied text or visibility. */
export async function resolveCrossdeckObject(
  tx: Prisma.TransactionClient,
  _actor: Actor,
  voyageId: string,
  ref: ObjectRef,
  context: Continuity,
) {
  const voyage = await tx.taleSession.findUniqueOrThrow({
    where: { id: voyageId },
    include: { version: true, revealStates: { where: { contentType: "BLOCK" } } },
  });
  const version = voyage.publishedVersionId ?? `draft:${voyage.draftRevisionId ?? "unknown"}`;
  if (ref.version !== version) throw new CrossdeckError(409, "This item changed. Refresh it before sending again.");
  const raw = voyage.previewSnapshot ?? voyage.version?.contentSnapshot;
  if (!raw) throw new CrossdeckError(409, "Open a released item in your Voyage first.");
  const snapshot = parsePublishedSnapshot(raw);
  const block = snapshot.chapters.flatMap((c) => c.blocks).find((b) => b.id === ref.objectId && b.isEnabled !== false);
  const released =
    ref.objectId === voyage.currentBlockId || voyage.revealStates.some((r) => r.contentKey === ref.objectId);
  const safe = block && projectPlayerBlock(block);
  const family =
    safe?.journalKind === "map"
      ? "MAP"
      : safe?.journalKind === "artifact"
        ? "ARTIFACT"
        : safe?.journalKind === "message" || safe?.journalKind === "story"
          ? "NOTE"
          : null;
  if (!released || !safe || family !== ref.family)
    throw new CrossdeckError(403, "This item is no longer available to send.");
  if (context.blockId && context.blockId !== ref.objectId)
    throw new CrossdeckError(400, "Choose the item you are viewing.");
  // Crew projection requires an explicit immutable authoring declaration; role labels grant nothing.
  const policy = safe.configuration.crossdeck as { visibility?: string } | undefined;
  const visibility =
    policy?.visibility === "CREW"
      ? ("CREW" as const)
      : ref.family === "NOTE"
        ? ("PRIVATE" as const)
        : ("PERSONAL" as const);
  if (ref.family !== "MAP" && Object.keys(context).some((k) => !["blockId", "readingPosition", "toolMode"].includes(k)))
    throw new CrossdeckError(400, "That view does not support chart context.");
  // Map identifiers must come from the pinned Landfall definition. They never move navigation truth.
  let scene: LandfallMapScene | undefined;
  if (ref.family === "MAP") {
    const landfall = snapshot.landfall;
    const events = landfall
      ? await tx.taleSessionEvent.findMany({
          where: { sessionId: voyageId, eventType: { startsWith: "landfall" } },
          orderBy: [{ sequence: "asc" }, { id: "asc" }],
          take: 2048,
          select: { id: true, sequence: true, eventType: true, payload: true, createdAt: true },
        })
      : [];
    const projected = landfall
      ? projectPlayerLandfallBootstrap(
          {
            definition: landfall,
            publishedVersionId: version,
            sessionId: voyageId,
            taleId: voyage.taleId,
            currentSequence: voyage.currentSequence,
          },
          {
            chapterId: block!.chapterId,
            blockId: block!.id,
            releasedAssets: [],
            events,
            replayOnly: voyage.status === "COMPLETED",
          },
        )
      : null;
    if (context.worldspaceId && !landfall?.worldspaces.some((w) => w.id === context.worldspaceId))
      throw new CrossdeckError(409, "Refresh this chart before sending.");
    if (
      context.mapId &&
      !projected?.availableMaps?.some((m) => m.id === context.mapId) &&
      projected?.scene.mapId !== context.mapId
    )
      throw new CrossdeckError(409, "Refresh this chart before sending.");
    if (context.activeRouteId && !projected?.runtimeDefinition.routes.some((r) => r.id === context.activeRouteId))
      throw new CrossdeckError(409, "Refresh this route before sending.");
    if (
      context.selectedMarkerId &&
      ![projected?.scene, ...(projected?.availableMaps?.map((m) => m.scene) ?? [])].some((s) =>
        s?.features.some((w) => w.id === context.selectedMarkerId),
      )
    )
      throw new CrossdeckError(409, "Refresh this place before sending.");
    if (context.regionId && !projected?.runtimeDefinition.context?.regions.some((r) => r.id === context.regionId))
      throw new CrossdeckError(409, "Refresh this region before sending.");
    if (context.annotationContextId)
      throw new CrossdeckError(409, "Private chart annotation drafts stay on their originating device.");
    scene = projected?.availableMaps?.find((map) => map.id === context.mapId)?.scene ?? projected?.scene;
    if (context.worldspaceId && scene?.worldspaceId !== context.worldspaceId)
      throw new CrossdeckError(409, "Refresh this chart before sending.");
    if (context.selectedMarkerId && !scene?.features.some((feature) => feature.id === context.selectedMarkerId))
      throw new CrossdeckError(409, "Choose a place on the chart you are sending.");
    if (scene && context.camera) scene = { ...scene, camera: context.camera };
  }
  return { title: safe.title, visibility, block: safe, scene };
}
