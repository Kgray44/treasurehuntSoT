import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { AdmiraltyCapabilityId } from "./capabilities";

const forbiddenKey =
  /password|pin|token|secret|cookie|credential|answer|private|snapshot|payload|note|body|prose|media|key/i;
const maxDepth = 3;
const maxCollection = 20;
const maxString = 240;

type AuditStore = {
  platformAuditEvent: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
};

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > maxDepth) return "[bounded]";
  if (typeof value === "string") return value.slice(0, maxString);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, maxCollection).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value === "object" && value)
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !forbiddenKey.test(key))
        .slice(0, maxCollection)
        .map(([key, item]) => [key, sanitizeValue(item, depth + 1)]),
    );
  return String(value).slice(0, maxString);
}

export function sanitizeAdministrativeMetadata(value: Record<string, unknown> = {}) {
  return sanitizeValue(value, 0) as Record<string, unknown>;
}

export type AdministrativeAuditInput = Readonly<{
  actorAccountId?: string | null;
  actorRole: string;
  actorType?: "PLAYER" | "ADMINISTRATOR" | "SUPPORT_OPERATOR" | "SECURITY_OPERATOR" | "SYSTEM";
  capability: AdmiraltyCapabilityId;
  action: string;
  targetType: string;
  targetId: string;
  outcome?: "SUCCEEDED" | "DENIED" | "FAILED";
  reason: string;
  authorizationBasis: string;
  supportGrantId?: string;
  correlationId?: string;
  accountSessionId?: string;
  beforeSummary?: Record<string, unknown>;
  afterSummary?: Record<string, unknown>;
  detail?: Record<string, unknown>;
}>;

export function administrativeAuditData(input: AdministrativeAuditInput) {
  const correlationId = input.correlationId ?? randomUUID();
  return {
    actorType:
      input.actorType ??
      (input.actorRole === "SUPPORT_OPERATOR"
        ? "SUPPORT_OPERATOR"
        : input.actorRole === "SECURITY_OPERATOR"
          ? "SECURITY_OPERATOR"
          : "ADMINISTRATOR"),
    actorId: input.actorAccountId ?? "ADMIRALTY_SYSTEM",
    actorAccountId: input.actorAccountId ?? null,
    action: input.action,
    resourceType: input.targetType,
    resourceId: input.targetId,
    outcome: input.outcome ?? "SUCCEEDED",
    correlationId,
    metadata: JSON.stringify(
      sanitizeAdministrativeMetadata({
        actorRole: input.actorRole,
        capability: input.capability,
        reason: input.reason,
        authorizationBasis: input.authorizationBasis,
        supportGrantId: input.supportGrantId,
        accountSessionId: input.accountSessionId,
        beforeSummary: input.beforeSummary,
        afterSummary: input.afterSummary,
        detail: input.detail,
      }),
    ),
  };
}

export async function writeAdministrativeAudit(input: AdministrativeAuditInput, store: AuditStore = db) {
  const data = administrativeAuditData(input);
  await store.platformAuditEvent.create({ data });
  return data.correlationId;
}
