import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

const forbidden =
  /password|pin|token|secret|cookie|credential|answer|private|snapshot|payload|note|body|prose|media|key/i;

function safeAuditValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[bounded]";
  if (typeof value === "string") return value.slice(0, 300);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeAuditValue(item, depth + 1));
  if (typeof value === "object" && value)
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !forbidden.test(key))
        .slice(0, 20)
        .map(([key, item]) => [key, safeAuditValue(item, depth + 1)]),
    );
  return String(value).slice(0, 300);
}

export function safeAuditMetadata(value: Record<string, unknown> = {}) {
  return safeAuditValue(value) as Record<string, unknown>;
}

export async function writePlatformAudit(input: {
  actorType:
    | "PLAYER"
    | "CAPTAIN"
    | "CREATOR"
    | "SYSTEM"
    | "ANONYMOUS"
    | "ADMINISTRATOR"
    | "SUPPORT_OPERATOR"
    | "SECURITY_OPERATOR";
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome?: "SUCCEEDED" | "DENIED" | "FAILED";
  correlationId?: string;
  metadata?: Record<string, unknown>;
}) {
  const correlationId = input.correlationId ?? randomUUID();
  await db.platformAuditEvent.create({
    data: {
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      outcome: input.outcome ?? "SUCCEEDED",
      correlationId,
      metadata: JSON.stringify(safeAuditMetadata(input.metadata)),
    },
  });
  return correlationId;
}
