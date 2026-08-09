import { z } from "zod";
import { getBlockDefinition, providerForBlock } from "@/chronicle/block-registry";
import {
  TIDEGLASS_LIMITS,
  TIDEGLASS_SEMANTIC_SCHEMA_VERSION,
  canonicalJson,
  compareCanonicalStrings,
  failure,
  type ChangeSignificance,
  type ChronicleChangeCategory,
  type ChronicleSemanticSnapshot,
  type ComparisonSpoilerLevel,
  type JsonValue,
  type ResolvedEditionAnchor,
  type SemanticEntity,
  type SemanticFact,
  type SemanticUnsupportedSection,
  type TideglassResult,
} from "./core";

const jsonRecordSchema = z.record(z.string(), z.unknown());
const connectionSchema = z
  .object({
    targetBlockId: z.string().min(1),
    connectionType: z.string().min(1),
    label: z.string().nullable().optional(),
    conditionExpression: z.string().nullable().optional(),
    orderIndex: z.number().int().nonnegative().optional(),
  })
  .passthrough();
const blockSchema = z
  .object({
    id: z.string().min(1),
    chapterId: z.string().min(1).optional(),
    blockType: z.string().min(1),
    title: z.string(),
    internalLabel: z.string().nullable().optional(),
    configuration: jsonRecordSchema.default({}),
    presentation: jsonRecordSchema.optional().default({}),
    completion: jsonRecordSchema.optional().default({}),
    creatorNotes: z.string().nullable().optional(),
    isEnabled: z.boolean().optional().default(true),
    schemaVersion: z.number().int().positive().optional().default(1),
    orderIndex: z.number().int().nonnegative().optional(),
    nextBlockId: z.string().nullable().optional(),
    connections: z.array(connectionSchema).optional().default([]),
  })
  .passthrough();
const chapterSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    subtitle: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    coverAssetId: z.string().nullable().optional(),
    estimatedDuration: z.number().nullable().optional(),
    isOptional: z.boolean().optional().default(false),
    metadata: jsonRecordSchema.optional().default({}),
    orderIndex: z.number().int().nonnegative().optional(),
    entryBlockId: z.string().nullable().optional(),
    completionBlockId: z.string().nullable().optional(),
    blocks: z.array(blockSchema),
  })
  .passthrough();
const taleSchema = z
  .object({
    id: z.string().min(1),
    slug: z.string().optional().default(""),
    title: z.string(),
    subtitle: z.string().nullable().optional(),
    shortDescription: z.string().nullable().optional(),
    longDescription: z.string().nullable().optional(),
    coverAssetId: z.string().nullable().optional(),
    theme: z.string().optional().default("CLASSIC"),
    visibility: z.string().optional().default("PRIVATE"),
    playerCountMin: z.number().int().nonnegative().optional().default(1),
    playerCountMax: z.number().int().nonnegative().optional().default(1),
    estimatedDuration: z.number().nullable().optional(),
    contentWarnings: z.string().nullable().optional(),
    captainRequired: z.boolean().optional(),
    minimumPlatformVersion: z.string().nullable().optional(),
    providerRequirements: z.array(z.string()).optional(),
  })
  .passthrough();
const assetSchema = z
  .object({
    id: z.string().min(1),
    mediaType: z.string().min(1),
    displayName: z.string().optional().default(""),
    description: z.string().nullable().optional(),
    mimeType: z.string().optional().default("application/octet-stream"),
    width: z.number().nullable().optional(),
    height: z.number().nullable().optional(),
    roles: z.array(z.string()).optional().default([]),
    checksum: z.string().nullable().optional(),
    contentChecksum: z.string().nullable().optional(),
    variants: z
      .array(
        z
          .object({
            id: z.string().min(1),
            role: z.string().min(1),
            mimeType: z.string().min(1),
            processingState: z.string().min(1),
            checksum: z.string().nullable().optional(),
          })
          .passthrough(),
      )
      .optional()
      .default([]),
  })
  .passthrough();
