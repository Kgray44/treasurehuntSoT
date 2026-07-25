import { z } from "zod";
import { voyageLogConsentScopes } from "@/community/voyage-log-consent";

const opaqueId = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "Identifier is invalid.");
const scope = z.enum(voyageLogConsentScopes);

export const requestPublicationConsentSchema = z
  .object({
    voyageLogId: opaqueId,
    participantId: opaqueId,
    scopes: z
      .array(scope)
      .min(1)
      .max(voyageLogConsentScopes.length)
      .refine((values) => new Set(values).size === values.length, "Scopes must be unique."),
    expiresAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();
export const respondPublicationConsentSchema = z
  .object({ voyageLogId: opaqueId, scope, decision: z.enum(["APPROVED", "DECLINED"]) })
  .strict();
export const revokePublicationConsentSchema = z.object({ voyageLogId: opaqueId, scope }).strict();
