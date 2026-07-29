import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { CommunityError } from "./domain";

export const moderationStatuses = [
  "OPEN",
  "TRIAGED",
  "ASSIGNED",
  "INVESTIGATING",
  "AWAITING_INFORMATION",
  "ACTION_REQUIRED",
  "ACTIONED",
  "APPEAL_PENDING",
  "RESOLVED",
  "CLOSED",
  "DUPLICATE",
  "DISMISSED",
] as const;
export type ModerationStatus = (typeof moderationStatuses)[number];
export const moderationReasonCodes = [
  "SPAM",
  "IMPERSONATION",
  "HARASSMENT",
  "ABUSE",
  "PRIVACY_EXPOSURE",
  "CHILD_SAFETY",
  "NONCONSENSUAL_MEDIA",
  "DANGEROUS_LOCATION",
  "INTELLECTUAL_PROPERTY",
  "MALICIOUS_PACKAGE",
  "MALWARE",
  "MISLEADING_LISTING",
  "SPOILER_VIOLATION",
  "LICENSE_VIOLATION",
  "PROHIBITED_CONTENT",
  "OTHER",
] as const;
export type ModerationReasonCode = (typeof moderationReasonCodes)[number];
export const appealStatuses = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "INFORMATION_REQUESTED",
  "UPHELD",
  "OVERTURNED",
  "PARTIALLY_OVERTURNED",
  "WITHDRAWN",
  "CLOSED",
] as const;
export type AppealStatus = (typeof appealStatuses)[number];

export type CommunityModeratorActor = {
  accountId: string;
  roles: readonly string[];
  correlationId?: string;
};

const transitionMatrix: Record<ModerationStatus, readonly ModerationStatus[]> = {
  OPEN: ["TRIAGED", "DISMISSED", "DUPLICATE"],
  TRIAGED: ["ASSIGNED", "INVESTIGATING", "ACTION_REQUIRED", "DISMISSED", "DUPLICATE"],
  ASSIGNED: ["INVESTIGATING", "AWAITING_INFORMATION", "ACTION_REQUIRED", "RESOLVED"],
  INVESTIGATING: ["AWAITING_INFORMATION", "ACTION_REQUIRED", "RESOLVED", "DISMISSED"],
  AWAITING_INFORMATION: ["INVESTIGATING", "ACTION_REQUIRED", "RESOLVED", "CLOSED"],
  ACTION_REQUIRED: ["ACTIONED", "RESOLVED", "DISMISSED"],
  ACTIONED: ["APPEAL_PENDING", "RESOLVED", "CLOSED"],
  APPEAL_PENDING: ["ACTIONED", "RESOLVED", "CLOSED"],
  RESOLVED: ["CLOSED", "APPEAL_PENDING"],
  CLOSED: [],
  DUPLICATE: [],
  DISMISSED: ["CLOSED"],
};
const appealTransitionMatrix: Record<AppealStatus, readonly AppealStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "WITHDRAWN", "CLOSED"],
  UNDER_REVIEW: ["INFORMATION_REQUESTED", "UPHELD", "OVERTURNED", "PARTIALLY_OVERTURNED", "CLOSED"],
  INFORMATION_REQUESTED: ["UNDER_REVIEW", "WITHDRAWN", "CLOSED"],
  UPHELD: ["CLOSED"],
  OVERTURNED: ["CLOSED"],
  PARTIALLY_OVERTURNED: ["CLOSED"],
  WITHDRAWN: ["CLOSED"],
  CLOSED: [],
};
const highImpactActions = new Set([
  "QUARANTINE_RELEASE",
  "QUARANTINE_PACKAGE",
  "SUSPEND_PROFILE",
  "REVOKE_PUBLICATION",
]);