const snapshotV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    tale: taleSchema,
    chapters: z.array(chapterSchema),
    assets: z.array(assetSchema).optional().default([]),
    locations: z.array(jsonRecordSchema).optional().default([]),
    artifacts: z.array(jsonRecordSchema).optional().default([]),
    publishedAt: z.string().optional(),
  })
  .passthrough();

type SnapshotV1 = z.infer<typeof snapshotV1Schema>;

export interface TideglassHistoricalReader {
  readonly id: string;
  supports(schemaVersion: string | number): boolean;
  canonicalize(snapshot: unknown, anchor: ResolvedEditionAnchor): TideglassResult<ChronicleSemanticSnapshot>;
}

function jsonValue(value: unknown): JsonValue {
  return JSON.parse(canonicalJson(value)) as JsonValue;
}

function fact(
  path: string,
  value: unknown,
  category: ChronicleChangeCategory,
  significance: ChangeSignificance = "MEANINGFUL",
  spoilerLevel: ComparisonSpoilerLevel = "STORY_SPOILER",
  tags: string[] = [],
): SemanticFact {
  return { path, value: jsonValue(value), category, significance, spoilerLevel, tags: [...new Set(tags)].sort() };
}

function definedFacts(values: Array<SemanticFact | null | undefined>): SemanticFact[] {
  return values
    .filter((item): item is SemanticFact => Boolean(item))
    .sort((a, b) => compareCanonicalStrings(a.path, b.path));
}

const presentationKeys = new Set([
  "alignment",
  "animation",
  "entranceAnimation",
  "inkStyle",
  "paperStyle",
  "pageTurnBehavior",
  "spreadMode",
  "textAlignment",
  "widthStyle",
]);
const accessibilityKeys = new Set([
  "accessibleLabel",
  "altText",
  "caption",
  "captionAssetId",
  "captionsAssetId",
  "posterAssetId",
  "reducedMotionAssetId",
  "staticAssetId",
  "transcript",
  "transcriptAssetId",
]);
const completionKeys = new Set([
  "completionMode",
  "durationSeconds",
  "failureTargetBlockId",
  "nextChapterBehavior",
  "requiredApprovals",
  "returnToMap",
  "successTargetBlockId",
  "verificationProvider",
  "waitingText",
]);
const requirementKeys = new Set([
  "captainRequired",
  "deviceRequirement",
  "helperProvider",
  "physicalPropRequired",
  "playerCountMax",
  "playerCountMin",
]);
const compatibilityKeys = new Set(["minimumPlatformVersion", "minimumProviderVersion", "providerRequirement"]);
const artifactKeys = new Set([
  "artifactId",
  "collectionGroup",
  "connectedArtifactKey",
  "grantMode",
  "persistentAfterUnlock",
  "recipientPolicy",
  "rewardArtifactId",
]);
const locationKeys = new Set([
  "arrivalProvider",
  "locationId",
  "mapAssetId",
  "mapLocationKey",
  "region",
  "routeId",
  "verificationProfile",
]);

