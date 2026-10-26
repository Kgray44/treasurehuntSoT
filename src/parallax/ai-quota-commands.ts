import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { PrismaClient, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { AdmiraltyCurrentOperator } from "@/admiralty/authorization";
import { AdmiraltyError } from "@/admiralty/errors";
import { writeAdministrativeAudit } from "@/admiralty/audit";
import { validateAdmiraltyCommandRequest, newAdmiraltyCommandRequest } from "@/admiralty/commands";
import { aiGlobalPolicySchema, aiUserPolicySchema, effectiveAIUserPolicy, type AIGlobalPolicy } from "./ai-policy";
import { AI_CONTROL_ID, lockAIControl } from "./ai-ledger";

const common = {
  expectedRevision: z.number().int().min(0),
  reason: z.string().trim().min(8).max(240),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
};
export const aiQuotaCommandSchema = z.discriminatedUnion("target", [
  z.strictObject({ ...common, target: z.literal("GLOBAL"), policy: aiGlobalPolicySchema }),
  z.strictObject({
    ...common,
    target: z.literal("USER"),
    accountId: z.string().min(1).max(128),
    policy: aiUserPolicySchema.nullable(),
  }),
]);
export type AIQuotaCommandInput = z.infer<typeof aiQuotaCommandSchema>;
type QuotaActor = Pick<
  AdmiraltyCurrentOperator,
  "accountId" | "accountSessionId" | "capabilities" | "roles" | "authorizationBasis"
>;
function assertAuthority(actor: QuotaActor) {
  if (
    !actor.capabilities.includes("CONFIG_OPERATE") ||
    !actor.roles.some((role) => ["ADMINISTRATOR", "CONFIGURATION_OPERATOR", "EMERGENCY_OPERATOR"].includes(role))
  )
    throw new AdmiraltyError("ADMIRALTY_CAPABILITY_DENIED", "AI quota operation authority is required.", 403);
}
export function aiQuotaCommandIdentity(actor: QuotaActor, input: AIQuotaCommandInput) {
  const request = newAdmiraltyCommandRequest({
    commandType: "PARALLAX_AI_QUOTA_POLICY_UPDATE",
    actorAccountId: actor.accountId,
    targetType: input.target === "GLOBAL" ? "AIQuotaControl" : "AIQuotaUserPolicy",
    targetId: input.target === "GLOBAL" ? AI_CONTROL_ID : input.accountId,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
    input,
  });
  validateAdmiraltyCommandRequest(request);
  return request;
}
function fingerprint(actor: QuotaActor, input: AIQuotaCommandInput) {
  return createHash("sha256")
    .update(JSON.stringify({ actorAccountId: actor.accountId, accountSessionId: actor.accountSessionId, input }))
    .digest("hex");
}
async function currentPolicy(
  tx: Prisma.TransactionClient,
  global: AIGlobalPolicy,
  globalRevision: number,
  input: AIQuotaCommandInput,
  now: Date,
) {
  if (input.target === "GLOBAL") return { revision: globalRevision, current: global, resulting: input.policy };
  if (!(await tx.userAccount.findUnique({ where: { id: input.accountId }, select: { id: true } })))
    throw new AdmiraltyError("ADMIN_TARGET_NOT_FOUND", "Account unavailable.", 404);
  const row = await tx.aIQuotaUserPolicy.findUnique({ where: { accountId: input.accountId } });
  const current = row ? aiUserPolicySchema.nullable().parse(JSON.parse(row.policy)) : null;
  if (
    [input.policy?.standardModel, input.policy?.advancedModel, input.policy?.roomModel].some(
      (model) => model != null && !global.allowedModels.includes(model),
    )
  )
    throw new AdmiraltyError("ADMIN_VALIDATION_FAILED", "User models must be in the global allowed-model list.", 400);
  if (input.policy?.expiresAt && Date.parse(input.policy.expiresAt) <= now.getTime())
    throw new AdmiraltyError("ADMIN_VALIDATION_FAILED", "An exception must expire in the future.", 400);
  return {
    revision: row?.revision ?? 0,
    current,
    resulting: input.policy,
    effectiveBefore: effectiveAIUserPolicy(global, current, now),
    effectiveAfter: effectiveAIUserPolicy(global, input.policy, now),
  };
}
function assertRevision(expected: number, actual: number) {
  if (expected !== actual)
    throw new AdmiraltyError(
      "ADMIN_CONFLICT",
      "The quota policy changed. Refresh and review its current revision.",
      409,
    );
}
export async function previewAIQuotaPolicy(
  actor: QuotaActor,
  raw: unknown,
  store: PrismaClient = db,
  now = new Date(),
) {
  assertAuthority(actor);
  const input = aiQuotaCommandSchema.parse(raw);
  aiQuotaCommandIdentity(actor, input);
  return store.$transaction(async (tx) => {
    const { control, policy } = await lockAIControl(tx);
    const state = await currentPolicy(tx, policy, control.revision, input, now);
    assertRevision(input.expectedRevision, state.revision);
    const preview = await tx.aIQuotaCommandPreview.create({
      data: {
        id: randomUUID(),
        actorAccountId: actor.accountId,
        accountSessionId: actor.accountSessionId,
        fingerprint: `${fingerprint(actor, input)}:${control.revision}`,
        expectedRevision: input.expectedRevision,
        targetAccountId: input.target === "USER" ? input.accountId : null,
        expiresAt: new Date(now.getTime() + 10 * 60000),
      },
    });
    return {
      previewId: preview.id,
      expiresAt: preview.expiresAt.toISOString(),
      commandType: "PARALLAX_AI_QUOTA_POLICY_UPDATE",
      currentState: {
        policy: state.current,
        revision: state.revision,
        effective: "effectiveBefore" in state ? state.effectiveBefore : null,
      },
      resultingState: {
        policy: state.resulting,
        revision: state.revision + 1,
        effective: "effectiveAfter" in state ? state.effectiveAfter : null,
      },
      consequences: [
        "The next admission uses this revision. Already dispatched usage remains charged to its original month and prices.",
        "Global hard ceilings remain authoritative for every user override.",
        input.target === "USER" && input.policy === null
          ? "The account will inherit platform defaults; usage history remains intact."
          : "Changing an allowance never resets historical consumption.",
      ],
      warnings:
        input.target === "GLOBAL" && !input.policy.enabled
          ? ["New AI requests will stop. Manual editing remains available."]
          : [],
      requiredCapability: "CONFIG_OPERATE" as const,
      risk: "HIGH" as const,
      reauthenticationRequired: true,
      auditBehavior: "Revision, actor, reason and before/after policy are committed with a durable audit receipt.",
      rollbackAvailable: true,
      compensatingAction: "Preview the prior policy using the new current revision.",
      revision: String(state.revision),
    };
  });
}
export async function executeAIQuotaPolicy(
  actor: QuotaActor,
  raw: unknown,
  previewId: string,
  store: PrismaClient = db,
  now = new Date(),
) {
  assertAuthority(actor);
  const input = aiQuotaCommandSchema.parse(raw);
  aiQuotaCommandIdentity(actor, input);
  const digest = fingerprint(actor, input);
  return store.$transaction(async (tx) => {
    const { control, policy } = await lockAIControl(tx);
    const existing = await tx.aIQuotaPolicyRevision.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.fingerprint !== digest || existing.actorAccountId !== actor.accountId)
        throw new AdmiraltyError("ADMIN_CONFLICT", "The request identity belongs to another policy change.", 409);
      return {
        id: existing.id,
        revision: existing.resultingRevision,
        policy: JSON.parse(existing.afterState),
        idempotent: true,
      };
    }
    const preview = await tx.aIQuotaCommandPreview.findUnique({ where: { id: previewId } });
    if (
      !preview ||
      preview.usedAt ||
      preview.expiresAt <= now ||
      preview.actorAccountId !== actor.accountId ||
      preview.accountSessionId !== actor.accountSessionId ||
      preview.fingerprint !== `${digest}:${control.revision}`
    )
      throw new AdmiraltyError(
        "ADMIN_CONFLICT",
        "The session or effective policy changed. Preview this exact change again before confirming it.",
        409,
      );
    const state = await currentPolicy(tx, policy, control.revision, input, now);
    assertRevision(input.expectedRevision, state.revision);
    const nextRevision = state.revision + 1;
    if (input.target === "GLOBAL")
      await tx.aIQuotaControl.update({
        where: { id: AI_CONTROL_ID },
        data: { policy: JSON.stringify(input.policy), revision: nextRevision },
      });
    else
      await tx.aIQuotaUserPolicy.upsert({
        where: { accountId: input.accountId },
        create: { accountId: input.accountId, revision: nextRevision, policy: JSON.stringify(input.policy) },
        update: { revision: nextRevision, policy: JSON.stringify(input.policy) },
      });
    const receipt = await tx.aIQuotaPolicyRevision.create({
      data: {
        id: randomUUID(),
        targetAccountId: input.target === "USER" ? input.accountId : null,
        actorAccountId: actor.accountId,
        idempotencyKey: input.idempotencyKey,
        fingerprint: digest,
        previousRevision: state.revision,
        resultingRevision: nextRevision,
        beforeState: JSON.stringify(state.current),
        afterState: JSON.stringify(state.resulting),
        reason: input.reason.trim(),
        createdAt: now,
      },
    });
    await tx.aIQuotaCommandPreview.update({ where: { id: preview.id }, data: { usedAt: now } });
    await writeAdministrativeAudit(
      {
        actorAccountId: actor.accountId,
        actorRole: actor.roles[0] ?? "CONFIGURATION_OPERATOR",
        capability: "CONFIG_OPERATE",
        action: "ADMIRALTY_PARALLAX_AI_QUOTA_POLICY_CHANGED",
        targetType: input.target === "GLOBAL" ? "AIQuotaControl" : "AIQuotaUserPolicy",
        targetId: input.target === "GLOBAL" ? AI_CONTROL_ID : input.accountId,
        reason: input.reason,
        authorizationBasis: actor.authorizationBasis,
        correlationId: receipt.id,
        accountSessionId: actor.accountSessionId,
        beforeSummary: { revision: state.revision, policy: state.current },
        afterSummary: { revision: nextRevision, policy: state.resulting },
        detail: { owner: "Parallax", contract: "parallax-a1-ai-quota-v1" },
      },
      tx,
    );
    return { id: receipt.id, revision: nextRevision, policy: state.resulting, idempotent: false };
  });
}
