import { db } from "@/lib/db";
import { getBlockDefinition } from "@/tall-tale/block-registry";
import { getStudioTale, slugSchema } from "@/tall-tale/studio-service";
import type { DraftValidationResult, ValidationIssue } from "@/tall-tale/types";

const futureProviders = new Set(["visionLocation", "visionObject", "externalWebhook"]);

export async function validateTaleDraft(taleId: string): Promise<DraftValidationResult & { autosaveVersion: number }> {
  const studio = await getStudioTale(taleId);
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const error = (issue: Omit<ValidationIssue, "severity">) => errors.push({ ...issue, severity: "error" });
  const warn = (issue: Omit<ValidationIssue, "severity">) => warnings.push({ ...issue, severity: "warning" });

  if (!studio.tale.title.trim()) error({ code: "TALE_TITLE", message: "The Tall Tale needs a title.", field: "title" });
  const slug = slugSchema.safeParse(studio.tale.slug);
  if (!slug.success)
    error({
      code: "TALE_SLUG",
      message: slug.error.issues[0]?.message ?? "The tale address is invalid.",
      field: "slug",
    });
  if (!studio.draft.chapters.length) error({ code: "NO_CHAPTERS", message: "Add at least one chapter." });
  if (!studio.tale.coverAssetId)
    warn({ code: "NO_COVER", message: "Add cover artwork before featuring this tale.", field: "coverAssetId" });
  if (!studio.tale.estimatedDuration)
    warn({
      code: "NO_DURATION",
      message: "Add an estimated duration for the player catalog.",
      field: "estimatedDuration",
    });

  const assets = new Map(studio.assets.map((asset) => [asset.id, asset]));
  const allBlocks = studio.draft.chapters.flatMap((chapter) =>
    chapter.blocks.map((block) => ({ ...block, chapterId: chapter.id })),
  );
  const blockIds = new Set(allBlocks.map((block) => block.id));
  const outgoing = new Map<string, string[]>();
  const referencedAssetIds = new Set<string>();
  let taleCompleteCount = 0;

  for (const chapter of studio.draft.chapters) {
    if (!chapter.blocks.length) {
      error({ code: "EMPTY_CHAPTER", message: `“${chapter.title}” needs an entry block.`, chapterId: chapter.id });
      continue;
    }
    if (!chapter.estimatedDuration)
      warn({
        code: "CHAPTER_DURATION",
        message: `“${chapter.title}” has no estimated duration.`,
        chapterId: chapter.id,
      });
    for (const block of chapter.blocks) {
      const definition = getBlockDefinition(block.blockType);
      if (!definition) {
        error({
          code: "UNKNOWN_BLOCK",
          message: `“${block.title}” uses unknown block type ${block.blockType}.`,
          chapterId: chapter.id,
          blockId: block.id,
        });
        continue;
      }
      const parsed = definition.validationSchema.safeParse(block.configuration);
      if (!parsed.success) {
        for (const issue of parsed.error.issues)
          error({
            code: "BLOCK_FIELD",
            message: `${block.title}: ${issue.message}`,
            chapterId: chapter.id,
            blockId: block.id,
            field: issue.path.join("."),
          });
      }
      if (block.blockType === "taleComplete") taleCompleteCount += 1;
      const provider = String(block.configuration.verificationProvider ?? block.configuration.completionMode ?? "");
      if (futureProviders.has(provider))
        error({
          code: "FUTURE_PROVIDER_ACTIVE",
          message: `${block.title} selects ${provider}, which is stored for future use but unavailable as an active Phase 1 provider.`,
          chapterId: chapter.id,
          blockId: block.id,
          field: "verificationProvider",
        });
      if (["riddle", "textAnswer"].includes(block.blockType)) {
        const answers = block.configuration.acceptedAnswers;
        if (!Array.isArray(answers) || !answers.some((answer) => typeof answer === "string" && answer.trim()))
          error({
            code: "NO_ANSWERS",
            message: `${block.title} needs at least one accepted answer.`,
            chapterId: chapter.id,
            blockId: block.id,
            field: "acceptedAnswers",
          });
      }
      for (const [field, mediaTypes] of Object.entries(definition.assetFields)) {
        const assetId = block.configuration[field];
        if (!assetId || typeof assetId !== "string") continue;
        const selected = assets.get(assetId);
        if (!selected) {
          error({
            code: "MISSING_ASSET",
            message: `${block.title} references an unavailable asset.`,
            chapterId: chapter.id,
            blockId: block.id,
            assetId,
            field,
          });
          continue;
        }
        referencedAssetIds.add(assetId);
        if (mediaTypes.length && !mediaTypes.includes(selected.mediaType))
          error({
            code: "ASSET_TYPE",
            message: `${selected.displayName} is not compatible with ${definition.fields.find((item) => item.key === field)?.label ?? field}.`,
            chapterId: chapter.id,
            blockId: block.id,
            assetId,
            field,
          });
        if (selected.roles.includes("CAPTAIN_ONLY_REFERENCE"))
          error({
            code: "PRIVATE_ASSET",
            message: `${selected.displayName} is Captain-only and cannot be assigned to player content.`,
            chapterId: chapter.id,
            blockId: block.id,
            assetId,
            field,
          });
        if (!selected.variants.some((variant) => variant.processingState === "READY"))
          error({
            code: "ASSET_PROCESSING",
            message: `${selected.displayName} has no ready player variant.`,
            chapterId: chapter.id,
            blockId: block.id,
            assetId,
            field,
          });
        if (selected.fileSize > 20 * 1024 * 1024)
          warn({
            code: "LARGE_ASSET",
            message: `${selected.displayName} is larger than 20 MB and may load slowly on mobile connections.`,
            chapterId: chapter.id,
            blockId: block.id,
            assetId,
            field,
          });
      }
      if (block.blockType === "image" && !String(block.configuration.altText ?? "").trim())
        warn({
          code: "MISSING_ALT",
          message: `${block.title} needs useful alternative text.`,
          chapterId: chapter.id,
          blockId: block.id,
          field: "altText",
        });
      if (block.blockType === "imageTransformation") {
        const alignment = block.configuration.alignment;
        if (!alignment || typeof alignment !== "object")
          warn({
            code: "NO_ALIGNMENT",
            message: `${block.title} has no saved mobile/alignment treatment.`,
            chapterId: chapter.id,
            blockId: block.id,
            field: "alignment",
          });
      }
      const targets = block.connections.map((connection) => connection.targetBlockId);
      outgoing.set(block.id, targets);
      for (const target of targets)
        if (!blockIds.has(target))
          error({
            code: "BROKEN_CONNECTION",
            message: `${block.title} points to a story block that no longer exists.`,
            chapterId: chapter.id,
            blockId: block.id,
          });
      if (
        block.isEnabled &&
        !targets.length &&
        !["chapterComplete", "taleComplete"].includes(block.blockType) &&
        block !== chapter.blocks.at(-1)
      )
        error({
          code: "MISSING_DEFAULT_CONNECTION",
          message: `${block.title} has no default continuation.`,
          chapterId: chapter.id,
          blockId: block.id,
        });
      if (block.blockType === "choice") {
        const choices = block.configuration.choices;
        if (!Array.isArray(choices) || choices.length < 2)
          error({
            code: "CHOICE_COUNT",
            message: `${block.title} needs at least two choices.`,
            chapterId: chapter.id,
            blockId: block.id,
            field: "choices",
          });
        for (const choice of Array.isArray(choices) ? choices : []) {
          const target =
            choice && typeof choice === "object" ? String((choice as Record<string, unknown>).targetBlockId ?? "") : "";
          if (!blockIds.has(target))
            error({
              code: "CHOICE_TARGET",
              message: `${block.title} has a missing choice target.`,
              chapterId: chapter.id,
              blockId: block.id,
              field: "choices",
            });
        }
      }
      if (block.blockType === "condition") {
        for (const field of ["successTargetBlockId", "failureTargetBlockId"] as const)
          if (!blockIds.has(String(block.configuration[field] ?? "")))
            error({
              code: "CONDITION_TARGET",
              message: `${block.title} has a missing ${field === "successTargetBlockId" ? "success" : "failure"} target.`,
              chapterId: chapter.id,
              blockId: block.id,
              field,
            });
      }
    }
  }
  if (!taleCompleteCount)
    error({ code: "NO_TALE_COMPLETE", message: "Add a Tale Complete block so the runtime has a safe endpoint." });
  if (taleCompleteCount > 1)
    warn({
      code: "MULTIPLE_TALE_COMPLETE",
      message: "The tale has multiple completion endpoints. Confirm each branch is intentional.",
    });

  const entry = allBlocks[0]?.id;
  if (entry) {
    const visited = new Set<string>();
    const queue = [entry];
    while (queue.length) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const target of outgoing.get(current) ?? []) if (!visited.has(target)) queue.push(target);
    }
    for (const block of allBlocks)
      if (block.isEnabled && !visited.has(block.id)) {
        const chapter = studio.draft.chapters.find((item) => item.id === block.chapterId);
        const issue = {
          code: "UNREACHABLE_BLOCK",
          message: `${block.title} cannot be reached through the saved story graph.`,
          chapterId: block.chapterId,
          blockId: block.id,
        };
        if (chapter?.isOptional) warn(issue);
        else error(issue);
      }

    const completionIds = new Set(
      allBlocks.filter((block) => block.blockType === "taleComplete").map((block) => block.id),
    );
    const canComplete = new Set(completionIds);
    let changed = true;
    while (changed) {
      changed = false;
      for (const block of allBlocks) {
        if (canComplete.has(block.id)) continue;
        if ((outgoing.get(block.id) ?? []).some((target) => canComplete.has(target))) {
          canComplete.add(block.id);
          changed = true;
        }
      }
    }
    for (const block of allBlocks)
      if (block.isEnabled && visited.has(block.id) && !canComplete.has(block.id))
        error({
          code: "NO_COMPLETION_PATH",
          message: `${block.title} enters a branch or loop with no path to Tale Complete.`,
          chapterId: block.chapterId,
          blockId: block.id,
        });
  }

  for (const asset of studio.assets)
    if (!referencedAssetIds.has(asset.id) && asset.id !== studio.tale.coverAssetId)
      warn({
        code: "UNUSED_ASSET",
        message: `${asset.displayName} is not used by the current draft.`,
        assetId: asset.id,
      });

  const checkedAt = new Date();
  const result: DraftValidationResult = {
    valid: errors.length === 0,
    errors,
    warnings,
    checkedAt: checkedAt.toISOString(),
  };
  await db.taleDraft.update({
    where: { id: studio.draft.id },
    data: {
      validationState: result.valid ? "VALID" : "INVALID",
      validationSummary: JSON.stringify(result),
      lastValidatedAt: checkedAt,
    },
  });
  return { ...result, autosaveVersion: studio.draft.autosaveVersion };
}
