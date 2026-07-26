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
  .refine((value) => !/<\/?[a-z][^>]*>/iu.test(value), "HTML is not permitted.");
const optionalSafeText = safeText.nullable().optional();

export const reviewInputSchema = z
  .object({
    listingId: opaqueId,
    reviewedReleaseId: opaqueId.optional(),
    rating: z.number().int().min(1).max(5),
    spoilerFreeBody: optionalSafeText,
    spoilerBody: optionalSafeText,
    dimensions: z
      .record(z.string().min(1).max(64), z.number().int().min(1).max(5))
      .refine((value) => Object.keys(value).length <= 12, "At most 12 review dimensions are permitted.")
      .optional(),
  })
  .strict();

export const reviewUpdateInputSchema = reviewInputSchema.omit({ listingId: true });
export const creatorResponseInputSchema = z.object({ body: safeText, spoilerBody: optionalSafeText }).strict();
export const listingQuerySchema = z.object({ listingId: opaqueId }).strict();
