import { z } from "zod";

const opaqueId = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "Identifier is invalid.");
const safeText = z
  .string()
  .trim()
  .min(1)
  .max(5_000)
  .refine(
    (value) => !/<\/?[a-z][^>]*>/iu.test(value) && !/(?:javascript|data)\s*:/iu.test(value),
    "Unsafe markup is not permitted.",
  );

export const commentSubjectType = z.enum(["LISTING", "VOYAGE_LOG", "GUIDE"]);
export const commentInputSchema = z
  .object({
    subjectType: commentSubjectType,
    subjectId: opaqueId,
    body: safeText,
    spoilerBody: safeText.nullable().optional(),
    parentCommentId: opaqueId.optional(),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,120}$/),
  })
  .strict();
export const commentUpdateInputSchema = commentInputSchema.pick({ body: true, spoilerBody: true });
export const commentQuerySchema = z.object({ subjectType: commentSubjectType, subjectId: opaqueId }).strict();

export const reportInputSchema = z
  .object({
    subjectType: z.enum(["LISTING", "CREATOR", "REVIEW", "COMMENT", "COLLECTION", "VOYAGE_LOG", "GUIDE"]),
    subjectId: opaqueId,
    reason: z.string().trim().min(2).max(120),
    detail: z.string().trim().max(2_000).optional(),
    idempotencyKey: z
      .string()
      .regex(/^[A-Za-z0-9_-]{8,120}$/)
      .optional(),
  })
  .strict();
