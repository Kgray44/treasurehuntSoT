import { Buffer } from "node:buffer";
import { z } from "zod";
import { CommunityError } from "@/community/domain";
import { type InstallMode } from "@/community/exchange";
import { communityPackageManifestSchema, type CommunityPackageFile } from "@/community/package";

const base64Schema = z
  .string()
  .min(1)
  .max(24 * 1024 * 1024)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/);

const packageFileSchema = z
  .object({ path: z.string().min(1).max(240), mediaType: z.string().min(1).max(128), base64: base64Schema })
  .strict();

export const publicationInputSchema = z
  .object({
    releaseId: z.string().min(1).max(128),
    manifest: communityPackageManifestSchema,
    files: z.array(packageFileSchema).min(1).max(256),
  })
  .strict();

const installModeSchema = z.enum([
  "LIBRARY_REFERENCE",
  "EDITABLE_COPY",
  "FORK",
  "IMPORT_INTO_DRAFT",
  "PREVIEW_SANDBOX",
]);
const licenseSchema = z
  .object({
    key: z.string().min(1).max(128),
    allowsModification: z.boolean(),
    allowsPublicUse: z.boolean(),
    allowsCommercialUse: z.boolean(),
    requiresAttribution: z.boolean(),
    shareAlike: z.boolean(),
  })
  .strict();

export const installPlanInputSchema = z
  .object({
    packageManifest: communityPackageManifestSchema,
    packageChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    mode: installModeSchema,
    destinationRevision: z.string().min(1).max(256),
    currentDestinationRevision: z.string().min(1).max(256),
    installedPackageChecksum: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    localModificationChecksum: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    license: licenseSchema,
    destinationCommercial: z.boolean().optional(),
  })
  .strict();

export const installCommitInputSchema = installPlanInputSchema
  .extend({
    requestId: z.string().uuid(),
    releaseId: z.string().min(1).max(128),
    packageId: z.string().min(1).max(128),
    finalizationSucceeded: z.boolean(),
  })
  .strict();

export const updateComparisonInputSchema = z
  .object({
    installedChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    candidateChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    localModificationChecksum: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    installedVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
    candidateVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
  })
  .strict();

export function parseExchangeInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new CommunityError("COMMUNITY_INVALID_REQUEST", "Review the Exchange form and correct the highlighted fields.");
}

export function decodePackageFiles(files: z.infer<typeof packageFileSchema>[]): CommunityPackageFile[] {
  return files.map((file) => ({
    path: file.path,
    mediaType: file.mediaType,
    bytes: new Uint8Array(Buffer.from(file.base64, "base64")),
  }));
}

export type ExchangeInstallMode = InstallMode;
