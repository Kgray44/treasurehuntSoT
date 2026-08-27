import { canonicalChecksum } from "@/drydock/canonical";
import { publishedSourceChecksum } from "@/chronicle/snapshot";
import type { PublishedChapter, PublishedTaleSnapshot } from "@/chronicle/types";

export type PublishingReviewChange = {
  kind: "ADDED" | "REMOVED" | "CHANGED";
  subject: "Chronicle" | "Chapter" | "Passage" | "Asset" | "Location" | "Artifact";
  label: string;
  detail: string;
};

export type PublishingReview = {
  sourceChecksum: string;
  currentPublished: { versionLabel: string; checksum: string } | null;
  summary: { chapters: number; passages: number; assets: number; changes: number };
  changes: PublishingReviewChange[];
  assets: {
    total: number;
    ready: number;
    attention: number;
    items: Array<{ label: string; readiness: "READY" | "ATTENTION" }>;
  };
};

type CurrentPublishedSource = {
  versionLabel: string;
  checksum: string;
  snapshot: PublishedTaleSnapshot;
};

const countPassages = (snapshot: PublishedTaleSnapshot) =>
  snapshot.chapters.reduce((total, chapter) => total + chapter.blocks.length, 0);

const label = (value: string | null | undefined, fallback: string, ordinal: number) =>
  value?.trim() || `${fallback} ${ordinal + 1}`;

const same = (left: unknown, right: unknown) => canonicalChecksum(left) === canonicalChecksum(right);

function chapterComparable(chapter: PublishedChapter) {
  const { blocks: _blocks, ...rest } = chapter;
  return rest;
}

function chapterChanges(current: PublishedTaleSnapshot, baseline: PublishedTaleSnapshot | null) {
  const changes: PublishingReviewChange[] = [];
  const previous = new Map((baseline?.chapters ?? []).map((chapter) => [chapter.id, chapter]));
  const currentIds = new Set(current.chapters.map((chapter) => chapter.id));

  current.chapters.forEach((chapter, index) => {
    const prior = previous.get(chapter.id);
    const chapterLabel = label(chapter.title, "Untitled Chapter", index);
    if (!prior) {
      changes.push({ kind: "ADDED", subject: "Chapter", label: chapterLabel, detail: "New Chapter in this draft." });
    } else if (!same(chapterComparable(chapter), chapterComparable(prior))) {
      changes.push({
        kind: "CHANGED",
        subject: "Chapter",
        label: chapterLabel,
        detail: "Chapter details or placement changed.",
      });
    }

    const priorBlocks = new Map((prior?.blocks ?? []).map((block) => [block.id, block]));
    const currentBlockIds = new Set(chapter.blocks.map((block) => block.id));
    chapter.blocks.forEach((block, blockIndex) => {
      const priorBlock = priorBlocks.get(block.id);
      const passageLabel = label(block.title, "Untitled Passage", blockIndex);
      if (!priorBlock) {
        changes.push({ kind: "ADDED", subject: "Passage", label: passageLabel, detail: `Added in ${chapterLabel}.` });
      } else if (!same(block, priorBlock)) {
        changes.push({
          kind: "CHANGED",
          subject: "Passage",
          label: passageLabel,
          detail: `Content or connections changed in ${chapterLabel}.`,
        });
      }
    });
    (prior?.blocks ?? []).forEach((block, blockIndex) => {
      if (!currentBlockIds.has(block.id))
        changes.push({
          kind: "REMOVED",
          subject: "Passage",
          label: label(block.title, "Untitled Passage", blockIndex),
          detail: `Removed from ${label(prior?.title, "Untitled Chapter", index)}.`,
        });
    });
  });

  (baseline?.chapters ?? []).forEach((chapter, index) => {
    if (!currentIds.has(chapter.id))
      changes.push({
        kind: "REMOVED",
        subject: "Chapter",
        label: label(chapter.title, "Untitled Chapter", index),
        detail: "Removed from this draft.",
      });
  });
  return changes;
}

