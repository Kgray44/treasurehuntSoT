import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import type { AdmiraltyCurrentOperator } from "@/admiralty/authorization";
import type { AdmiraltyCommandPort } from "@/admiralty/commands";
import { AdmiraltyError } from "@/admiralty/errors";
import { writeAdministrativeAudit } from "@/admiralty/audit";
import {
  reachRuntimePolicySchema,
  reachRuntimePolicyEnvelopeSchema,
  type ReachRuntimePolicyEnvelope,
} from "./runtime-policy";
import {
  readReachRuntimePolicy,
  requireReachCapability,
  requireReachDate,
  reachFingerprint,
  reachStoredInteger,
  REACH_RUNTIME_POLICY_ID,
  purgeReachTelemetry,
} from "./admin-service";
import type { ReachStore } from "./admin-storage";

export const reachRuntimePolicyCommandSchema = z.strictObject({
  expectedRevision: z.number().int().min(0).max(2_147_483_646),
  policy: reachRuntimePolicySchema,
  reason: z
    .string()
    .trim()
    .min(8)
    .max(240)
    .refine(
      (value) => !/password|token|secret|credential|cookie|private key|csrf/iu.test(value),
      "Do not include sensitive values.",
    ),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/u),
});
export type ReachRuntimePolicyCommandInput = z.infer<typeof reachRuntimePolicyCommandSchema>;
export type ReachRuntimePolicyPortInput = Pick<ReachRuntimePolicyCommandInput, "expectedRevision" | "policy">;
const conflict = () =>
  new AdmiraltyError("ADMIN_CONFLICT", "The Reach policy or preview changed. Refresh and review it again.", 409);
const fingerprint = (actor: AdmiraltyCurrentOperator, input: ReachRuntimePolicyCommandInput) =>
  reachFingerprint({ actor: actor.accountId, session: actor.accountSessionId, input });
function currentAndNext(current: ReachRuntimePolicyEnvelope, input: ReachRuntimePolicyCommandInput) {
  if (current.revision !== input.expectedRevision) throw conflict();
  return reachRuntimePolicyEnvelopeSchema.parse({
    schemaVersion: 1,
    revision: current.revision + 1,
    policy: input.policy,
  });
}

export async function previewReachRuntimePolicy(
  actor: AdmiraltyCurrentOperator,
  request: unknown,
  store: ReachStore = db,
  now = new Date(),
) {
  requireReachCapability(actor, "CONFIG_OPERATE");
  requireReachDate(now);
  const input = reachRuntimePolicyCommandSchema.parse(request);
  const current = await readReachRuntimePolicy(store),
    resulting = currentAndNext(current, input);
  const previewId = randomUUID(),
    expiresAt = new Date(now.getTime() + 600_000),
    digest = fingerprint(actor, input);
  await store.$executeRaw`DELETE FROM ReachPolicyPreview WHERE expiresAt < ${now}`;
  await store.$executeRaw`INSERT INTO ReachPolicyPreview (id,actorAccountId,accountSessionId,fingerprint,expectedRevision,expiresAt,usedAt,createdAt) VALUES (${previewId},${actor.accountId},${actor.accountSessionId},${digest},${input.expectedRevision},${expiresAt},${null},${now})`;
  return {
    previewId,
    expiresAt: expiresAt.toISOString(),
    commandType: "REACH_RUNTIME_POLICY_UPDATE",
    targetSummary: { owner: "Reach", policy: REACH_RUNTIME_POLICY_ID },
    currentState: current,
    resultingState: resulting,
    consequences: [
      `Reach capture will be ${resulting.policy.featureEnabled ? "available" : "disabled"} for all clients.`,
      `Focused normal/calibration ceilings: ${resulting.policy.normalMaximumHz}/${resulting.policy.calibrationMaximumHz} Hz; model maximum ${resulting.policy.modelMaximumHz} Hz; visible unfocused maximum ${resulting.policy.unfocusedMaximumHz} Hz. Pressure and one-frame backpressure may reduce these rates.`,
      `Automatic numeric aggregate collection is ${resulting.policy.telemetryEnabled ? "enabled" : "disabled"}; retention is at most ${resulting.policy.telemetryRetentionDays} days. No camera, landmark, coordinate or account data is collected.`,
      `Local recording remains ${resulting.policy.localRecorderEnabled ? "subject to the existing local environment and loopback gates" : "disabled"}.`,
    ],
    warnings: [
      "Freshness, source binding, recognition/model quality and independent 3% validation are immutable. Disabling collection does not erase earlier numeric reports before retention expiry.",
    ],
    requiredCapability: "CONFIG_OPERATE" as const,
    risk: "HIGH" as const,
    reauthenticationRequired: true,
    auditBehavior: "Reach stores a revisioned receipt and canonical Admiralty audit atomically.",
    rollbackAvailable: true,
    compensatingAction: "Preview the previous policy using the new current revision.",
    revision: String(current.revision),
  };
}

