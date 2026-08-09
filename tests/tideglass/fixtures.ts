import { sha256, type ResolvedEditionAnchor } from "../../src/tideglass/core";
import type {
  TideglassEditionRepository,
  TideglassPublishedEdition,
  TideglassPrincipal,
} from "../../src/tideglass/service";

export type FixtureSnapshot = Record<string, unknown> & {
  schemaVersion: number;
  tale: Record<string, unknown>;
  chapters: Array<Record<string, unknown> & { blocks: Array<Record<string, unknown>> }>;
  assets: Array<Record<string, unknown>>;
  locations: Array<Record<string, unknown>>;
  artifacts: Array<Record<string, unknown>>;
};

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function baseSnapshot(): FixtureSnapshot {
  return {
    schemaVersion: 1,
    tale: {
      id: "chronicle-tideglass",
      slug: "glass-harbor",
      title: "The Glass Harbor",
      subtitle: null,
      shortDescription: "A synthetic Tideglass fixture.",
      longDescription: "A safe, invented Voyage used only for deterministic tests.",
      coverAssetId: "asset-cover",
      theme: "CLASSIC",
      visibility: "PRIVATE",
      playerCountMin: 2,
      playerCountMax: 5,
      estimatedDuration: 90,
      contentWarnings: null,
      captainRequired: true,
      minimumPlatformVersion: "1.0.0",
      providerRequirements: ["captainManual"],
    },
    chapters: [
      {
        id: "chapter-opening",
        title: "The First Mark",
        subtitle: null,
        description: "An invented opening.",
        coverAssetId: "asset-cover",
        estimatedDuration: 45,
        isOptional: false,
        metadata: {},
        orderIndex: 0,
        entryBlockId: "block-opening",
        completionBlockId: "block-finish",
        blocks: [
          {
            id: "block-opening",
            chapterId: "chapter-opening",
            blockType: "narrative",
            title: "Arrival",
            internalLabel: null,
            configuration: {
              heading: "Glass on the tide",
              body: "The crew reaches a harbor made only for tests.",
              textAlignment: "left",
              widthStyle: "reading",
              entranceAnimation: "ink",
              completionMode: "playerConfirmation",
            },
            presentation: { spreadMode: "single-page" },
            completion: {},
            creatorNotes: null,
            isEnabled: true,
            schemaVersion: 1,
            orderIndex: 0,
            nextBlockId: "block-finish",
            connections: [
              {
                targetBlockId: "block-finish",
                connectionType: "DEFAULT",
                label: null,
                conditionExpression: null,
                orderIndex: 0,
              },
            ],
          },
          {
            id: "block-finish",
            chapterId: "chapter-opening",
            blockType: "taleComplete",
            title: "Voyage Complete",
            internalLabel: null,
            configuration: {
              finaleHeading: "The mark is set",
              finaleContent: "The synthetic voyage ends.",
              completionMessage: "Complete.",
              credits: "",
              replayAvailable: true,
              completionMode: "playerConfirmation",
            },
            presentation: {},
            completion: {},
            creatorNotes: null,
            isEnabled: true,
            schemaVersion: 1,
            orderIndex: 1,
            nextBlockId: null,
            connections: [],
          },
        ],
      },
    ],
    assets: [
      {
        id: "asset-cover",
        mediaType: "IMAGE",
        displayName: "Synthetic cover",
        description: "Invented fixture art.",
        mimeType: "image/webp",
        width: 1600,
        height: 900,
        roles: ["COVER", "BACKGROUND"],
        checksum: "media-content-checksum-a",
        storageKey: "private/never-output/cover-a.webp",
        filename: "derived-a.webp",
        createdAt: "2026-01-01T00:00:00.000Z",
        variants: [
          {
            id: "asset-cover-wide",
            role: "WIDE",
            mimeType: "image/webp",
            processingState: "READY",
            checksum: "variant-content-checksum-a",
            storageKey: "private/never-output/derived-a.webp",
            filename: "derived-a.webp",
          },
        ],
      },
    ],
    locations: [],
    artifacts: [
      {
        id: "artifact-glass-token",
        taleId: "chronicle-tideglass",
        name: "Glass Token",
        shortDescription: "A synthetic token.",
        loreDescription: "No private story content.",
        ordinaryGameObjectLabel: "token",
        artworkAssetId: "asset-cover",
        revealVideoAssetId: null,
        modelAssetId: null,
        inventoryCategory: "RELIC",
        collectionGroup: "fixture",
        safeName: "Token",
        silhouetteLabel: "Round token",
        assemblyPosition: null,
        connectedArtifactKey: null,
        sourceChapterOrdinal: 0,
        sortOrder: 0,
        persistentAfterUnlock: true,
      },
    ],
    publishedAt: "2026-01-01T00:00:00.000Z",
  };
}

