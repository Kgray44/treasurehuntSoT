import { createHash } from "node:crypto";
import { z } from "zod";
import type { JsonObject } from "@/chronicle/types";
import type { Block, Chapter, DraftState } from "@/components/studio/studio-types";

export const reusableItemKinds = ["PRESET", "FRAGMENT", "CHAPTER_TEMPLATE"] as const;
export type ReusableItemKind = (typeof reusableItemKinds)[number];

export type ReusableAttribution = {
  sourceOwnerId: string;
  sourceItemId?: string;
  sourceVersionId?: string;
  sourceReleaseId?: string;
  license?: string;
  modified: boolean;
};

export type ReusableParameter = {
  key: string;
  label: string;
  type:
    | "TEXT"
    | "TITLE"
    | "ASSET"
    | "ARTIFACT"
    | "LOCATION"
    | "VARIABLE"
    | "DURATION"
    | "TARGET"
    | "CHOICE_LABEL"
    | "VISIBILITY";
  required: boolean;
  defaultValue?: string | number | boolean;
  helpText: string;
  destinationPath: string;
};

export type ReusableFragmentPort = { key: string; label: string; sourceBlockId: string; connectionType: string };
export type ReusableChapter = Omit<Chapter, "blocks"> & { blockIds: string[] };

export type ReusableContentEnvelope = {
  envelopeType: "voyagewright.reusable-authoring";
  envelopeVersion: 1;
  itemId: string;
  versionId: string;
  kind: ReusableItemKind;
  name: string;
  description: string;
  tags: string[];
  ownerId: string;
  blocks: Block[];
  chapters: ReusableChapter[];
  entryPorts: ReusableFragmentPort[];
  exitPorts: ReusableFragmentPort[];
  parameters: ReusableParameter[];
  dependencies: { assetIds: string[]; artifactIds: string[]; locationIds: string[]; providerIds: string[] };
  accessibilityObligations: string[];
  attribution: ReusableAttribution;
  lineage: Array<{ itemId: string; versionId: string }>;
  compatibility: { minimumReaderVersion: number; blockContractVersions: Record<string, number> };
  checksum: string;
};

const jsonObjectSchema: z.ZodType<JsonObject> = z.record(z.string(), z.unknown()) as z.ZodType<JsonObject>;
const blockSchema = z.object({
  id: z.string().min(8).max(128),
  blockType: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  internalLabel: z.string().max(160).nullable().optional(),
  configuration: jsonObjectSchema,
  presentation: jsonObjectSchema,
  completion: jsonObjectSchema,
  creatorNotes: z.string().max(10000).nullable().optional(),
  isEnabled: z.boolean(),
  schemaVersion: z.number().int().min(1).max(100),
  nextBlockId: z.string().min(8).max(128).nullable().optional(),
  connections: z
    .array(
      z.object({
        targetBlockId: z.string().min(8).max(128),
        connectionType: z.string().min(1).max(80),
        label: z.string().max(400).nullable().optional(),
        conditionExpression: z.string().max(10000).nullable().optional(),
        orderIndex: z.number().int().min(0).max(10000).optional(),
      }),
    )
    .optional(),
});

