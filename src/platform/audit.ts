import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

const forbidden = /password|pin|token|secret|cookie|credential|answer|private|snapshot|payload|note/i;

export function safeAuditMetadata(value: Record<string, unknown> = {}) {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !forbidden.test(key))
      .map(([key, item]) => [key, typeof item === "string" ? item.slice(0, 300) : item]),
  );
}

export async function writePlatformAudit(input: {
  actorType: "PLAYER" | "CAPTAIN" | "CREATOR" | "SYSTEM" | "ANONYMOUS";
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
