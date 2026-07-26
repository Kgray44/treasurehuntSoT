import { createHash } from "node:crypto";
import { CommunityError, stableJson } from "./domain";
import { assertVoyageLogTransition, type VoyageLogLifecycleState } from "./voyage-log-lifecycle";
import { voyageLogVisibilities, type VoyageLogVisibility } from "./keepsakes";
import { db } from "@/lib/db";

function safeText(value: string, field: string, max: number) {
  const text = value.normalize("NFKC").trim();
  if (!text || text.length > max || /[\u0000-\u001f\u007f-\u009f]/u.test(text))
    throw new CommunityError("COMMUNITY_INVALID_VOYAGE_LOG", `${field} is invalid.`);
  return text;
}

function draftTitle(snapshot: string) {
  try {
    const value = JSON.parse(snapshot) as { title?: unknown };
    if (typeof value.title === "string") return safeText(value.title, "Voyage Log title", 140);
  } catch {}
  return "Untitled Voyage Log";
}

/** Creates only Harborlight's editable publication record from already verified preparation provenance. */
export async function ensureVoyageLogDraft(input: { ownerAccountId: string; keepsakeId: string }) {
  const keepsake = await db.communityVoyageKeepsake.findFirst({
    where: { id: input.keepsakeId, ownerAccountId: input.ownerAccountId, preparationState: "DRAFT_CREATED" },
    select: { id: true, safeSnapshot: true },
  });
  if (!keepsake) throw new CommunityError("COMMUNITY_KEEPSAKE_NOT_AVAILABLE", "Voyage Log preparation was not found.");
  const existing = await db.communityVoyageLog.findUnique({ where: { keepsakeId: keepsake.id } });
  if (existing) return existing;
  return db.communityVoyageLog.create({
    data: {
      keepsakeId: keepsake.id,
      ownerAccountId: input.ownerAccountId,
      slug: `voyage-${keepsake.id.slice(-18).toLowerCase()}`,
      title: draftTitle(keepsake.safeSnapshot),
      visibility: "PRIVATE",
      lifecycleState: "DRAFT",
    },
  });
}

export async function editVoyageLogDraft(input: {
  ownerAccountId: string;
  voyageLogId: string;
  title: string;
  safeSummary?: string | null;
  visibility: VoyageLogVisibility;
  spoilerLevel: "NONE" | "PREVIEW_SAFE" | "MINOR" | "CHAPTER" | "FINALE";
  approximateLocation?: string | null;
}) {
  if (!voyageLogVisibilities.includes(input.visibility)) throw new CommunityError("COMMUNITY_INVALID_VOYAGE_LOG", "Visibility is invalid.");
  const log = await db.communityVoyageLog.findFirst({ where: { id: input.voyageLogId, ownerAccountId: input.ownerAccountId } });
  if (!log || log.lifecycleState === "REMOVED") throw new CommunityError("COMMUNITY_VOYAGE_LOG_NOT_FOUND", "Voyage Log not found.");
  const changingPublished = log.lifecycleState === "PUBLISHED";
  const lifecycleState = changingPublished ? "CONSENT_REVIEW_REQUIRED" : log.lifecycleState;
  return db.$transaction((tx) =>
    tx.communityVoyageLog.update({ where: { id: log.id }, data: {
      title: safeText(input.title, "Voyage Log title", 140),
      safeSummary: input.safeSummary ? safeText(input.safeSummary, "Voyage Log summary", 280) : null,
      visibility: input.visibility,
      spoilerLevel: input.spoilerLevel,
      approximateLocation: input.approximateLocation ? safeText(input.approximateLocation, "Approximate location", 140) : null,
      lifecycleState,
      ...(changingPublished ? { publishedAt: null, searchIndexedAt: null, openGraphInvalidatedAt: new Date(), consentRevision: { increment: 1 } } : {}),
    } }),
  );
}

export async function transitionOwnedVoyageLog(input: { ownerAccountId: string; voyageLogId: string; to: VoyageLogLifecycleState }) {
  const log = await db.communityVoyageLog.findFirst({ where: { id: input.voyageLogId, ownerAccountId: input.ownerAccountId } });
  if (!log) throw new CommunityError("COMMUNITY_VOYAGE_LOG_NOT_FOUND", "Voyage Log not found.");
  assertVoyageLogTransition(log.lifecycleState as VoyageLogLifecycleState, input.to);
  return db.communityVoyageLog.update({ where: { id: log.id }, data: { lifecycleState: input.to, ...(input.to === "ARCHIVED" || input.to === "REMOVED" ? { publishedAt: null, searchIndexedAt: null, openGraphInvalidatedAt: new Date() } : {}) } });
}

export function voyageLogProjectionChecksum(input: { slug: string; title: string; safeSummary?: string | null; visibility: string; spoilerLevel: string; approximateLocation?: string | null }) {
  return createHash("sha256").update(stableJson(input)).digest("hex");
}