const envelopeSchema: z.ZodType<ReusableContentEnvelope> = z.object({
  envelopeType: z.literal("voyagewright.reusable-authoring"),
  envelopeVersion: z.literal(1),
  itemId: z.string().min(8).max(128),
  versionId: z.string().min(8).max(128),
  kind: z.enum(reusableItemKinds),
  name: z.string().min(1).max(160),
  description: z.string().max(10000),
  tags: z.array(z.string().min(1).max(64)).max(30),
  ownerId: z.string().min(1).max(128),
  blocks: z.array(blockSchema).min(1).max(1000),
  chapters: z
    .array(
      z.object({
        id: z.string().min(8).max(128),
        title: z.string().min(1).max(160),
        subtitle: z.string().max(240).nullable().optional(),
        description: z.string().max(10000).nullable().optional(),
        coverAssetId: z.string().max(128).nullable().optional(),
        estimatedDuration: z.number().int().min(1).max(10000).nullable().optional(),
        isOptional: z.boolean(),
        metadata: jsonObjectSchema,
        blockIds: z.array(z.string().min(8).max(128)).max(1000),
      }),
    )
    .max(200),
  entryPorts: z
    .array(
      z.object({
        key: z.string().min(1).max(80),
        label: z.string().min(1).max(160),
        sourceBlockId: z.string().min(8).max(128),
        connectionType: z.string().min(1).max(80),
      }),
    )
    .max(100),
  exitPorts: z
    .array(
      z.object({
        key: z.string().min(1).max(80),
        label: z.string().min(1).max(160),
        sourceBlockId: z.string().min(8).max(128),
        connectionType: z.string().min(1).max(80),
      }),
    )
    .max(100),
  parameters: z
    .array(
      z.object({
        key: z
          .string()
          .regex(/^[a-z][a-z0-9_]*$/)
          .max(80),
        label: z.string().min(1).max(160),
        type: z.enum([
          "TEXT",
          "TITLE",
          "ASSET",
          "ARTIFACT",
          "LOCATION",
          "VARIABLE",
          "DURATION",
          "TARGET",
          "CHOICE_LABEL",
          "VISIBILITY",
        ]),
        required: z.boolean(),
        defaultValue: z.union([z.string().max(10000), z.number().finite(), z.boolean()]).optional(),
        helpText: z.string().max(1000),
        destinationPath: z.string().min(1).max(240),
      }),
    )
    .max(100),
  dependencies: z.object({
    assetIds: z.array(z.string().min(1).max(128)).max(1000),
    artifactIds: z.array(z.string().min(1).max(128)).max(1000),
    locationIds: z.array(z.string().min(1).max(128)).max(1000),
    providerIds: z.array(z.string().min(1).max(128)).max(1000),
  }),
  accessibilityObligations: z.array(z.string().min(1).max(200)).max(100),
  attribution: z.object({
    sourceOwnerId: z.string().min(1).max(128),
    sourceItemId: z.string().min(8).max(128).optional(),
    sourceVersionId: z.string().min(8).max(128).optional(),
    sourceReleaseId: z.string().min(8).max(128).optional(),
    license: z.string().max(240).optional(),
    modified: z.boolean(),
  }),
  lineage: z.array(z.object({ itemId: z.string().min(8).max(128), versionId: z.string().min(8).max(128) })).max(100),
  compatibility: z.object({
    minimumReaderVersion: z.number().int().min(1).max(100),
    blockContractVersions: z.record(z.string().min(1).max(80), z.number().int().min(1).max(100)),
  }),
  checksum: z.string().length(64),
}) as z.ZodType<ReusableContentEnvelope>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  return value;
}

function canonicalEnvelope(value: Omit<ReusableContentEnvelope, "checksum">) {
  return JSON.stringify(canonicalize(value));
}

export function checksumReusableEnvelope(value: Omit<ReusableContentEnvelope, "checksum">) {
  return createHash("sha256").update(canonicalEnvelope(value)).digest("hex");
}

export function parseReusableEnvelope(value: unknown): ReusableContentEnvelope {
  const parsed = envelopeSchema.parse(value);
  const { checksum, ...unsigned } = parsed;
  if (checksumReusableEnvelope(unsigned) !== checksum)
    throw new Error("Reusable content checksum does not match its canonical envelope.");
  return parsed;
}

const unsafeReusableField =
  /(?:password|passphrase|access[_-]?code|invitation|creator[_-]?notes|captain[_-]?notes|private[_-]?(?:text|note|content)|secret|token)/iu;