export function anchor(
  editionId: string,
  checksum: string,
  sourceSchemaVersion: number | string = 1,
  chronicleId = "chronicle-tideglass",
): ResolvedEditionAnchor {
  return {
    chronicleId,
    editionId,
    editionChecksum: checksum,
    sourceSchemaVersion,
    retainedState: "PLAYABLE",
  };
}

export function edition(
  id: string,
  snapshot: unknown,
  options: { chronicleId?: string; schemaVersion?: number | string; retainedState?: "PLAYABLE" | "REDACTED" } = {},
): TideglassPublishedEdition {
  const contentSnapshot = JSON.stringify(snapshot);
  return {
    id,
    chronicleId: options.chronicleId ?? "chronicle-tideglass",
    contentSnapshot,
    schemaVersion: options.schemaVersion ?? 1,
    checksum: sha256(contentSnapshot),
    publishedAt: "2026-01-01T00:00:00.000Z",
    retainedState: options.retainedState ?? "PLAYABLE",
  };
}

export class FixtureRepository implements TideglassEditionRepository {
  readonly authorizationCalls: string[] = [];

  constructor(
    readonly editions: TideglassPublishedEdition[],
    readonly authorizedEditionIds = new Set(editions.map((item) => item.id)),
  ) {}

  async findExactEdition(editionId: string) {
    return this.editions.find((item) => item.id === editionId) ?? null;
  }

  async authorizeEdition(_principal: TideglassPrincipal, item: TideglassPublishedEdition) {
    this.authorizationCalls.push(item.id);
    return this.authorizedEditionIds.has(item.id);
  }
}

export function largeSnapshot(blockCount = 500): FixtureSnapshot {
  const snapshot = baseSnapshot();
  const chapterCount = 10;
  snapshot.chapters = Array.from({ length: chapterCount }, (_, chapterIndex) => {
    const count = Math.floor(blockCount / chapterCount);
    const blocks = Array.from({ length: count }, (_, blockIndex) => {
      const globalIndex = chapterIndex * count + blockIndex;
      const id = `large-block-${globalIndex}`;
      const nextId = blockIndex + 1 < count ? `large-block-${globalIndex + 1}` : null;
      return {
        id,
        chapterId: `large-chapter-${chapterIndex}`,
        blockType: "narrative",
        title: `Synthetic block ${globalIndex}`,
        configuration: {
          heading: `Heading ${globalIndex}`,
          body: `Deterministic synthetic body ${globalIndex}`,
          textAlignment: "left",
          widthStyle: "reading",
          entranceAnimation: "ink",
          completionMode: "playerConfirmation",
        },
        presentation: {},
        completion: {},
        creatorNotes: null,
        isEnabled: true,
        schemaVersion: 1,
        orderIndex: blockIndex,
        nextBlockId: nextId,
        connections: nextId
          ? [
              {
                targetBlockId: nextId,
                connectionType: "DEFAULT",
                label: null,
                conditionExpression: null,
                orderIndex: 0,
              },
            ]
          : [],
      };
    });
    return {
      id: `large-chapter-${chapterIndex}`,
      title: `Synthetic chapter ${chapterIndex}`,
      subtitle: null,
      description: "Large deterministic fixture.",
      coverAssetId: "asset-cover",
      estimatedDuration: 10,
      isOptional: false,
      metadata: {},
      orderIndex: chapterIndex,
      entryBlockId: blocks[0]?.id ?? null,
      completionBlockId: blocks.at(-1)?.id ?? null,
      blocks,
    };
  });
  snapshot.assets = Array.from({ length: 50 }, (_, index) => ({
    id: `large-asset-${index}`,
    mediaType: "IMAGE",
    displayName: `Synthetic asset ${index}`,
    description: null,
    mimeType: "image/webp",
    width: 800,
    height: 600,
    roles: ["STORY"],
    checksum: `large-media-checksum-${index}`,
    variants: [],
  }));
  snapshot.artifacts = Array.from({ length: 40 }, (_, index) => ({
    id: `large-artifact-${index}`,
    name: `Synthetic artifact ${index}`,
    inventoryCategory: "RELIC",
    sortOrder: index,
    persistentAfterUnlock: true,
  }));
  snapshot.locations = Array.from({ length: 40 }, (_, index) => ({
    id: `large-location-${index}`,
    name: `Synthetic location ${index}`,
    locationType: "STORY",
    exactness: "APPROXIMATE",
    orderIndex: index,
    verificationProfile: { provider: "captainManual" },
  }));
  return snapshot;
}
