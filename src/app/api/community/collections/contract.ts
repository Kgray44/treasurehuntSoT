import { z } from "zod";

const opaqueId = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/, "Identifier is invalid.");
const collectionVisibility = z.enum(["PRIVATE", "UNLISTED", "COMMUNITY"]);
const subjectType = z.enum(["LISTING", "RELEASE", "CREATOR", "VOYAGE_LOG", "COLLECTION", "GUIDE"]);

export const createCollectionInputSchema = z
  .object({
    slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug is invalid."),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2_000).optional(),
    visibility: collectionVisibility.optional(),
  })
  .strict();

export const addCollectionItemInputSchema = z.object({ subjectType, subjectId: opaqueId }).strict();

export const reorderCollectionInputSchema = z
  .object({
    orderedItemIds: z.array(opaqueId).min(0).max(500).superRefine((ids, context) => {
      if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "Item IDs must be unique." });
    }),
    expectedUpdatedAt: z.string().datetime({ offset: true }),
  })
  .strict();