export function assertReusableCaptureSafe(blocks: Block[]) {
  const inspect = (value: unknown, path = "") => {
    if (typeof value === "string") {
      if (value.includes("SEALED-HOLD-SYNTHETIC-PRIVATE-SENTINEL"))
        throw new Error("Reusable content cannot capture protected Sealed Hold text.");
      return;
    }
    if (Array.isArray(value)) return value.forEach((entry, index) => inspect(entry, `${path}[${index}]`));
    if (!value || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value)) {
      const fieldPath = path ? `${path}.${key}` : key;
      if (unsafeReusableField.test(key))
        throw new Error(`Reusable content cannot capture protected field ${fieldPath}.`);
      if (key === "privacy" && typeof entry === "string" && entry !== "PLAYER_SAFE")
        throw new Error("Reusable content cannot capture private variable or state configuration.");
      inspect(entry, fieldPath);
    }
  };
  for (const block of blocks) {
    if (block.creatorNotes) throw new Error("Reusable content cannot capture Creator notes.");
    inspect(block.configuration, `blocks.${block.id}.configuration`);
    inspect(block.presentation, `blocks.${block.id}.presentation`);
    inspect(block.completion, `blocks.${block.id}.completion`);
  }
}

type IdKind = "block" | "chapter" | "variable";
export type ReferenceRemap = {
  blocks: Record<string, string>;
  chapters: Record<string, string>;
  variables: Record<string, string>;
};
export type InsertionPlan = {
  operationId: string;
  sourceItemId: string;
  sourceVersionId: string;
  remap: ReferenceRemap;
  chapters: Chapter[];
  attribution: ReusableAttribution;
  lineage: Array<{ itemId: string; versionId: string }>;
  warnings: string[];
};

type ReusableParameterValue = string | number | boolean;

function assertParameterValue(parameter: ReusableParameter, value: ReusableParameterValue) {
  if (
    ["TEXT", "TITLE", "ASSET", "ARTIFACT", "LOCATION", "VARIABLE", "TARGET", "CHOICE_LABEL"].includes(parameter.type)
  ) {
    if (typeof value !== "string" || !value.trim())
      throw new Error(`Parameter ${parameter.label} requires a non-empty text value.`);
  }
  if (parameter.type === "DURATION" && (typeof value !== "number" || !Number.isFinite(value) || value <= 0))
    throw new Error(`Parameter ${parameter.label} requires a positive duration.`);
  if (parameter.type === "VISIBILITY" && !["PRIVATE", "UNLISTED", "PUBLIC"].includes(String(value)))
    throw new Error(`Parameter ${parameter.label} requires a supported visibility value.`);
}

function assignParameter(blocks: Block[], destinationPath: string, value: ReusableParameterValue) {
  const match = /^blocks\.([^\.]+)\.(configuration|presentation|completion)\.([a-zA-Z][a-zA-Z0-9_.-]{0,200})$/u.exec(
    destinationPath,
  );
  if (!match)
    throw new Error(
      "Reusable parameter destinations must target a canonical block configuration, presentation, or completion field.",
    );
  const block = blocks.find((candidate) => candidate.id === match[1]);
  if (!block) throw new Error("Reusable parameter destination does not belong to this reusable item.");
  const root = block[match[2] as "configuration" | "presentation" | "completion"] as JsonObject;
  const parts = match[3].split(".");
  let cursor: JsonObject = root;
  for (const part of parts.slice(0, -1)) {
    const existing = cursor[part];
    if (existing !== undefined && (!existing || typeof existing !== "object" || Array.isArray(existing)))
      throw new Error("Reusable parameter destination conflicts with a non-object canonical field.");
    cursor[part] = (existing as JsonObject | undefined) ?? {};
    cursor = cursor[part] as JsonObject;
  }
  cursor[parts.at(-1)!] = value;
}

function assertExistingParameterDestination(blocks: Block[], destinationPath: string) {
  const match = /^blocks\.([^\.]+)\.(configuration|presentation|completion)\.([a-zA-Z][a-zA-Z0-9_.-]{0,200})$/u.exec(
    destinationPath,
  );
  if (!match)
    throw new Error(
      "Reusable parameter destinations must target a canonical block configuration, presentation, or completion field.",
    );
  const block = blocks.find((candidate) => candidate.id === match[1]);
  if (!block) throw new Error("Reusable parameter destination does not belong to this reusable item.");
  let cursor: unknown = block[match[2] as "configuration" | "presentation" | "completion"];
  for (const part of match[3].split(".")) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor) || !Object.hasOwn(cursor, part))
      throw new Error("Reusable parameter destination must be an existing canonical field in the reusable item.");
    cursor = (cursor as JsonObject)[part];
  }
}

