import { z } from "zod";

export const reauthenticationSchema = z.object({ password: z.string().min(1).max(1024) }).strict();

export const supportScopeSchema = z.enum([
  "ACCOUNT_STATE",
  "AUTH_EVENTS",
  "CHRONICLE_HISTORY_METADATA",
  "COMMUNITY_ACTIVITY",
  "SESSION_DIAGNOSTICS",
  "PROFILE_DIAGNOSTICS",
]);

export const supportRequestSchema = z
  .object({
    targetAccountId: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/u),
    purpose: z.string().trim().min(8).max(240),
    requestedScopes: z.array(supportScopeSchema).min(1).max(6),
  })
  .strict();

export const supportDecisionSchema = z.object({ decision: z.enum(["APPROVE", "DENY"]) }).strict();
export const supportCancelSchema = z.object({ reason: z.string().trim().min(2).max(160).optional() }).strict();
export const supportRevokeSchema = z.object({ reason: z.string().trim().min(2).max(160) }).strict();
export const sessionRevokeSchema = z
  .object({
    targetAccountId: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/u),
    sessionId: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/u),
    reason: z.string().trim().min(8).max(240),
    idempotencyKey: z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/u),
  })
  .strict();
export const moderationActionSchema = z
  .object({
    caseId: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/u),
    subjectType: z.string().trim().min(1).max(64),
    subjectId: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/u),
    actionType: z.string().trim().min(1).max(64),
    expectedRevision: z.number().int().min(0),
    reasonCode: z.string().trim().min(1).max(64),
    reason: z.string().trim().min(8).max(240),
    idempotencyKey: z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/u),
    secondReviewerId: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/u).optional(),
  })
  .strict();
export const accountSuspendSchema = z
  .object({
    targetAccountId: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/u),
    expectedUpdatedAt: z.string().datetime(),
    reason: z.string().trim().min(8).max(240),
    idempotencyKey: z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/u),
  })
  .strict();
export const supportReadSchema = z
  .object({
    grantId: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/u),
    targetAccountId: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/u),
    scope: supportScopeSchema,
  })
  .strict();

export type SupportAccessScope = z.infer<typeof supportScopeSchema>;