function classification(blockType: string, key: string, value: unknown) {
  const lower = key.toLowerCase();
  if (accessibilityKeys.has(key) || /alttext|caption|transcript|reducedmotion|staticfallback/u.test(lower))
    return { category: "ACCESSIBILITY" as const, significance: "MAJOR" as const, spoiler: "PREVIEW_SAFE" as const };
  if (blockType === "taleComplete")
    return { category: "ENDING" as const, significance: "MAJOR" as const, spoiler: "ENDING_SPOILER" as const };
  if (key === "choices" || /choice/u.test(lower))
    return {
      category: "BRANCHING_AND_CHOICES" as const,
      significance: "MAJOR" as const,
      spoiler: "STORY_SPOILER" as const,
    };
  if (artifactKeys.has(key) || /artifact|inventory|collection/u.test(lower))
    return { category: "ARTIFACT" as const, significance: "MAJOR" as const, spoiler: "STORY_SPOILER" as const };
  if (locationKeys.has(key) || /location|route|region|map/u.test(lower))
    return { category: "LOCATION_AND_MAP" as const, significance: "MAJOR" as const, spoiler: "STORY_SPOILER" as const };
  if (compatibilityKeys.has(key) || /minimumplatform|providerrequirement/u.test(lower))
    return { category: "COMPATIBILITY" as const, significance: "MAJOR" as const, spoiler: "PREVIEW_SAFE" as const };
  if (requirementKeys.has(key) || /captainrequired|playercount|device|physicalprop|helper/u.test(lower))
    return {
      category: "SETUP_REQUIREMENTS" as const,
      significance: "MAJOR" as const,
      spoiler: "PREVIEW_SAFE" as const,
    };
  if (completionKeys.has(key) || /completion|verification|timer|duration/u.test(lower))
    return { category: "COMPLETION" as const, significance: "MAJOR" as const, spoiler: "CAPTAIN_ONLY" as const };
  if (presentationKeys.has(key))
    return {
      category: "PRESENTATION_METADATA" as const,
      significance: "PRESENTATION_ONLY" as const,
      spoiler: "PREVIEW_SAFE" as const,
    };
  if (/assetid|audio|image|video|media/u.test(lower))
    return { category: "MEDIA" as const, significance: "MEANINGFUL" as const, spoiler: "PREVIEW_SAFE" as const };
  if (/acceptedanswer|captaininstruction|secret|solution/u.test(lower))
    return { category: "COMPLETION" as const, significance: "MAJOR" as const, spoiler: "PRIVATE_OR_REDACTED" as const };
  if (/warning|safety/u.test(lower))
    return {
      category: "SAFETY_AND_WARNINGS" as const,
      significance: "MAJOR" as const,
      spoiler: "PREVIEW_SAFE" as const,
    };
  if (typeof value === "undefined")
    return {
      category: "STORY_CONTENT" as const,
      significance: "MEANINGFUL" as const,
      spoiler: "STORY_SPOILER" as const,
    };
  return { category: "STORY_CONTENT" as const, significance: "MEANINGFUL" as const, spoiler: "STORY_SPOILER" as const };
}

function canonicalConfigValue(key: string, value: unknown): JsonValue {
  if (key === "providerRequirements" || key === "roles")
    return jsonValue(Array.isArray(value) ? [...value].map(String).sort() : value);
  if (key === "verificationProvider") {
    const aliases: Record<string, string> = { captainApproval: "captainManual", location: "visionLocation" };
    return jsonValue(aliases[String(value)] ?? value);
  }
  return jsonValue(value);
}