export function assertReusableParameterDefinitions(blocks: Block[], parameters: ReusableParameter[]) {
  const sampleFor = (parameter: ReusableParameter): ReusableParameterValue => {
    if (parameter.type === "DURATION") return 1;
    if (parameter.type === "VISIBILITY") return "PRIVATE";
    return "parameter-validation";
  };
  const copied = clone(blocks);
  const keys = new Set<string>();
  for (const parameter of parameters) {
    if (!/^[a-z][a-z0-9_]*$/u.test(parameter.key))
      throw new Error("Reusable parameter keys must use lowercase letters, numbers, and underscores.");
    if (keys.has(parameter.key)) throw new Error("Reusable parameter keys must be unique within this item.");
    keys.add(parameter.key);
    assertExistingParameterDestination(blocks, parameter.destinationPath);
    if (parameter.defaultValue !== undefined) assertParameterValue(parameter, parameter.defaultValue);
    assignParameter(copied, parameter.destinationPath, sampleFor(parameter));
  }
}

export function resolveReusableParameters(
  envelope: ReusableContentEnvelope,
  supplied: Record<string, ReusableParameterValue> = {},
) {
  const resolved = clone(envelope);
  assertReusableParameterDefinitions(resolved.blocks, resolved.parameters);
  for (const parameter of resolved.parameters) {
    const value = supplied[parameter.key] ?? parameter.defaultValue;
    if (value === undefined) {
      if (parameter.required) throw new Error(`Reusable parameter ${parameter.label} is required before insertion.`);
      continue;
    }
    assertParameterValue(parameter, value);
    assignParameter(resolved.blocks, parameter.destinationPath, value);
  }
  return resolved;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function destinationIds(draft: DraftState) {
  return {
    blocks: new Set(draft.chapters.flatMap((chapter) => chapter.blocks.map((block) => block.id))),
    chapters: new Set(draft.chapters.map((chapter) => chapter.id)),
    variables: new Set(
      draft.chapters.flatMap((chapter) =>
        chapter.blocks.flatMap((block) =>
          typeof block.configuration.variableId === "string" ? [block.configuration.variableId] : [],
        ),
      ),
    ),
  };
}

function allocate(operationId: string, kind: IdKind, sourceId: string, occupied: Set<string>) {
  let ordinal = 0;
  let candidate = `${operationId}-${kind}-${sourceId}`;
  while (occupied.has(candidate)) candidate = `${operationId}-${kind}-${sourceId}-${++ordinal}`;
  occupied.add(candidate);
  return candidate;
}

function remapKnownReferences(value: JsonObject, remap: ReferenceRemap): JsonObject {
  const result = clone(value);
  for (const [key, item] of Object.entries(result)) {
    if (typeof item === "object" && item && !Array.isArray(item))
      result[key] = remapKnownReferences(item as JsonObject, remap);
    else if (Array.isArray(item))
      result[key] = item.map((entry) =>
        typeof entry === "object" && entry && !Array.isArray(entry)
          ? remapKnownReferences(entry as JsonObject, remap)
          : entry,
      );
    else if (typeof item === "string") {
      if (["targetBlockId", "nextBlockId", "successTargetBlockId", "failureTargetBlockId"].includes(key))
        result[key] = remap.blocks[item] ?? item;
      if (key === "variableId") result[key] = remap.variables[item] ?? item;
    }
  }
  return result;
}

export function planReusableInsertion(input: {
  envelope: ReusableContentEnvelope;
  draft: DraftState;
  operationId: string;
  targetChapterId?: string;
  targetBlockId?: string;
  parameterValues?: Record<string, ReusableParameterValue>;
}): InsertionPlan {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{7,95}$/.test(input.operationId))
    throw new Error("Insertion operation identity is invalid.");
  const envelope = resolveReusableParameters(parseReusableEnvelope(input.envelope), input.parameterValues);
  const occupied = destinationIds(input.draft);
  const remap: ReferenceRemap = { blocks: {}, chapters: {}, variables: {} };
  for (const block of envelope.blocks)
    remap.blocks[block.id] = allocate(input.operationId, "block", block.id, occupied.blocks);
  for (const chapter of envelope.chapters)
    remap.chapters[chapter.id] = allocate(input.operationId, "chapter", chapter.id, occupied.chapters);
  for (const block of envelope.blocks) {
    const variableId = block.configuration.variableId;
    if (typeof variableId === "string" && !remap.variables[variableId])
      remap.variables[variableId] = allocate(input.operationId, "variable", variableId, occupied.variables);
  }
  const remappedBlocks: Block[] = envelope.blocks.map((source) => ({
    ...clone(source),
    id: remap.blocks[source.id],
    nextBlockId: source.nextBlockId ? (remap.blocks[source.nextBlockId] ?? source.nextBlockId) : source.nextBlockId,
    configuration: remapKnownReferences(source.configuration, remap),
    presentation: remapKnownReferences(source.presentation, remap),
    completion: remapKnownReferences(source.completion, remap),
    connections: source.connections?.map((connection) => ({
      ...connection,
      targetBlockId: remap.blocks[connection.targetBlockId] ?? connection.targetBlockId,
    })),
  }));
  const blockBySourceId = new Map<string, Block>(remappedBlocks.map((block) => [block.id, block]));
  const fallbackChapter = input.targetChapterId
    ? input.draft.chapters.find((chapter) => chapter.id === input.targetChapterId)
    : input.draft.chapters[0];
  if (!fallbackChapter)
    throw new Error("A destination Chronicle needs at least one Chapter before reusable content can be inserted.");
  const chapters = envelope.chapters.length
    ? envelope.chapters.map((source) => {
        const { blockIds, ...chapter } = clone(source);
        return {
          ...chapter,
          id: remap.chapters[source.id],
          metadata: remapKnownReferences(source.metadata, remap),
          blocks: blockIds
            .map((id) => blockBySourceId.get(remap.blocks[id]))
            .filter((block): block is Block => Boolean(block)),
        };
      })
    : [{ ...clone(fallbackChapter), blocks: [...fallbackChapter.blocks, ...remappedBlocks] }];
  if (input.targetBlockId) {
    const target = chapters.flatMap((chapter) => chapter.blocks).find((block) => block.id === input.targetBlockId);
    const entrySourceId = envelope.entryPorts[0]?.sourceBlockId ?? envelope.blocks[0]?.id;
    const entryBlockId = entrySourceId ? remap.blocks[entrySourceId] : undefined;
    if (!target || !entryBlockId)
      throw new Error("The selected insertion destination is not available in this reusable-content plan.");
    const connections = target.connections ?? [];
    if (connections.some((connection) => connection.targetBlockId === entryBlockId))
      throw new Error("The selected insertion destination already connects to this reusable entry Passage.");
    target.connections = [
      ...connections,
      { targetBlockId: entryBlockId, connectionType: "DEFAULT", orderIndex: connections.length },
    ];
    target.nextBlockId = entryBlockId;
  }
  return {
    operationId: input.operationId,
    sourceItemId: envelope.itemId,
    sourceVersionId: envelope.versionId,
    remap,
    chapters,
    attribution: { ...envelope.attribution, modified: true },
    lineage: [...envelope.lineage, { itemId: envelope.itemId, versionId: envelope.versionId }],
    warnings: envelope.accessibilityObligations.length
      ? [`Review ${envelope.accessibilityObligations.length} inherited accessibility obligation(s) before publication.`]
      : [],
  };
}

export function applyReusableInsertion(draft: DraftState, plan: InsertionPlan): DraftState {
  const next = clone(draft);
  const replacement = new Map(plan.chapters.map((chapter) => [chapter.id, chapter]));
  next.chapters = next.chapters.map((chapter) => replacement.get(chapter.id) ?? chapter);
  for (const chapter of plan.chapters)
    if (!next.chapters.some((candidate) => candidate.id === chapter.id)) next.chapters.push(chapter);
  return next;
}
