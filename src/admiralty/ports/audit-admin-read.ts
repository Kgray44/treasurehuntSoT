import { db } from "@/lib/db";
import type { AdmiraltyCurrentOperator } from "../authorization";
import { writeAdministrativeAudit } from "../audit";
import { enforceAdmiraltyRateLimit } from "../http";
import { abbreviatedId, projection, safeMetadata } from "../read-models";

export type AuditSearchInput = Readonly<{
  query?: string;
  actor?: string;
  action?: string;
  targetType?: string;
  outcome?: string;
  correlationId?: string;
  from?: Date;
  to?: Date;
  page?: number;
}>;

const pageSize = 50;

export async function searchAdministrativeAudit(operator: AdmiraltyCurrentOperator, input: AuditSearchInput) {
  enforceAdmiraltyRateLimit(`audit-search:${operator.accountId}`, 100, 5 * 60_000);
  const page = Math.max(1, Math.min(50, input.page ?? 1));
  const events = await db.platformAuditEvent.findMany({
    where: {
      AND: [
        input.query
          ? {
              OR: [
                { id: input.query },
                { action: { contains: input.query } },
                { resourceId: input.query },
                { correlationId: input.query },
              ],
            }
          : {},
        input.actor
          ? {
              OR: [{ actorId: input.actor }, { actorAccountId: input.actor }, { actorType: { contains: input.actor } }],
            }
          : {},
        input.action ? { action: { contains: input.action } } : {},
        input.targetType ? { resourceType: input.targetType } : {},
        input.outcome ? { outcome: input.outcome } : {},
        input.correlationId ? { correlationId: input.correlationId } : {},
        input.from || input.to
          ? { createdAt: { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lte: input.to } : {}) } }
          : {},
      ],
    },
    select: {
      id: true,
      actorType: true,
      actorId: true,
      actorAccountId: true,
      action: true,
      resourceType: true,
      resourceId: true,
      outcome: true,
      correlationId: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
  });
  const hasNext = events.length > pageSize;
  const pageEvents = events.slice(0, pageSize).map((event) => ({
    ...event,
    abbreviatedId: abbreviatedId(event.id),
    detail: safeMetadata(event.metadata),
    metadata: undefined,
  }));
  await writeAdministrativeAudit({
    actorAccountId: operator.accountId,
    actorRole: operator.roles[0] ?? "AUDIT_OPERATOR",
    capability: "AUDIT_OBSERVE",
    action: "ADMIRALTY_AUDIT_EXPLORER_READ",
    targetType: "PlatformAuditEventSearch",
    targetId: input.correlationId ?? "bounded-filter",
    reason: "Read-only Audit Explorer search",
    authorizationBasis: operator.authorizationBasis,
    accountSessionId: operator.accountSessionId,
    detail: { page, resultCount: pageEvents.length, filters: Object.keys(input).filter((key) => key !== "query") },
  });
  return projection("PlatformAuditEvent canonical audit store", { page, pageSize, hasNext, results: pageEvents });
}