function blockFacts(block: z.infer<typeof blockSchema>, unsupported: SemanticUnsupportedSection[]): SemanticFact[] {
  const definition = getBlockDefinition(block.blockType);
  if (!definition) {
    unsupported.push({
      section: `block:${block.id}`,
      code: "UNKNOWN_SEMANTICS",
      detail: "Published Story Block type is not in the accepted registry.",
    });
    return definedFacts([
      fact("title", block.title, "STORY_CONTENT"),
      fact("enabled", block.isEnabled, "STRUCTURE", "MAJOR"),
    ]);
  }
  const allowed = new Set([
    ...definition.fields.map((field) => field.key),
    ...Object.keys(definition.defaultConfiguration),
  ]);
  const unknown = Object.keys(block.configuration).filter((key) => !allowed.has(key));
  if (unknown.length)
    unsupported.push({
      section: `block:${block.id}:configuration`,
      code: "UNKNOWN_SEMANTICS",
      detail: `Unregistered configuration fields: ${unknown.sort().join(", ")}`,
    });

  const facts: SemanticFact[] = [
    fact("title", block.title, "STORY_CONTENT"),
    fact("enabled", block.isEnabled, "STRUCTURE", "MAJOR"),
    fact("provider", providerForBlock(block.blockType, block.configuration), "COMPLETION", "MAJOR", "CAPTAIN_ONLY"),
  ];
  if (block.internalLabel)
    facts.push(fact("internalLabel", block.internalLabel, "PRESENTATION_METADATA", "MINOR", "CREATOR_ONLY"));
  for (const key of [...allowed].sort()) {
    const value = Object.prototype.hasOwnProperty.call(block.configuration, key)
      ? block.configuration[key]
      : definition.defaultConfiguration[key];
    if (value === undefined) continue;
    const detail = classification(block.blockType, key, value);
    facts.push(
      fact(
        `configuration.${key}`,
        canonicalConfigValue(key, value),
        detail.category,
        detail.significance,
        detail.spoiler,
      ),
    );
  }
  for (const [key, value] of Object.entries(block.presentation).sort(([a], [b]) => compareCanonicalStrings(a, b))) {
    const detail = classification(block.blockType, key, value);
    facts.push(fact(`presentation.${key}`, value, detail.category, detail.significance, detail.spoiler));
  }
  for (const [key, value] of Object.entries(block.completion).sort(([a], [b]) => compareCanonicalStrings(a, b))) {
    const detail = classification(block.blockType, key, value);
    facts.push(fact(`completion.${key}`, value, "COMPLETION", detail.significance, "CAPTAIN_ONLY"));
  }
  return definedFacts(facts);
}

function entityFacts(record: Record<string, unknown>, fields: readonly string[], category: ChronicleChangeCategory) {
  return definedFacts(
    fields.map((key) => {
      const value = record[key];
      if (value === undefined || value === null || key === "captainNotes") return null;
      const detail = classification("", key, value);
      return fact(
        key,
        value,
        detail.category === "STORY_CONTENT" ? category : detail.category,
        detail.significance,
        detail.spoiler,
      );
    }),
  );
}

function countAndLimit(snapshot: SnapshotV1): boolean {
  const blocks = snapshot.chapters.reduce((total, chapter) => total + chapter.blocks.length, 0);
  const edges = snapshot.chapters.reduce(
    (total, chapter) => total + chapter.blocks.reduce((blockTotal, block) => blockTotal + block.connections.length, 0),
    0,
  );
  return (
    snapshot.chapters.length <= TIDEGLASS_LIMITS.chapters &&
    blocks <= TIDEGLASS_LIMITS.blocks &&
    edges <= TIDEGLASS_LIMITS.edges &&
    snapshot.assets.length <= TIDEGLASS_LIMITS.media &&
    snapshot.artifacts.length <= TIDEGLASS_LIMITS.artifacts &&
    snapshot.locations.length <= TIDEGLASS_LIMITS.locations
  );
}