export async function executeReachRuntimePolicy(
  actor: AdmiraltyCurrentOperator,
  request: unknown,
  previewId: string,
  store: ReachStore = db,
  now = new Date(),
) {
  requireReachCapability(actor, "CONFIG_OPERATE");
  requireReachDate(now);
  const input = reachRuntimePolicyCommandSchema.parse(request),
    digest = fingerprint(actor, input);
  if (!z.uuid().safeParse(previewId).success) throw conflict();
  return store.$transaction(async (tx) => {
    const previous = await tx.$queryRaw<
      Array<{ id: string; fingerprint: string; correlationId: string; afterState: string }>
    >`SELECT id,fingerprint,correlationId,afterState FROM ReachPolicyChange WHERE idempotencyKey = ${input.idempotencyKey}`;
    if (previous.length) {
      if (previous[0].fingerprint !== digest) throw conflict();
      return {
        id: previous[0].id,
        correlationId: previous[0].correlationId,
        envelope: reachRuntimePolicyEnvelopeSchema.parse(JSON.parse(previous[0].afterState)),
        idempotent: true,
      };
    }
    const previews = await tx.$queryRaw<
      Array<{
        fingerprint: string;
        actorAccountId: string;
        accountSessionId: string;
        expiresAt: Date;
        usedAt: Date | null;
        expectedRevision: number;
      }>
    >`SELECT fingerprint,actorAccountId,accountSessionId,expiresAt,usedAt,expectedRevision FROM ReachPolicyPreview WHERE id = ${previewId}`;
    const preview = previews[0];
    if (
      !preview ||
      preview.fingerprint !== digest ||
      preview.actorAccountId !== actor.accountId ||
      preview.accountSessionId !== actor.accountSessionId ||
      preview.usedAt !== null ||
      new Date(preview.expiresAt).getTime() <= now.getTime() ||
      reachStoredInteger(preview.expectedRevision) !== input.expectedRevision
    )
      throw conflict();
    const current = await readReachRuntimePolicy(tx),
      resulting = currentAndNext(current, input);
    const nextPolicy = JSON.stringify(resulting.policy);
    if (current.revision === 0) {
      try {
        await tx.$executeRaw`INSERT INTO ReachRuntimePolicy (id,revision,policy,updatedAt) VALUES (${REACH_RUNTIME_POLICY_ID},${resulting.revision},${nextPolicy},${now})`;
      } catch (cause) {
        if (/unique|duplicate/iu.test(String(cause))) throw conflict();
        throw cause;
      }
    } else {
      const changed =
        await tx.$executeRaw`UPDATE ReachRuntimePolicy SET revision = ${resulting.revision}, policy = ${nextPolicy}, updatedAt = ${now} WHERE id = ${REACH_RUNTIME_POLICY_ID} AND revision = ${input.expectedRevision}`;
      if (changed !== 1) throw conflict();
    }
    const used =
      await tx.$executeRaw`UPDATE ReachPolicyPreview SET usedAt = ${now} WHERE id = ${previewId} AND usedAt IS NULL`;
    if (used !== 1) throw conflict();
    const id = randomUUID(),
      correlationId = randomUUID(),
      beforeState = JSON.stringify(current),
      afterState = JSON.stringify(resulting);
    await tx.$executeRaw`INSERT INTO ReachPolicyChange (id,actorAccountId,accountSessionId,idempotencyKey,fingerprint,expectedRevision,resultingRevision,beforeState,afterState,reason,correlationId,createdAt) VALUES (${id},${actor.accountId},${actor.accountSessionId},${input.idempotencyKey},${digest},${input.expectedRevision},${resulting.revision},${beforeState},${afterState},${input.reason},${correlationId},${now})`;
    await purgeReachTelemetry(tx, now, resulting);
    await writeAdministrativeAudit(
      {
        actorAccountId: actor.accountId,
        actorRole: actor.roles[0] ?? "CONFIGURATION_OPERATOR",
        capability: "CONFIG_OPERATE",
        action: "ADMIRALTY_REACH_RUNTIME_POLICY_CHANGED",
        targetType: "ReachRuntimePolicy",
        targetId: REACH_RUNTIME_POLICY_ID,
        reason: input.reason,
        authorizationBasis: actor.authorizationBasis,
        accountSessionId: actor.accountSessionId,
        correlationId,
        beforeSummary: current,
        afterSummary: resulting,
        detail: { owner: "Reach", contract: "reach-runtime-policy-v1" },
      },
      tx,
    );
    return { id, correlationId, envelope: resulting, idempotent: false };
  });
}

export function reachRuntimePolicyPort(
  actor: AdmiraltyCurrentOperator,
  previewId?: string,
  store: ReachStore = db,
): AdmiraltyCommandPort<ReachRuntimePolicyPortInput> {
  return {
    ownerDomain: "Reach",
    preview: (request) =>
      previewReachRuntimePolicy(
        actor,
        { ...request.input, reason: request.reason, idempotencyKey: request.idempotencyKey },
        store,
      ),
    async execute(request) {
      const result = await executeReachRuntimePolicy(
        actor,
        { ...request.input, reason: request.reason, idempotencyKey: request.idempotencyKey },
        previewId ?? "",
        store,
      );
      return {
        outcome: "SUCCEEDED",
        ownerReceiptId: result.id,
        correlationId: result.correlationId,
        resultSummary: { envelope: result.envelope, idempotent: result.idempotent, rollbackAvailable: true },
      };
    },
  };
}
