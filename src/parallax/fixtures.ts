import { identityTransform, type SpatialMoment } from "./contracts";
import { materializeSpatialVersion } from "./publication";
import { unknownState } from "@/sextant/contracts";
import type { SpatialContext } from "./runtime";

export function syntheticSpatialMoment(blockId = "spatial-passage"): SpatialMoment {
  const version = materializeSpatialVersion({
    id: "captains-note-v1",
    definitionId: "captains-note",
    semanticVersion: "1.0.0",
    schemaVersion: 1,
    title: "A message between worlds",
    anchors: [
      {
        id: "desk-anchor",
        kind: "LOCAL_WORLD",
        frameId: "local-session",
        transform: { ...identityTransform(), position: { x: 0, y: 0, z: -1 } },
      },
    ],
    entities: [
      {
        id: "captains-note",
        name: "The Captain’s note",
        kind: "PARCHMENT",
        anchorId: "desk-anchor",
        coordinateSpace: "LOCAL_SESSION",
        transform: identityTransform(),
        widthMeters: 0.25,
        content: "The next bearing is written in the stars. Look for the northern light.",
        alternativeText: "A parchment note bearing the Captain’s next clue.",
        interactions: ["PICK", "INSPECT", "PLACE"],
        visibility: "RELEASED",
        sharingScope: "PERSONAL",
      },
    ],
    placementPolicy: "FIXED",
    privacyClass: "LOCAL_EPHEMERAL",
    fallback: {
      mode: "GUIDED",
      narrative: "The Captain’s note is ready to read here. Its clue is the same in every view.",
      preservesMeaning: true,
    },
    accessibility: { seated: true, keyboard: true, reducedMotion: true, soundIndependent: true },
  });
  return {
    schemaVersion: 1,
    definition: {
      id: "captains-note",
      ownerPersonId: "synthetic-creator",
      title: version.title,
      libraryScope: "CHRONICLE_ONLY",
    },
    version,
    attachment: {
      id: "note-attachment",
      storyMomentId: blockId,
      spatialDefinitionVersionId: version.id,
      versionChecksum: version.checksum,
      overrides: {},
    },
  };
}
export const syntheticBinding = {
  sessionId: "synthetic-voyage",
  chronicleVersionId: "synthetic-edition",
  blockId: "spatial-passage",
  actorId: "synthetic-player",
  runId: "synthetic-run",
};
export const guidedContext = (): SpatialContext => ({
  camera: unknownState(),
  replayOnly: false,
  environment: "PRODUCTION",
});

/** Private, synthetic publication fixture; never creates a live Chronicle or Player. */
export function syntheticPublishedChronicle(): import("@/chronicle/types").PublishedTaleSnapshot {
  return {
    schemaVersion: 1,
    tale: {
      id: "synthetic-parallax",
      slug: "synthetic-parallax",
      title: "A message between worlds",
      subtitle: null,
      shortDescription: null,
      longDescription: null,
      coverAssetId: null,
      theme: "default",
      visibility: "PRIVATE",
      playerCountMin: 1,
      playerCountMax: 1,
      estimatedDuration: null,
      contentWarnings: null,
    },
    chapters: [
      {
        id: "synthetic-chapter",
        title: "The Captain’s note",
        orderIndex: 0,
        entryBlockId: "spatial-passage",
        completionBlockId: "voyage-complete",
        blocks: [
          {
            id: "spatial-passage",
            chapterId: "synthetic-chapter",
            blockType: "narrative",
            title: "A message",
            schemaVersion: 2,
            configuration: { heading: "The Captain’s note", body: "Open the Chronicle Lens to read the note." },
            presentation: { spatialMoment: syntheticSpatialMoment() },
            completion: { mode: "playerConfirmation" },
            isEnabled: true,
            orderIndex: 0,
            nextBlockId: "voyage-complete",
            connections: [{ targetBlockId: "voyage-complete", connectionType: "DEFAULT", orderIndex: 0 }],
          },
          {
            id: "voyage-complete",
            chapterId: "synthetic-chapter",
            blockType: "taleComplete",
            title: "Voyage complete",
            configuration: {},
            isEnabled: true,
            orderIndex: 1,
            nextBlockId: null,
            connections: [],
          },
        ],
      },
    ],
    assets: [],
    locations: [],
    artifacts: [],
    publishedAt: "2026-10-10T00:00:00.000Z",
  };
}
