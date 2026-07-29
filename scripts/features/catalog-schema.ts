import { z } from "zod";

export const FEATURE_STATUSES = ["MAINLINE", "BRANCH_COMPLETE_NOT_MERGED", "COMPATIBILITY"] as const;
export type FeatureStatus = (typeof FEATURE_STATUSES)[number];

export const evidenceSchema = z
  .object({
    kind: z.enum(["path", "commit", "branch", "test", "completion-record"]),
    value: z.string().trim().min(1),
  })
  .strict();

export const featureCatalogEntrySchema = z
  .object({
    id: z.string().regex(/^FT-(?:B)?\d{3}$/),
    title: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    status: z.enum(FEATURE_STATUSES),
    program: z.string().trim().min(1).optional(),
    surfaces: z.array(z.string().trim().min(1)).min(1),
    subfeatures: z.array(z.string().trim().min(1)).min(1),
    evidence: z.array(evidenceSchema).min(1),
    branch: z.string().trim().min(1).optional(),
    commit: z
      .string()
      .regex(/^[0-9a-f]{7,40}$/)
      .optional(),
    limitations: z.array(z.string().trim().min(1)).optional(),
    catalogVersion: z.literal(1),
  })
  .strict()
  .superRefine((entry, context) => {
    if (new Set(entry.subfeatures.map((value) => value.toLocaleLowerCase())).size !== entry.subfeatures.length) {
      context.addIssue({ code: "custom", message: "subfeatures must be unique", path: ["subfeatures"] });
    }
    if (entry.status === "BRANCH_COMPLETE_NOT_MERGED" && (!entry.branch || !entry.commit)) {
      context.addIssue({ code: "custom", message: "branch-complete entries require branch and commit" });
    }
    if (entry.status !== "BRANCH_COMPLETE_NOT_MERGED" && (entry.branch || entry.commit)) {
      context.addIssue({ code: "custom", message: "only branch-complete entries may declare branch metadata" });
    }
  });

export type FeatureCatalogEntry = z.infer<typeof featureCatalogEntrySchema>;