function valueIn<T extends readonly string[]>(value: string, values: T): value is T[number] {
  return values.includes(value);
}
function correlation(actor: CommunityModeratorActor) {
  return actor.correlationId ?? randomUUID();
}
function requireModerator(actor: CommunityModeratorActor, adminOnly = false) {
  const roles = new Set(actor.roles);
  if (adminOnly ? !roles.has("ADMINISTRATOR") : !roles.has("MODERATOR") && !roles.has("ADMINISTRATOR"))
    throw new CommunityError("COMMUNITY_ACCESS_DENIED", "Moderation authorization is required.");
}
function requiredReason(value: string): ModerationReasonCode {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]+/g, "_");
  if (!valueIn(normalized, moderationReasonCodes))
    throw new CommunityError("COMMUNITY_MODERATION_REASON_INVALID", "A governed moderation reason is required.");
  return normalized;
}
function caseFingerprint(subjectType: string, subjectId: string, reason: string) {
  return createHash("sha256").update(`${subjectType}:${subjectId}:${reason}`).digest("hex");
}
function caseKey(fingerprint: string) {
  return `harbor-${fingerprint.slice(0, 24)}`;
}
function safeSnapshot(input: Record<string, unknown>) {
  const prohibited = /(?:token|password|credential|private|location|route|answer|note|storagekey|email)/iu;
  const entries = Object.entries(input).filter(([key, value]) => !prohibited.test(key) && typeof value !== "object");
  return JSON.stringify(Object.fromEntries(entries.map(([key, value]) => [key, String(value).slice(0, 240)])));
}

export function assertModerationTransition(current: string, next: string) {
  if (
    !valueIn(current, moderationStatuses) ||
    !valueIn(next, moderationStatuses) ||
    !transitionMatrix[current].includes(next)
  )
    throw new CommunityError("COMMUNITY_MODERATION_TRANSITION_INVALID", "That case transition is not permitted.");
}
export function assertAppealTransition(current: string, next: string) {
  if (
    !valueIn(current, appealStatuses) ||
    !valueIn(next, appealStatuses) ||
    !appealTransitionMatrix[current].includes(next)
  )
    throw new CommunityError("COMMUNITY_APPEAL_TRANSITION_INVALID", "That appeal transition is not permitted.");
}

/** Called in the report transaction. It deduplicates only same-subject/same-reason
 * reports, preserving reporter privacy and avoiding creator-wide aggregation. */
export async function attachReportToModerationCase(
  tx: Prisma.TransactionClient,
  report: {
    id: string;
    subjectType: string;
    subjectId: string;
    reason: string;
    reporterAccountId: string;
    createdAt: Date;
  },
) {
  // Legacy Phase 3 report clients could submit bounded free text. Preserve
  // those receipts while routing them to the governed OTHER bucket; new
  // moderator actions always require an explicit governed reason code.
  const candidate = report.reason
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]+/g, "_");
  const reason: ModerationReasonCode = valueIn(candidate, moderationReasonCodes) ? candidate : "OTHER";
  const fingerprint = caseFingerprint(report.subjectType, report.subjectId, reason);
  const existing = await tx.communityModerationCase.findFirst({
    where: {
      subjectFingerprint: fingerprint,
      status: { in: ["OPEN", "TRIAGED", "ASSIGNED", "INVESTIGATING", "ACTION_REQUIRED"] },
    },
    orderBy: { openedAt: "asc" },
  });
  const moderationCase =
    existing ??
    (await tx.communityModerationCase.create({
      data: {
        caseKey: caseKey(fingerprint),
        primaryReasonCode: reason,
        subjectFingerprint: fingerprint,
        correlationId: `report:${report.id}`,
        priority: reason === "CHILD_SAFETY" || reason === "NONCONSENSUAL_MEDIA" ? "IMMEDIATE_SAFETY" : "MEDIUM",
        severity: reason === "CHILD_SAFETY" || reason === "MALWARE" ? "URGENT" : "MEDIUM",
      },
    }));
  await tx.communityModerationCaseSubject.upsert({
    where: {
      caseId_subjectType_subjectId: {
        caseId: moderationCase.id,
        subjectType: report.subjectType,
        subjectId: report.subjectId,
      },
    },
    create: {
      caseId: moderationCase.id,
      subjectType: report.subjectType,
      subjectId: report.subjectId,
      tombstone: "{}",
    },
    update: {},
  });
  await tx.communityModerationCaseReport.upsert({
    where: { reportId: report.id },
    create: { caseId: moderationCase.id, reportId: report.id },
    update: {},
  });
  await tx.communityReport.update({
    where: { id: report.id },
    data: { caseId: moderationCase.id, status: "RECEIVED" },
  });
  if (!existing)
    await tx.communityModerationCaseEvent.create({
      data: {
        caseId: moderationCase.id,
        eventType: "REPORT_CASE_OPENED",
        toStatus: "OPEN",
        reasonCode: reason,
        actorAccountId: report.reporterAccountId,
        correlationId: `report:${report.id}`,
      },
    });
  return moderationCase;
}