function assetChanges(current: PublishedTaleSnapshot, baseline: PublishedTaleSnapshot | null) {
  const changes: PublishingReviewChange[] = [];
  const previous = new Map((baseline?.assets ?? []).map((asset) => [asset.id, asset]));
  const currentIds = new Set(current.assets.map((asset) => asset.id));
  current.assets.forEach((asset, index) => {
    const prior = previous.get(asset.id);
    const assetLabel = label(asset.displayName, "Untitled asset", index);
    if (!prior)
      changes.push({ kind: "ADDED", subject: "Asset", label: assetLabel, detail: "Added to the release source." });
    else if (!same(asset, prior))
      changes.push({
        kind: "CHANGED",
        subject: "Asset",
        label: assetLabel,
        detail: "Asset metadata or derivatives changed.",
      });
  });
  (baseline?.assets ?? []).forEach((asset, index) => {
    if (!currentIds.has(asset.id))
      changes.push({
        kind: "REMOVED",
        subject: "Asset",
        label: label(asset.displayName, "Untitled asset", index),
        detail: "Removed from the release source.",
      });
  });
  return changes;
}

function libraryChanges(
  current: Array<Record<string, unknown>>,
  baseline: Array<Record<string, unknown>>,
  subject: "Location" | "Artifact",
) {
  const changes: PublishingReviewChange[] = [];
  const recordId = (record: Record<string, unknown>) => (typeof record.id === "string" ? record.id : null);
  const recordLabel = (record: Record<string, unknown>, index: number) =>
    label(typeof record.name === "string" ? record.name : null, `Untitled ${subject.toLowerCase()}`, index);
  const previous = new Map(
    baseline.flatMap((record) => {
      const id = recordId(record);
      return id ? [[id, record] as const] : [];
    }),
  );
  const currentIds = new Set(current.map(recordId).filter((id): id is string => Boolean(id)));

  current.forEach((record, index) => {
    const id = recordId(record);
    const prior = id ? previous.get(id) : undefined;
    const itemLabel = recordLabel(record, index);
    if (!prior) {
      changes.push({ kind: "ADDED", subject, label: itemLabel, detail: `Added to the release source.` });
    } else if (!same(record, prior)) {
      changes.push({ kind: "CHANGED", subject, label: itemLabel, detail: `${subject} details changed.` });
    }
  });
  baseline.forEach((record, index) => {
    const id = recordId(record);
    if (!id || !currentIds.has(id)) {
      changes.push({
        kind: "REMOVED",
        subject,
        label: recordLabel(record, index),
        detail: "Removed from the release source.",
      });
    }
  });
  return changes;
}

/**
 * Produces a Creator-readable, exact structural review. It deliberately never
 * exposes internal identifiers: Studio already owns visual selection and
 * Drydock owns validation semantics.
 */
export function buildPublishingReview(
  current: PublishedTaleSnapshot,
  published: CurrentPublishedSource | null,
): PublishingReview {
  const baseline = published?.snapshot ?? null;
  const changes = [
    ...chapterChanges(current, baseline),
    ...assetChanges(current, baseline),
    ...libraryChanges(current.locations, baseline?.locations ?? [], "Location"),
    ...libraryChanges(current.artifacts, baseline?.artifacts ?? [], "Artifact"),
  ];
  if (baseline && !same(current.tale, baseline.tale))
    changes.unshift({
      kind: "CHANGED",
      subject: "Chronicle",
      label: current.tale.title,
      detail: "Chronicle release details changed.",
    });
  const items = current.assets.map((asset, index) => ({
    label: label(asset.displayName, "Untitled asset", index),
    readiness: (asset.variants ?? []).every((variant) => variant.processingState === "READY")
      ? ("READY" as const)
      : ("ATTENTION" as const),
  }));
  const ready = items.filter((asset) => asset.readiness === "READY").length;
  return {
    sourceChecksum: publishedSourceChecksum(current),
    currentPublished: published ? { versionLabel: published.versionLabel, checksum: published.checksum } : null,
    summary: {
      chapters: current.chapters.length,
      passages: countPassages(current),
      assets: current.assets.length,
      changes: changes.length,
    },
    changes,
    assets: { total: current.assets.length, ready, attention: current.assets.length - ready, items },
  };
}