function stableEntityIdentity(record: Record<string, unknown>): string | null {
  for (const key of ["id", "legacyKey"] as const) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function canonicalizeV1(
  snapshot: unknown,
  anchor: ResolvedEditionAnchor,
  adapter: string,
): TideglassResult<ChronicleSemanticSnapshot> {
  const parsed = snapshotV1Schema.safeParse(snapshot);
  if (!parsed.success) return failure("PUBLISHED_SNAPSHOT_INVALID");
  const raw = parsed.data;
  if (raw.tale.id !== anchor.chronicleId) return failure("CROSS_CHRONICLE_COMPARISON");
  if (!countAndLimit(raw)) return failure("COMPARISON_LIMIT_EXCEEDED");

  const unsupportedSections: SemanticUnsupportedSection[] = [];
  const metadata = definedFacts([
    fact("title", raw.tale.title, "PRESENTATION_METADATA", "MEANINGFUL", "PREVIEW_SAFE"),
    fact("subtitle", raw.tale.subtitle ?? null, "PRESENTATION_METADATA", "MINOR", "PREVIEW_SAFE"),
    fact("shortDescription", raw.tale.shortDescription ?? null, "PRESENTATION_METADATA", "MINOR", "PREVIEW_SAFE"),
    fact("longDescription", raw.tale.longDescription ?? null, "PRESENTATION_METADATA", "MINOR", "PREVIEW_SAFE"),
    fact("coverAssetId", raw.tale.coverAssetId ?? null, "PRESENTATION_METADATA", "MINOR", "PREVIEW_SAFE"),
    fact("theme", raw.tale.theme, "PRESENTATION_METADATA", "PRESENTATION_ONLY", "PREVIEW_SAFE"),
    fact("visibility", raw.tale.visibility, "PRESENTATION_METADATA", "MEANINGFUL", "CREATOR_ONLY"),
    fact("estimatedDuration", raw.tale.estimatedDuration ?? null, "SETUP_REQUIREMENTS", "MEANINGFUL", "PREVIEW_SAFE"),
    fact("contentWarnings", raw.tale.contentWarnings ?? null, "SAFETY_AND_WARNINGS", "MAJOR", "PREVIEW_SAFE"),
  ]);
  const requirements = definedFacts([
    fact("playerCountMin", raw.tale.playerCountMin, "SETUP_REQUIREMENTS", "MAJOR", "PREVIEW_SAFE"),
    fact("playerCountMax", raw.tale.playerCountMax, "SETUP_REQUIREMENTS", "MAJOR", "PREVIEW_SAFE"),
    fact("captainRequired", raw.tale.captainRequired ?? true, "SETUP_REQUIREMENTS", "MAJOR", "PREVIEW_SAFE"),
    raw.tale.minimumPlatformVersion !== undefined
      ? fact("minimumPlatformVersion", raw.tale.minimumPlatformVersion, "COMPATIBILITY", "MAJOR", "PREVIEW_SAFE")
      : null,
    raw.tale.providerRequirements !== undefined
      ? fact(
          "providerRequirements",
          [...raw.tale.providerRequirements].sort(),
          "COMPATIBILITY",
          "MAJOR",
          "PREVIEW_SAFE",
        )
      : null,
  ]);

  const chapters: SemanticEntity[] = [];
  const blocks: SemanticEntity[] = [];
  const edges: ChronicleSemanticSnapshot["structure"]["graph"]["edges"] = [];
  raw.chapters.forEach((chapter, chapterPosition) => {
    const chapterOrder = chapter.orderIndex ?? chapterPosition;
    chapters.push({
      id: chapter.id,
      entityType: "CHAPTER",
      order: chapterOrder,
      facts: definedFacts([
        fact("title", chapter.title, "STORY_CONTENT"),
        fact("subtitle", chapter.subtitle ?? null, "STORY_CONTENT", "MINOR"),
        fact("description", chapter.description ?? null, "STORY_CONTENT"),
        fact("coverAssetId", chapter.coverAssetId ?? null, "PRESENTATION_METADATA", "MINOR", "PREVIEW_SAFE"),
        fact("estimatedDuration", chapter.estimatedDuration ?? null, "SETUP_REQUIREMENTS", "MINOR", "PREVIEW_SAFE"),
        fact("isOptional", chapter.isOptional, "BRANCHING_AND_CHOICES", "MAJOR"),
        fact("entryBlockId", chapter.entryBlockId ?? chapter.blocks[0]?.id ?? null, "STRUCTURE", "MAJOR"),
        fact(
          "completionBlockId",
          chapter.completionBlockId ?? chapter.blocks.at(-1)?.id ?? null,
          "ENDING",
          "MAJOR",
          "ENDING_SPOILER",
        ),
      ]),
    });
    chapter.blocks.forEach((block, blockPosition) => {
      blocks.push({
        id: block.id,
        entityType: "BLOCK",
        parentId: chapter.id,
        order: block.orderIndex ?? blockPosition,
        semanticType: block.blockType,
        facts: blockFacts(block, unsupportedSections),
      });
      block.connections.forEach((connection, connectionPosition) => {
        const order = connection.orderIndex ?? connectionPosition;
        const label = connection.label ?? null;
        const condition = connection.conditionExpression ?? null;
        edges.push({
          id: `${block.id}:${connection.connectionType}:${label ?? ""}:${condition ?? ""}:${order}`,
          sourceBlockId: block.id,
          targetBlockId: connection.targetBlockId,
          connectionType: connection.connectionType,
          label,
          condition,
          order,
        });
      });
    });
  });

  const media: SemanticEntity[] = raw.assets.map((asset) => ({
    id: asset.id,
    entityType: "MEDIA",
    semanticType: asset.mediaType,
    facts: definedFacts([
      fact("mediaType", asset.mediaType, "MEDIA", "MEANINGFUL", "PREVIEW_SAFE"),
      fact("displayName", asset.displayName, "PRESENTATION_METADATA", "MINOR", "PREVIEW_SAFE"),
      fact("description", asset.description ?? null, "PRESENTATION_METADATA", "MINOR", "PREVIEW_SAFE"),
      fact("mimeType", asset.mimeType, "MEDIA", "MEANINGFUL", "PREVIEW_SAFE"),
      fact(
        "dimensions",
        { width: asset.width ?? null, height: asset.height ?? null },
        "MEDIA",
        "MINOR",
        "PREVIEW_SAFE",
      ),
      fact("roles", [...new Set(asset.roles)].sort(), "MEDIA", "MEANINGFUL", "PREVIEW_SAFE"),
      asset.contentChecksum || asset.checksum
        ? fact("contentChecksum", asset.contentChecksum ?? asset.checksum, "MEDIA", "MAJOR", "PREVIEW_SAFE")
        : null,
      fact(
        "variants",
        asset.variants
          .map((variant) => ({
            id: variant.id,
            role: variant.role,
            mimeType: variant.mimeType,
            processingState: variant.processingState,
            ...(variant.checksum ? { checksum: variant.checksum } : {}),
          }))
          .sort((a, b) => compareCanonicalStrings(`${a.role}:${a.id}`, `${b.role}:${b.id}`)),
        "MEDIA",
        "MEANINGFUL",
        "PREVIEW_SAFE",
      ),
    ]),
  }));

  const artifacts: SemanticEntity[] = raw.artifacts.flatMap((artifact, index) => {
    const id = stableEntityIdentity(artifact);
    if (!id) return [];
    return [
      {
        id,
        entityType: "ARTIFACT" as const,
        order: typeof artifact.sortOrder === "number" ? artifact.sortOrder : index,
        semanticType: typeof artifact.inventoryCategory === "string" ? artifact.inventoryCategory : undefined,
        facts: entityFacts(
          artifact,
          [
            "name",
            "shortDescription",
            "loreDescription",
            "ordinaryGameObjectLabel",
            "artworkAssetId",
            "revealVideoAssetId",
            "modelAssetId",
            "inventoryCategory",
            "collectionGroup",
            "safeName",
            "silhouetteLabel",
            "assemblyPosition",
            "connectedArtifactKey",
            "sourceChapterOrdinal",
            "persistentAfterUnlock",
          ],
          "ARTIFACT",
        ),
      },
    ];
  });
  const locations: SemanticEntity[] = raw.locations.flatMap((location, index) => {
    const id = stableEntityIdentity(location);
    if (!id) return [];
    return [
      {
        id,
        entityType: "LOCATION" as const,
        order: typeof location.orderIndex === "number" ? location.orderIndex : index,
        semanticType: typeof location.locationType === "string" ? location.locationType : undefined,
        facts: entityFacts(
          location,
          [
            "name",
            "slug",
            "region",
            "generalDescription",
            "playerFacingDescription",
            "mapAssetId",
            "displayAssetId",
            "referenceCollectionId",
            "locationType",
            "safeLabel",
            "exactness",
            "mapX",
            "mapY",
            "mobileMapX",
            "mobileMapY",
            "verificationProfile",
          ],
          "LOCATION_AND_MAP",
        ),
      },
    ];
  });

  if (raw.artifacts.some((artifact) => !stableEntityIdentity(artifact)))
    unsupportedSections.push({
      section: "artifacts",
      code: "INVALID_SECTION",
      detail: "Artifact identity is unavailable.",
    });
  if (raw.locations.some((location) => !stableEntityIdentity(location)))
    unsupportedSections.push({
      section: "locations",
      code: "INVALID_SECTION",
      detail: "Location identity is unavailable.",
    });

  return {
    ok: true,
    value: {
      semanticSchemaVersion: TIDEGLASS_SEMANTIC_SCHEMA_VERSION,
      edition: anchor,
      metadata,
      structure: { chapters, blocks, graph: { edges } },
      progression: [],
      artifacts,
      world: { locations },
      media,
      accessibility: [],
      requirements,
      unsupportedSections: unsupportedSections.sort((a, b) =>
        compareCanonicalStrings(`${a.section}:${a.code}`, `${b.section}:${b.code}`),
      ),
      normalizationAdapters: [adapter],
    },
  };
}

export const currentSnapshotReader: TideglassHistoricalReader = {
  id: "chronicle-published-snapshot-v1",
  supports: (version) => Number(version) === 1,
  canonicalize: (snapshot, anchor) => canonicalizeV1(snapshot, anchor, "chronicle-published-snapshot-v1"),
};

export const legacyFixtureReader: TideglassHistoricalReader = {
  id: "tideglass-lossless-v0-fixture-adapter",
  supports: (version) => Number(version) === 0,
  canonicalize: (snapshot, anchor) => {
    const record =
      snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
        ? (snapshot as Record<string, unknown>)
        : null;
    if (!record) return failure("PUBLISHED_SNAPSHOT_INVALID");
    const chronicle = record.chronicle;
    const migrated = {
      ...record,
      schemaVersion: 1,
      tale: chronicle,
      chapters: record.sections ?? record.chapters,
      assets: record.media ?? record.assets ?? [],
      locations: record.waypoints ?? record.locations ?? [],
      artifacts: record.artifacts ?? [],
    };
    return canonicalizeV1(migrated, anchor, "tideglass-lossless-v0-fixture-adapter");
  },
};

export const tideglassHistoricalReaders: readonly TideglassHistoricalReader[] = [
  legacyFixtureReader,
  currentSnapshotReader,
];

export function canonicalizePublishedSnapshot(
  raw: string,
  anchor: ResolvedEditionAnchor,
  readers: readonly TideglassHistoricalReader[] = tideglassHistoricalReaders,
): TideglassResult<ChronicleSemanticSnapshot> {
  if (Buffer.byteLength(raw, "utf8") > TIDEGLASS_LIMITS.snapshotBytes) return failure("COMPARISON_LIMIT_EXCEEDED");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return failure("PUBLISHED_SNAPSHOT_INVALID");
  }
  const reader = readers.find((candidate) => candidate.supports(anchor.sourceSchemaVersion));
  if (!reader) {
    const section: SemanticUnsupportedSection = {
      section: "chronicle-semantics",
      code: "SCHEMA_UNSUPPORTED",
      sourceSchemaVersion: anchor.sourceSchemaVersion,
      detail: "No accepted Tideglass or Drydock reader supports this schema.",
    };
    return {
      ok: true,
      value: {
        semanticSchemaVersion: TIDEGLASS_SEMANTIC_SCHEMA_VERSION,
        edition: anchor,
        metadata: [],
        structure: { chapters: [], blocks: [], graph: { edges: [] } },
        progression: [],
        artifacts: [],
        world: { locations: [] },
        media: [],
        accessibility: [],
        requirements: [],
        unsupportedSections: [section],
        normalizationAdapters: ["unsupported-schema-safe-anchor"],
      },
    };
  }
  return reader.canonicalize(parsed, anchor);
}