export async function listModerationCases(actor: CommunityModeratorActor, take = 50) {
  requireModerator(actor);
  return db.communityModerationCase.findMany({
    where: { conflictAccountId: { not: actor.accountId } },
    orderBy: [{ priority: "desc" }, { openedAt: "asc" }],
    take: Math.max(1, Math.min(100, take)),
    select: {
      id: true,
      caseKey: true,
      status: true,
      severity: true,
      priority: true,
      primaryReasonCode: true,
      revision: true,
      assignedAccountId: true,
      openedAt: true,
      updatedAt: true,
    },
  });
}

export async function getModerationCase(actor: CommunityModeratorActor, caseId: string) {
  requireModerator(actor);
  const found = await db.communityModerationCase.findFirst({
    where: { id: caseId, conflictAccountId: { not: actor.accountId } },
  });
  if (!found) throw new CommunityError("COMMUNITY_MODERATION_CASE_NOT_FOUND", "This moderation case is unavailable.");
  await db.communityModerationCaseEvent.create({
    data: {
      caseId,
      eventType: "CASE_VIEWED",
      reasonCode: "OTHER",
      actorAccountId: actor.accountId,
      correlationId: correlation(actor),
    },
  });
  const [subjects, assignments, actions, appeals] = await Promise.all([
    db.communityModerationCaseSubject.findMany({
      where: { caseId },
      select: { subjectType: true, subjectId: true, subjectChecksum: true, createdAt: true },
    }),
    db.communityModerationCaseAssignment.findMany({
      where: { caseId, endedAt: null },
      select: { moderatorAccountId: true, state: true, createdAt: true },
    }),
    db.communityModerationAction.findMany({
      where: { caseId },
      select: { id: true, actionType: true, state: true, reasonCode: true, appliedAt: true },
    }),
    db.communityModerationAppeal.findMany({ where: { caseId }, select: { id: true, status: true, createdAt: true } }),
  ]);
  return { ...found, subjects, assignments, actions, appeals };
}

export async function transitionModerationCase(
  actor: CommunityModeratorActor,
  input: { caseId: string; expectedRevision: number; nextStatus: string; reasonCode: string },
) {
  requireModerator(actor);
  const reason = requiredReason(input.reasonCode);
  const existing = await db.communityModerationCase.findUnique({ where: { id: input.caseId } });
  if (!existing || existing.conflictAccountId === actor.accountId)
    throw new CommunityError("COMMUNITY_MODERATION_CASE_NOT_FOUND", "This moderation case is unavailable.");
  if (existing.revision !== input.expectedRevision)
    throw new CommunityError("COMMUNITY_MODERATION_CONFLICT", "The case changed; refresh before continuing.");
  assertModerationTransition(existing.status, input.nextStatus);
  const result = await db.communityModerationCase.updateMany({
    where: { id: input.caseId, revision: input.expectedRevision },
    data: {
      status: input.nextStatus,
      revision: { increment: 1 },
      ...(input.nextStatus === "CLOSED" ? { closedAt: new Date() } : {}),
    },
  });
  if (!result.count)
    throw new CommunityError("COMMUNITY_MODERATION_CONFLICT", "The case changed; refresh before continuing.");
  await db.communityModerationCaseEvent.create({
    data: {
      caseId: input.caseId,
      eventType: "CASE_TRANSITION",
      fromStatus: existing.status,
      toStatus: input.nextStatus,
      reasonCode: reason,
      actorAccountId: actor.accountId,
      correlationId: correlation(actor),
    },
  });
  return db.communityModerationCase.findUniqueOrThrow({ where: { id: input.caseId } });
}

