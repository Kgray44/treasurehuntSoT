import { z } from "zod";
import type { JsonObject, PublishedBlock } from "@/tall-tale/types";

export const journalContentKinds = [
  "story",
  "riddle",
  "map",
  "artifact",
  "decision",
  "objective",
  "locationVerification",
  "message",
  "cinematic",
  "chapterComplete",
] as const;

export type TallTaleJournalContentKind = (typeof journalContentKinds)[number];
export type JournalSpreadMode = "left" | "right" | "two-page" | "overlay" | "cinematic";
export type JournalPageTurnBehavior = "manual" | "automatic" | "captain-triggered" | "locked";

export const journalPresentationSchema = z
  .object({
    spreadMode: z.enum(["left", "right", "two-page", "overlay", "cinematic"]).optional(),
    pageTemplate: z.string().max(80).optional(),
    paperStyle: z.string().max(80).optional(),
    inkStyle: z.string().max(80).optional(),
    transitionIn: z.string().max(80).optional(),
    transitionOut: z.string().max(80).optional(),
    pageTurnBehavior: z.enum(["manual", "automatic", "captain-triggered", "locked"]).optional(),
    ambientAudio: z.string().max(240).optional(),
    soundEffect: z.string().max(240).optional(),
    backgroundScene: z.string().max(120).optional(),
    bookmarkStyle: z.string().max(80).optional(),
    loosePaperStyle: z.string().max(80).optional(),
    sealStyle: z.string().max(80).optional(),
  })
  .strict();

export type JournalPresentationConfig = z.infer<typeof journalPresentationSchema>;

export type PlayerJournalBlock = {
  id: string;
  chapterId: string;
  blockType: string;
  journalKind: TallTaleJournalContentKind;
  title: string;
  orderIndex: number;
  configuration: JsonObject;
  presentation: JournalPresentationConfig;
  connections: Array<{ targetBlockId: string; connectionType: "CHOICE"; label: string | null }>;
  progress: "released" | "active" | "completed";
  releasedAt: string | null;
  completedAt: string | null;
  selectedTargetId: string | null;
};

export type PlayerJournalChapter = {
  id: string;
  title: string;
  subtitle: string | null;
  orderIndex: number;
  blocks: PlayerJournalBlock[];
};

export type PlayerJournalProjection = {
  mode: "active" | "historical" | "preview";
  currentChapterId: string | null;
  currentBlockId: string | null;
  chapters: PlayerJournalChapter[];
};

export type PlayerJournalReadingState = {
  pageId: string | null;
  openDrawer: "chapters" | "map" | "artifacts" | "messages" | null;
  hasOpened: boolean;
  lastEventSequence: number;
  textScale: number;
  updatedAt: string | null;
};

export const journalReadingStateInputSchema = z
  .object({
    pageId: z.string().min(1).max(180).nullable().optional(),
    openDrawer: z.enum(["chapters", "map", "artifacts", "messages"]).nullable().optional(),
    hasOpened: z.boolean().optional(),
    lastEventSequence: z.number().int().min(0).optional(),
    textScale: z.number().min(0.85).max(1.5).optional(),
  })
  .strict();

export type PlayerJournalReadingStateInput = z.infer<typeof journalReadingStateInputSchema>;

const deniedPlayerKey =
  /acceptedanswer|answerkey|solution|captaininstruction|captainnotes?|creatornotes?|internal|conditionexpression|futureprovider|private|secret|hiddenconsequence|^hints?$/i;

/** Recursively strips authoring, answer, and Captain-only keys before Player serialization. */
export function sanitizePlayerValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizePlayerValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !deniedPlayerKey.test(key))
      .map(([key, item]) => [key, sanitizePlayerValue(item)]),
  );
}

export function sanitizePlayerObject(value: JsonObject): JsonObject {
  return sanitizePlayerValue(value) as JsonObject;
}

export function journalKindForBlock(blockType: string): TallTaleJournalContentKind | null {
  if (["narrative", "information", "image"].includes(blockType)) return "story";
  if (["riddle", "textAnswer"].includes(blockType)) return "riddle";
  if (["travelDirection", "location"].includes(blockType)) return "map";
  if (["imageTransformation", "hiddenMessageReveal", "artifactReveal", "collectionUpdate"].includes(blockType))
    return "artifact";
  if (blockType === "choice") return "decision";
  if (["confirmation", "wait"].includes(blockType)) return "objective";
  if (["arrivalCheck", "captainApproval", "visionWaypoint"].includes(blockType)) return "locationVerification";
  if (blockType === "captainsNote") return "message";
  if (["cinematic", "audio"].includes(blockType)) return "cinematic";
  if (["chapterComplete", "taleComplete"].includes(blockType)) return "chapterComplete";
  return null;
}

function defaultSpreadMode(blockType: string): JournalSpreadMode {
  if (["cinematic"].includes(blockType)) return "cinematic";
  if (
    ["imageTransformation", "hiddenMessageReveal", "artifactReveal", "travelDirection", "location"].includes(blockType)
  )
    return "two-page";
  if (["captainsNote", "collectionUpdate"].includes(blockType)) return "overlay";
  return "right";
}

export function parseJournalPresentation(value: JsonObject | undefined, blockType: string): JournalPresentationConfig {
  const parsed = journalPresentationSchema.safeParse(value ?? {});
  const safe = parsed.success ? parsed.data : {};
  return {
    spreadMode: safe.spreadMode ?? defaultSpreadMode(blockType),
    pageTemplate: safe.pageTemplate ?? journalKindForBlock(blockType) ?? "story",
    paperStyle: safe.paperStyle ?? "weathered",
    inkStyle: safe.inkStyle ?? "midnight",
    transitionIn: safe.transitionIn ?? "ink-settle",
    transitionOut: safe.transitionOut ?? "page-turn",
    pageTurnBehavior: safe.pageTurnBehavior ?? "manual",
    ...(safe.ambientAudio ? { ambientAudio: safe.ambientAudio } : {}),
    ...(safe.soundEffect ? { soundEffect: safe.soundEffect } : {}),
    ...(safe.backgroundScene ? { backgroundScene: safe.backgroundScene } : {}),
    ...(safe.bookmarkStyle ? { bookmarkStyle: safe.bookmarkStyle } : {}),
    ...(safe.loosePaperStyle ? { loosePaperStyle: safe.loosePaperStyle } : {}),
    ...(safe.sealStyle ? { sealStyle: safe.sealStyle } : {}),
  };
}

export function projectPlayerBlock(block: PublishedBlock, options: { releasedHintCount?: number } = {}) {
  const kind = journalKindForBlock(block.blockType);
  if (!kind) return null;
  const configuration = sanitizePlayerObject(block.configuration);
  if (options.releasedHintCount && Array.isArray(block.configuration.hints))
    configuration.releasedHints = sanitizePlayerValue(block.configuration.hints.slice(0, options.releasedHintCount));
  return {
    id: block.id,
    chapterId: block.chapterId,
    blockType: block.blockType,
    journalKind: kind,
    title: block.title,
    orderIndex: block.orderIndex,
    configuration,
    presentation: parseJournalPresentation(block.presentation, block.blockType),
    connections: block.connections
      .filter((connection) => connection.connectionType === "CHOICE")
      .map((connection) => ({
        targetBlockId: connection.targetBlockId,
        connectionType: "CHOICE" as const,
        label: connection.label ?? null,
      })),
  };
}

export const emptyJournalReadingState: PlayerJournalReadingState = {
  pageId: null,
  openDrawer: null,
  hasOpened: false,
  lastEventSequence: 0,
  textScale: 1,
  updatedAt: null,
};