export async function assignModerationCase(
  actor: CommunityModeratorActor,
  input: { caseId: string; moderatorAccountId: string; expectedRevision: number; reasonCode: string },
) {
  requireModerator(actor);
  const reason = requiredReason(input.reasonCode);
  const found = await db.communityModerationCase.findUnique({ where: { id: input.caseId } });
  if (!found || found.conflictAccountId === input.moderatorAccountId)
    throw new CommunityError("COMMUNITY_MODERATION_CASE_NOT_FOUND", "This moderation case is unavailable.");
  if (found.revision !== input.expectedRevision)
    throw new CommunityError("COMMUNITY_MODERATION_CONFLICT", "The case changed; refresh before continuing.");
  await db.$transaction(async (tx) => {
    await tx.communityModerationCaseAssignment.updateMany({
      where: { caseId: input.caseId, endedAt: null },
      data: { state: "REASSIGNED", endedAt: new Date() },
    });
    await tx.communityModerationCaseAssignment.create({
      data: {
        caseId: input.caseId,
        moderatorAccountId: input.moderatorAccountId,
        assignedByAccountId: actor.accountId,
        reasonCode: reason,
      },
    });
    const changed = await tx.communityModerationCase.updateMany({
      where: { id: input.caseId, revision: input.expectedRevision },
      data: {
        assignedAccountId: input.moderatorAccountId,
        status: found.status === "OPEN" || found.status === "TRIAGED" ? "ASSIGNED" : found.status,
        revision: { increment: 1 },
      },
    });
    if (!changed.count)
      throw new CommunityError("COMMUNITY_MODERATION_CONFLICT", "The case changed; refresh before continuing.");
    await tx.communityModerationCaseEvent.create({
      data: {
        caseId: input.caseId,
        eventType: "CASE_ASSIGNED",
        fromStatus: found.status,
        toStatus: found.status === "OPEN" || found.status === "TRIAGED" ? "ASSIGNED" : found.status,
        reasonCode: reason,
        actorAccountId: actor.accountId,
        correlationId: correlation(actor),
      },
    });
  });
}

async function assertNotSelfModeration(actor: CommunityModeratorActor, subjectType: string, subjectId: string) {
  if (subjectType === "LISTING") {
    const listing = await db.communityListing.findUnique({ where: { id: subjectId }, include: { owner: true } });
    if (!listing)
      throw new CommunityError("COMMUNITY_MODERATION_SUBJECT_UNAVAILABLE", "This moderation target is unavailable.");
    if (listing.owner.accountId === actor.accountId)
      throw new CommunityError("COMMUNITY_SELF_MODERATION_FORBIDDEN", "A moderator cannot action their own content.");
  }
  if (subjectType === "RELEASE") {
    const release = await db.communityRelease.findUnique({
      where: { id: subjectId },
      include: { listing: { include: { owner: true } } },
    });
    if (!release)
      throw new CommunityError("COMMUNITY_MODERATION_SUBJECT_UNAVAILABLE", "This moderation target is unavailable.");
    if (release.listing.owner.accountId === actor.accountId)
      throw new CommunityError("COMMUNITY_SELF_MODERATION_FORBIDDEN", "A moderator cannot action their own content.");
  }
}

export async function applyModerationAction(
  actor: CommunityModeratorActor,
  input: {
    caseId: string;
    subjectType: string;
    subjectId: string;
    actionType: string;
    expectedRevision: number;
    reasonCode: string;
    idempotencyKey: string;
    secondReviewerId?: string;
  },
) {
  requireModerator(
    actor,
    highImpactActions.has(input.actionType) && process.env.COMMUNITY_REQUIRE_ADMIN_FOR_HIGH_IMPACT === "true",
  );
  const reason = requiredReason(input.reasonCode);
  if (!/^[A-Za-z0-9_-]{16,128}$/u.test(input.idempotencyKey))
    throw new CommunityError("COMMUNITY_IDEMPOTENCY_INVALID", "A valid idempotency key is required.");
  await assertNotSelfModeration(actor, input.subjectType, input.subjectId);
  const replay = await db.communityModerationAction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (replay) return replay;
  const moderationCase = await db.communityModerationCase.findUnique({ where: { id: input.caseId } });
  if (!moderationCase || moderationCase.revision !== input.expectedRevision)
    throw new CommunityError("COMMUNITY_MODERATION_CONFLICT", "The case changed; refresh before continuing.");
  const action = await db.$transaction(async (tx) => {
    const created = await tx.communityModerationAction.create({
      data: {
        caseId: input.caseId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        actionType: input.actionType,
        reasonCode: reason,
        expectedRevision: input.expectedRevision,
        idempotencyKey: input.idempotencyKey,
        actorAccountId: actor.accountId,
        secondReviewerId: input.secondReviewerId,
        reversible: input.actionType !== "REMOVE",
        appealEligible: input.actionType !== "NO_ACTION",
        restorationEligible: ["QUARANTINE_RELEASE", "QUARANTINE_LISTING"].includes(input.actionType),
        correlationId: correlation(actor),
      },
    });
    if (input.actionType === "QUARANTINE_RELEASE")
      await tx.communityRelease.update({ where: { id: input.subjectId }, data: { moderationStatus: "QUARANTINED" } });
    if (input.actionType === "QUARANTINE_LISTING")
      await tx.communityListing.update({
        where: { id: input.subjectId },
        data: { moderationStatus: "QUARANTINED", publicationStatus: "QUARANTINED" },
      });
    if (input.actionType === "SUSPEND_PROFILE")
      await tx.communityProfile.update({
        where: { id: input.subjectId },
        data: { creatorStatus: "SUSPENDED", moderationStatus: "SUSPENDED" },
      });
    await tx.communityModerationCase.update({
      where: { id: input.caseId },
      data: { status: "ACTIONED", revision: { increment: 1 } },
    });
    await tx.communityModerationCaseEvent.create({
      data: {
        caseId: input.caseId,
        eventType: "ACTION_APPLIED",
        toStatus: "ACTIONED",
        reasonCode: reason,
        actorAccountId: actor.accountId,
        correlationId: correlation(actor),
        detail: safeSnapshot({
          actionType: input.actionType,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
        }),
      },
    });
    return created;
  });
  return action;
}

export async function submitAppeal(actor: CommunityModeratorActor, input: { actionId: string; reason: string }) {
  if (!input.reason.trim() || input.reason.length > 2000)
    throw new CommunityError("COMMUNITY_APPEAL_INVALID", "Appeal text is invalid.");
  const action = await db.communityModerationAction.findUnique({ where: { id: input.actionId } });
  if (!action || !action.appealEligible)
    throw new CommunityError("COMMUNITY_APPEAL_UNAVAILABLE", "This action is not eligible for appeal.");
  if (action.actorAccountId === actor.accountId)
    throw new CommunityError("COMMUNITY_APPEAL_UNAVAILABLE", "This action is not eligible for appeal.");
  const deadline = new Date(action.appliedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (deadline < new Date()) throw new CommunityError("COMMUNITY_APPEAL_WINDOW_CLOSED", "The appeal period has ended.");
  const appeal = await db.communityModerationAppeal.create({
    data: {
      actionId: action.id,
      caseId: action.caseId,
      appellantAccountId: actor.accountId,
      reason: input.reason.trim(),
      filingDeadlineAt: deadline,
    },
  });
  await db.communityModerationAppealEvent.create({
    data: {
      appealId: appeal.id,
      eventType: "APPEAL_SUBMITTED",
      toStatus: "SUBMITTED",
      reasonCode: "OTHER",
      actorAccountId: actor.accountId,
    },
  });
  await db.communityModerationCase.update({
    where: { id: action.caseId },
    data: { status: "APPEAL_PENDING", revision: { increment: 1 } },
  });
  return { id: appeal.id, status: appeal.status, createdAt: appeal.createdAt };
}

export function moderationPublicReceipt(report: {
  id: string;
  subjectType: string;
  subjectId: string;
  status: string;
  createdAt: Date;
}) {
  return {
    id: report.id,
    subjectType: report.subjectType,
    subjectId: report.subjectId,
    status: report.status,
    createdAt: report.createdAt,
  };
}
